from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import chromadb
from chromadb.utils import embedding_functions
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from settings import Settings
from utils import coerce_text, unique_preserve_order


def _score_from_distance(distance: float | None, level: int) -> float:
    base = 0.0 if distance is None else max(0.0, min(1.0, 1.0 - (distance / 2.0)))
    level_bonus = min(level * 0.05, 0.15)
    return max(0.0, min(1.0, base + level_bonus))


class TreeRAGRetriever:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: chromadb.ClientAPI | None = None
        self._collection = None
        self._embeddings: OpenAIEmbeddings | None = None
        self._model: ChatOpenAI | None = None

    def _get_client(self):
        if self._client is not None:
            return self._client

        if self.settings.chroma_mode == "http":
            self._client = chromadb.HttpClient(
                host=self.settings.chroma_host,
                port=self.settings.chroma_port,
                ssl=self.settings.chroma_ssl,
            )
        else:
            self._client = chromadb.PersistentClient(
                path=str(self.settings.chroma_persist_dir)
            )
        return self._client

    def _get_collection(self):
        if self._collection is not None:
            return self._collection
        
        embedding_function = self._get_embeddings()

        self._collection = self._get_client().get_or_create_collection(
            name=self.settings.chroma_collection_tree,
            metadata={"hnsw:space": "cosine"},
            embedding_function=embedding_function
        )
        return self._collection

    def _get_embeddings(self) -> OpenAIEmbeddingFunction:
        if self._embeddings is not None:
            return self._embeddings
        self._embeddings = embedding_functions.OpenAIEmbeddingFunction(
            api_key=self.settings.openai_api_key,
            model_name=self.settings.openai_embedding_model,
        )
        return self._embeddings

    def _get_model(self) -> ChatOpenAI:
        if self._model is not None:
            return self._model
        self._model = ChatOpenAI(
            api_key=self.settings.openai_api_key,
            model=self.settings.openai_chat_model,
            temperature=0,
        )
        return self._model

    def _summarize_group(self, title: str, texts: list[str], level: int) -> str:
        content = "\n\n".join(texts)
        fallback = content[:1200]

        if not self.settings.openai_api_key:
            return fallback
        prompt = f"""
You are optimizing text for semantic retrieval (embedding), not for human reading.

Task:
Create a compact representation of the content for a level-{level} node in a retrieval tree.

STRICT REQUIREMENTS:
- Preserve important keywords, entities, numbers, and technical terms EXACTLY as written.
- Do NOT paraphrase critical terms.
- Prefer short keyword-rich phrases over long sentences.
- Include synonyms or related terms if helpful for retrieval.
- Keep it dense and information-rich (NOT verbose).
- Output 5–8 bullet points maximum.

Title: {title}

Content:
{content}
""".strip()
        try:
            response = self._get_model().invoke(prompt)
            summary = coerce_text(response.content).strip()

            if not summary:
                return fallback

            enriched = summary + "\n\n" + content[:400]

            return enriched[:1500]

        except Exception:
            return fallback

    def _tree_path(self, document_id: str) -> Path:
        return self.settings.tree_dir / f"{document_id}.json"

    def index_document(
        self,
        *,
        document_id: str,
        title: str,
        source: str,
        chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        branch_size = max(2, self.settings.tree_branch_size)
        nodes: list[dict[str, Any]] = []

        for index, chunk in enumerate(chunks):
            nodes.append(
                {
                    "id": f"{document_id}:tree:l0:{index}",
                    "level": 0,
                    "node_type": "leaf",
                    "parent_id": None,
                    "text": chunk["content"],
                }
            )

        branch_nodes: list[dict[str, Any]] = []
        for offset in range(0, len(chunks), branch_size):
            group = chunks[offset : offset + branch_size]
            group_texts = [item["content"] for item in group]
            node_id = f"{document_id}:tree:l1:{offset // branch_size}"
            branch_nodes.append(
                {
                    "id": node_id,
                    "level": 1,
                    "node_type": "branch",
                    "parent_id": None,
                    "text": self._summarize_group(title, group_texts, 1),
                }
            )

        nodes.extend(branch_nodes)

        root_node: dict[str, Any] | None = None
        if branch_nodes:
            texts = [node["text"] for node in branch_nodes]
            root_node = {
                "id": f"{document_id}:tree:l2:root",
                "level": 2,
                "node_type": "root",
                "parent_id": None,
                "text": self._summarize_group(
                    title,
                    texts,
                    2,
                ),
            }
            nodes.append(root_node)
            for branch in branch_nodes:
                branch["parent_id"] = root_node["id"]

        payload = {
            "document_id": document_id,
            "title": title,
            "source": source,
            "root_id": root_node["id"] if root_node else None,
            "nodes": nodes,
        }
        self._tree_path(document_id).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        ids = [node["id"] for node in nodes]
        texts = [node["text"] for node in nodes]
        metadatas = [
            {
                "document_id": document_id,
                "title": title,
                "source": source,
                "level": node["level"],
                "node_type": node["node_type"],
                "parent_id": node["parent_id"] or "",
            }
            for node in nodes
        ]
        self._get_collection().add(
            ids=ids,
            documents=texts,
            metadatas=metadatas,
        )
        return {"node_ids": ids, "tree_file": str(self._tree_path(document_id))}

    def query(self, query: str, top_k: int = 5) -> dict[str, Any]:
        collection = self._get_collection()
        raw = collection.query(
            query_texts=[query],
            n_results=top_k,
            where={"level": 0},
            include=["documents", "metadatas", "distances"],
        )

        documents = raw.get("documents", [[]])[0]
        metadatas = raw.get("metadatas", [[]])[0]
        distances = raw.get("distances", [[]])[0]

        hits = []
        scores: list[float] = []
        sources: list[str] = []
        for document, metadata, distance in zip(documents, metadatas, distances):
            level = int(metadata.get("level", 0))
            score = _score_from_distance(distance, level)
            scores.append(score)
            source = metadata.get("title") or metadata.get("source")
            if source:
                sources.append(source)
            hits.append(
                {
                    "strategy": "tree",
                    "content": document,
                    "score": round(score, 4),
                    "source": source,
                    "metadata": metadata,
                }
            )

        hits.sort(key=lambda item: item["score"], reverse=True)
        average_score = sum(scores) / len(scores) if scores else 0.0
        summary = "\n\n".join(hit["content"] for hit in hits[:3]) if hits else None
        return {
            "strategy": "tree",
            "hits": hits,
            "summary": summary,
            "source_documents": unique_preserve_order(sources),
            "average_score": round(average_score, 4),
        }

    def delete_document(self, document_id: str) -> None:
        collection = self._get_collection()
        existing = collection.get(where={"document_id": document_id})
        ids = existing.get("ids", [])
        if ids:
            collection.delete(ids=ids)

        tree_path = self._tree_path(document_id)
        if tree_path.exists():
            tree_path.unlink()
