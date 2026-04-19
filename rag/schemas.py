from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class QueryRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=10)
    strategy: Literal["traditional", "tree", "graph", "all"] | None = None
    chat_history: list[ChatMessage] = Field(default_factory=list)


class RetrievalHit(BaseModel):
    strategy: Literal["traditional", "tree", "graph"]
    content: str
    score: float = 0.0
    source: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RetrievalResult(BaseModel):
    strategy: Literal["traditional", "tree", "graph"]
    hits: list[RetrievalHit] = Field(default_factory=list)
    summary: str | None = None
    source_documents: list[str] = Field(default_factory=list)
    average_score: float = 0.0


class UploadResponse(BaseModel):
    document_id: str
    file_name: str
    file_size: int
    chunk_count: int
    indexed_strategies: list[str]
    created_at: datetime


class DeleteResponse(BaseModel):
    document_id: str
    deleted: bool


class QueryResponse(BaseModel):
    answer: str
    confidence: float = 0.0
    sources: list[str] = Field(default_factory=list)
    selected_strategies: list[str] = Field(default_factory=list)
    retrievals: dict[str, RetrievalResult] = Field(default_factory=dict)


class StoredDocument(BaseModel):
    document_id: str
    file_name: str
    file_path: str
    mime_type: str
    file_size: int
    chunk_count: int
    indexed_strategies: list[str] = Field(default_factory=list)
    traditional_chunk_ids: list[str] = Field(default_factory=list)
    tree_node_ids: list[str] = Field(default_factory=list)
    graph_enabled: bool = False
    graph_triple_count: int = 0
    created_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)
