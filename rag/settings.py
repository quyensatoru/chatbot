from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _str_env(name: str, default: str) -> str:
    return os.getenv(name, default).strip()


def _first_str_env(names: tuple[str, ...], default: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    base_dir: Path
    storage_dir: Path
    upload_dir: Path
    tree_dir: Path
    registry_path: Path
    chroma_mode: str
    chroma_host: str
    chroma_port: int
    chroma_ssl: bool
    chroma_persist_dir: Path
    chroma_collection_traditional: str
    chroma_collection_tree: str
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str
    openai_api_key: str
    openai_chat_model: str
    openai_embedding_model: str
    rag_internal_api_key: str
    chunk_size: int
    chunk_overlap: int
    tree_branch_size: int
    graph_max_triples_per_chunk: int
    default_top_k: int

    def ensure_directories(self) -> None:
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.tree_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_persist_dir.mkdir(parents=True, exist_ok=True)
        if not self.registry_path.exists():
            self.registry_path.write_text("{}", encoding="utf-8")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    base_dir = Path(__file__).resolve().parent
    storage_dir = Path(_str_env("RAG_STORAGE_DIR", str(base_dir / "data"))).resolve()
    upload_dir = storage_dir / "uploads"
    tree_dir = storage_dir / "trees"
    registry_path = storage_dir / "documents.json"

    chroma_persist_default = storage_dir / "chroma"
    settings = Settings(
        base_dir=base_dir,
        storage_dir=storage_dir,
        upload_dir=upload_dir,
        tree_dir=tree_dir,
        registry_path=registry_path,
        chroma_mode=_str_env("CHROMA_MODE", "persistent").lower(),
        chroma_host=_str_env("CHROMA_HOST", "localhost"),
        chroma_port=_int_env("CHROMA_PORT", 8000),
        chroma_ssl=_bool_env("CHROMA_SSL", False),
        chroma_persist_dir=Path(
            _str_env("CHROMA_PERSIST_DIR", str(chroma_persist_default))
        ).resolve(),
        chroma_collection_traditional=_str_env(
            "CHROMA_COLLECTION_TRADITIONAL",
            "rag_traditional",
        ),
        chroma_collection_tree=_str_env("CHROMA_COLLECTION_TREE", "rag_tree"),
        neo4j_uri=_str_env("NEO4J_URI", "bolt://localhost:7687"),
        neo4j_username=_str_env("NEO4J_USERNAME", "neo4j"),
        neo4j_password=_str_env("NEO4J_PASSWORD", "password"),
        openai_api_key=_str_env("OPENAI_API_KEY", ""),
        openai_chat_model=_str_env("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
        openai_embedding_model=_str_env(
            "OPENAI_EMBEDDING_MODEL",
            "text-embedding-3-small",
        ),
        rag_internal_api_key=_first_str_env(
            ("RAG_INTERNAL_API_KEY", "RAG_API_KEY"),
            "",
        ),
        chunk_size=_int_env("RAG_CHUNK_SIZE", 1200),
        chunk_overlap=_int_env("RAG_CHUNK_OVERLAP", 200),
        tree_branch_size=_int_env("RAG_TREE_BRANCH_SIZE", 4),
        graph_max_triples_per_chunk=_int_env(
            "RAG_GRAPH_MAX_TRIPLES_PER_CHUNK",
            5,
        ),
        default_top_k=_int_env("RAG_DEFAULT_TOP_K", 5),
    )
    settings.ensure_directories()
    return settings
