from __future__ import annotations

from typing import Any

import chromadb
from chromadb.utils import embedding_functions
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from langchain_openai import OpenAIEmbeddings

from settings import Settings
from utils import unique_preserve_order
import logging

logger = logging.getLogger(__name__)

def _score_from_distance(distance: float | None) -> float:
    if distance is None:
        return 0.0
    return max(0.0, min(1.0, 1.0 - (distance / 2.0)))


class TraditionalRAGRetriever:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: chromadb.ClientAPI | None = None
        self._collection = None
        self._embeddings: OpenAIEmbeddings | None = None

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
            name=self.settings.chroma_collection_traditional,
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

    def index_document(
        self,
        *,
        document_id: str,
        title: str,
        source: str,
        chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        texts = [chunk["content"] for chunk in chunks]
        ids = [f"{document_id}:chunk:{index}" for index in range(len(chunks))]
        metadatas = [
            {
                "document_id": document_id,
                "title": title,
                "source": source,
                "chunk_index": chunk["metadata"].get("chunk_index", index),
                "page_number": chunk["metadata"].get("page_number") or -1,
            }
            for index, chunk in enumerate(chunks)
        ]
        self._get_collection().add(
            ids=ids,
            documents=texts,
            metadatas=metadatas,
        )
        return {"chunk_ids": ids}

    def query(self, query: str, top_k: int = 5) -> dict[str, Any]:
        collection = self._get_collection()
        raw = collection.query(
            query_texts=[query],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        documents = raw.get("documents", [[]])[0]
        metadatas = raw.get("metadatas", [[]])[0]
        distances = raw.get("distances", [[]])[0]

        hits = []
        scores: list[float] = []
        sources: list[str] = []
        for document, metadata, distance in zip(documents, metadatas, distances):
            score = _score_from_distance(distance)
            scores.append(score)
            source = metadata.get("title") or metadata.get("source")
            if source:
                sources.append(source)
            hits.append(
                {
                    "strategy": "traditional",
                    "content": document,
                    "score": round(score, 4),
                    "source": source,
                    "metadata": metadata,
                }
            )

        average_score = sum(scores) / len(scores) if scores else 0.0
        summary = "\n\n".join(hit["content"] for hit in hits[:3]) if hits else None
        return {
            "strategy": "traditional",
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
