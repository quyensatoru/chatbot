from __future__ import annotations

import json
from pathlib import Path

from schemas import StoredDocument
from settings import Settings


class DocumentStore:
    def __init__(self, settings: Settings) -> None:
        self._path: Path = settings.registry_path
        if not self._path.exists():
            self._path.write_text("{}", encoding="utf-8")

    def _read(self) -> dict[str, dict]:
        raw = self._path.read_text(encoding="utf-8").strip()
        if not raw:
            return {}
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            return {}

    def _write(self, payload: dict[str, dict]) -> None:
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def upsert(self, document: StoredDocument) -> dict:
        payload = self._read()
        dumped = document.model_dump(mode="json")
        payload[document.document_id] = dumped
        self._write(payload)
        return dumped

    def get(self, document_id: str) -> dict | None:
        return self._read().get(document_id)

    def delete(self, document_id: str) -> dict | None:
        payload = self._read()
        document = payload.pop(document_id, None)
        self._write(payload)
        return document

    def list(self) -> list[dict]:
        payload = self._read()
        documents = list(payload.values())
        return sorted(
            documents,
            key=lambda item: item.get("created_at", ""),
            reverse=True,
        )
