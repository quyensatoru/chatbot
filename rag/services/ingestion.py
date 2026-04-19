from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ✅ semantic chunking
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings

from retrievers.graph import GraphRAGRetriever
from retrievers.traditional import TraditionalRAGRetriever
from retrievers.tree import TreeRAGRetriever
from schemas import StoredDocument, UploadResponse
from services.document_store import DocumentStore
from settings import Settings


TEXT_LIKE_EXTENSIONS = {
    ".txt",
    ".md",
    ".markdown",
    ".csv",
    ".json",
    ".yaml",
    ".yml",
    ".log",
}


class IngestionService:
    def __init__(
        self,
        settings: Settings,
        document_store: DocumentStore,
        traditional: TraditionalRAGRetriever,
        tree: TreeRAGRetriever,
        graph: GraphRAGRetriever,
    ) -> None:
        self.settings = settings
        self.document_store = document_store
        self.traditional = traditional
        self.tree = tree
        self.graph = graph

        # ✅ init embeddings 1 lần (đỡ chậm)
        self.embeddings = OpenAIEmbeddings()

    # =========================
    # LOAD DOCUMENT
    # =========================
    def _load_text_document(self, file_path: Path) -> list[Document]:
        raw = file_path.read_bytes()
        encodings = ("utf-8", "utf-8-sig", "cp1252", "latin-1")

        for encoding in encodings:
            try:
                text = raw.decode(encoding)
                return [
                    Document(
                        page_content=text,
                        metadata={
                            "source": str(file_path),
                            "encoding": encoding,
                        },
                    )
                ]
            except UnicodeDecodeError:
                continue

        raise ValueError(
            f"Could not decode text file {file_path.name} with supported encodings."
        )

    def _load_with_unstructured(self, file_path: Path) -> list:
        errors: list[str] = []

        try:
            from langchain_unstructured import UnstructuredLoader

            loader = UnstructuredLoader(
                file_path=str(file_path),
                strategy="fast",
            )
            docs = loader.load()
            if docs:
                return docs
        except Exception as exc:
            errors.append(f"fast loader failed: {exc}")

        try:
            from langchain_unstructured import UnstructuredLoader

            loader = UnstructuredLoader(str(file_path))
            docs = loader.load()
            if docs:
                return docs
        except Exception as exc:
            errors.append(f"default loader failed: {exc}")

        raise ValueError(
            f"Could not extract content from {file_path.name}. "
            + " | ".join(errors)
        )

    def _load_document(self, file_path: Path) -> list:
        if file_path.suffix.lower() in TEXT_LIKE_EXTENSIONS:
            return self._load_text_document(file_path)

        return self._load_with_unstructured(file_path)

    # =========================
    # CLEAN TEXT
    # =========================
    def _clean_text(self, text: str) -> str:
        return (
            text.replace("\u0000", "")
            .replace("\r", "\n")
            .strip()
        )

    # =========================
    # SPLIT DOCUMENT (SEMANTIC)
    # =========================
    def _split_documents(self, documents: list) -> list[dict[str, Any]]:
        # 1. merge text
        full_text = "\n\n".join(
            self._clean_text(doc.page_content)
            for doc in documents
            if getattr(doc, "page_content", "").strip()
        )

        if not full_text:
            raise ValueError("No extractable text was found in the uploaded file.")

        docs = [Document(page_content=full_text)]

        # 2. semantic chunking
        try:
            semantic_splitter = SemanticChunker(
                self.embeddings,
                breakpoint_threshold_type="percentile",
                breakpoint_threshold_amount=85,
            )

            semantic_chunks = semantic_splitter.split_documents(docs)

        except Exception as e:
            # fallback nếu semantic fail
            print(f"[WARN] Semantic chunking failed: {e}")

            fallback_splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.settings.chunk_size or 500,
                chunk_overlap=self.settings.chunk_overlap or 50,
                separators=[
                    "\n\n",
                    "\n",
                    ". ",
                    "? ",
                    "! ",
                ],
            )

            fallback_chunks = fallback_splitter.split_documents(docs)

            return [
                {
                    "content": c.page_content.strip(),
                    "metadata": {"chunk_index": i},
                }
                for i, c in enumerate(fallback_chunks)
                if c.page_content.strip()
            ]

        # 3. hybrid split (nếu chunk quá dài)
        char_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=[
                "\n\n",
                "\n",
                ". ",
            ],
        )

        normalized_chunks: list[dict[str, Any]] = []
        chunk_index = 0

        for chunk in semantic_chunks:
            content = chunk.page_content.strip()
            if not content:
                continue

            if len(content) > 800:
                sub_chunks = char_splitter.create_documents([content])

                for sub in sub_chunks:
                    sub_content = sub.page_content.strip()
                    if not sub_content:
                        continue

                    normalized_chunks.append(
                        {
                            "content": sub_content,
                            "metadata": {
                                "chunk_index": chunk_index,
                            },
                        }
                    )
                    chunk_index += 1
            else:
                normalized_chunks.append(
                    {
                        "content": content,
                        "metadata": {
                            "chunk_index": chunk_index,
                        },
                    }
                )
                chunk_index += 1

        return normalized_chunks

    # =========================
    # INDEX FILE
    # =========================
    def index_file(
        self,
        file_path: Path,
        *,
        file_name: str,
        mime_type: str,
        file_size: int,
    ) -> UploadResponse:
        document_id = str(uuid4())

        documents = self._load_document(file_path)
        chunks = self._split_documents(documents)

        traditional_result = self.traditional.index_document(
            document_id=document_id,
            title=file_name,
            source=str(file_path),
            chunks=chunks,
        )

        tree_result = self.tree.index_document(
            document_id=document_id,
            title=file_name,
            source=str(file_path),
            chunks=chunks,
        )

        graph_result = self.graph.index_document(
            document_id=document_id,
            title=file_name,
            chunks=chunks,
            source=str(file_path),
        )

        created_at = datetime.now(timezone.utc)

        indexed_strategies = ["traditional", "tree"]
        if graph_result.get("enable"):
            indexed_strategies.append("graph")

        stored_document = StoredDocument(
            document_id=document_id,
            file_name=file_name,
            file_path=str(file_path),
            mime_type=mime_type,
            file_size=file_size,
            chunk_count=len(chunks),
            indexed_strategies=["traditional", "tree"],
            traditional_chunk_ids=traditional_result.get("chunk_ids", []),
            tree_node_ids=tree_result.get("node_ids", []),
            graph_enabled=graph_result.get("enabled", False),
            graph_triple_count=graph_result.get("triple_count", 0),
            created_at=created_at,
            metadata={
                "tree_file": tree_result.get("tree_file"),
                "graph_reason": graph_result.get("reason"),
            },
        )

        self.document_store.upsert(stored_document)

        return UploadResponse(
            document_id=document_id,
            file_name=file_name,
            file_size=file_size,
            chunk_count=len(chunks),
            indexed_strategies=indexed_strategies,
            created_at=created_at,
        )

    # =========================
    # CRUD
    # =========================
    def list_documents(self) -> list[dict]:
        return self.document_store.list()

    def delete_document(self, document_id: str) -> bool:
        self.traditional.delete_document(document_id)
        self.tree.delete_document(document_id)
        self.graph.delete_document(document_id)

        deleted = self.document_store.delete(document_id)
        return deleted is not None