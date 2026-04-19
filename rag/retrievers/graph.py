from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from langchain_openai import ChatOpenAI
from neo4j import GraphDatabase

from settings import Settings
from utils import coerce_text, extract_json_array, normalize_key, unique_preserve_order


class GraphRAGRetriever:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._driver = None
        self._model: ChatOpenAI | None = None
        self._schema_initialized = False

    def _get_model(self) -> ChatOpenAI:
        if self._model is not None:
            return self._model
        self._model = ChatOpenAI(
            api_key=self.settings.openai_api_key,
            model=self.settings.openai_chat_model,
            temperature=0,
        )
        return self._model

    def _get_driver(self):
        if self._driver is not None:
            return self._driver
        self._driver = GraphDatabase.driver(
            self.settings.neo4j_uri,
            auth=(self.settings.neo4j_username, self.settings.neo4j_password),
        )
        return self._driver

    def _ensure_schema(self) -> None:
        if self._schema_initialized:
            return
        driver = self._get_driver()
        with driver.session() as session:
            session.run(
                "CREATE CONSTRAINT document_id IF NOT EXISTS "
                "FOR (d:Document) REQUIRE d.id IS UNIQUE"
            )
            session.run(
                "CREATE CONSTRAINT chunk_id IF NOT EXISTS "
                "FOR (c:Chunk) REQUIRE c.id IS UNIQUE"
            )
            session.run(
                "CREATE CONSTRAINT entity_key IF NOT EXISTS "
                "FOR (e:Entity) REQUIRE e.key IS UNIQUE"
            )
        self._schema_initialized = True

    def _fallback_triples(self, text: str) -> list[dict[str, str]]:
        matches = re.findall(
            r"\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2}\b",
            text,
        )
        entities = unique_preserve_order(matches)[: self.settings.graph_max_triples_per_chunk]
        triples: list[dict[str, str]] = []
        for left, right in zip(entities, entities[1:]):
            triples.append(
                {
                    "head": left,
                    "head_type": "Unknown",
                    "relation": "MENTIONS_WITH",
                    "tail": right,
                    "tail_type": "Unknown",
                }
            )
        return triples

    def _extract_triples(self, text: str) -> list[dict[str, str]]:
        if not self.settings.openai_api_key:
            return self._fallback_triples(text)

        prompt = f"""
Extract at most {self.settings.graph_max_triples_per_chunk} knowledge graph triples
from the text below.

Return JSON only as an array of objects with this schema:
[
  {{
    "head": "entity name",
    "head_type": "Person|Organization|Product|Concept|Event|Location|Unknown",
    "relation": "short upper snake case relation",
    "tail": "entity name",
    "tail_type": "Person|Organization|Product|Concept|Event|Location|Unknown"
  }}
]

Do not invent facts. Use an empty JSON array if nothing meaningful is found.

Text:
{text}
""".strip()
        response = self._get_model().invoke(prompt)
        triples = extract_json_array(coerce_text(response.content))
        if not triples:
            return self._fallback_triples(text)
        normalized: list[dict[str, str]] = []
        for triple in triples:
            head = str(triple.get("head", "")).strip()
            tail = str(triple.get("tail", "")).strip()
            relation = str(triple.get("relation", "")).strip().upper().replace(" ", "_")
            if not head or not tail or not relation:
                continue
            normalized.append(
                {
                    "head": head,
                    "head_type": str(triple.get("head_type", "Unknown")).strip() or "Unknown",
                    "relation": relation,
                    "tail": tail,
                    "tail_type": str(triple.get("tail_type", "Unknown")).strip() or "Unknown",
                }
            )
        return normalized

    def _extract_query_entities(self, query: str) -> list[str]:
        if not self.settings.openai_api_key:
            words = re.findall(r"\b[\w-]{4,}\b", query)
            return unique_preserve_order(words)[:3]

        prompt = f"""
Identify the most relevant entities or concepts in this query.
Return JSON only with this format:
{{"entities": ["entity 1", "entity 2", "entity 3"]}}

Query:
{query}
""".strip()
        response = self._get_model().invoke(prompt)
        text = coerce_text(response.content)
        entities = []
        if '"entities"' in text:
            from utils import extract_json_object

            data = extract_json_object(text)
            raw_entities = data.get("entities", [])
            if isinstance(raw_entities, list):
                entities = [str(item).strip() for item in raw_entities if str(item).strip()]
        return unique_preserve_order(entities)[:3] or unique_preserve_order(
            re.findall(r"\b[\w-]{4,}\b", query)
        )[:3]

    def index_document(
        self,
        *,
        document_id: str,
        title: str,
        source: str,
        chunks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        try:
            self._ensure_schema()
            driver = self._get_driver()
        except Exception as exc:
            return {"enabled": False, "reason": str(exc), "triple_count": 0}

        triple_count = 0
        now = datetime.now(timezone.utc).isoformat()
        with driver.session() as session:
            session.run(
                """
                MERGE (d:Document {id: $document_id})
                SET d.title = $title,
                    d.source = $source,
                    d.updated_at = $updated_at
                """,
                document_id=document_id,
                title=title,
                source=source,
                updated_at=now,
            )

            for index, chunk in enumerate(chunks):
                chunk_id = f"{document_id}:chunk:{index}"
                chunk_text = chunk["content"]
                session.run(
                    """
                    MERGE (d:Document {id: $document_id})
                    MERGE (c:Chunk {id: $chunk_id})
                    SET c.text = $text,
                        c.source = $source,
                        c.chunk_index = $chunk_index,
                        c.updated_at = $updated_at
                    MERGE (d)-[:HAS_CHUNK]->(c)
                    """,
                    document_id=document_id,
                    chunk_id=chunk_id,
                    text=chunk_text,
                    source=source,
                    chunk_index=index,
                    updated_at=now,
                )

                triples = self._extract_triples(chunk_text)
                for triple in triples:
                    triple_count += 1
                    session.run(
                        """
                        MERGE (head:Entity {key: $head_key})
                        ON CREATE SET head.name = $head_name, head.type = $head_type
                        SET head.updated_at = $updated_at

                        MERGE (tail:Entity {key: $tail_key})
                        ON CREATE SET tail.name = $tail_name, tail.type = $tail_type
                        SET tail.updated_at = $updated_at

                        MERGE (c:Chunk {id: $chunk_id})

                        WITH head, tail, c
                        MERGE (c)-[:MENTIONS]->(head)
                        MERGE (c)-[:MENTIONS]->(tail)

                        MERGE (head)-[r:RELATES_TO {
                        document_id: $document_id,
                        chunk_id: $chunk_id,
                        relation_type: $relation
                        }]->(tail)
                        SET r.evidence = $evidence,
                            r.document_title = $document_title,
                            r.updated_at = $updated_at
                        """,
                        head_key=normalize_key(triple["head"]),
                        head_name=triple["head"],
                        head_type=triple["head_type"],
                        tail_key=normalize_key(triple["tail"]),
                        tail_name=triple["tail"],
                        tail_type=triple["tail_type"],
                        chunk_id=chunk_id,
                        document_id=document_id,
                        document_title=title,
                        relation=triple["relation"],
                        evidence=chunk_text[:750],
                        updated_at=now,
                    )

        return {"enabled": True, "triple_count": triple_count}

    def query(self, query: str, top_k: int = 5) -> dict[str, Any]:
        try:
            self._ensure_schema()
            driver = self._get_driver()
        except Exception as exc:
            return {
                "strategy": "graph",
                "hits": [],
                "summary": None,
                "source_documents": [],
                "average_score": 0.0,
                "disabled_reason": str(exc),
            }

        entities = self._extract_query_entities(query)
        if not entities:
            return {
                "strategy": "graph",
                "hits": [],
                "summary": None,
                "source_documents": [],
                "average_score": 0.0,
            }

        hits = []
        sources: list[str] = []
        with driver.session() as session:
            records = session.run(
                """
                UNWIND $entities AS entity_name
                MATCH (head:Entity)-[r:RELATES_TO]->(tail:Entity)
                WHERE toLower(head.name) CONTAINS toLower(entity_name)
                   OR toLower(tail.name) CONTAINS toLower(entity_name)
                RETURN head.name AS head_name,
                       head.type AS head_type,
                       r.relation_type AS relation_type,
                       tail.name AS tail_name,
                       tail.type AS tail_type,
                       r.evidence AS evidence,
                       r.document_id AS document_id,
                       r.document_title AS document_title
                LIMIT $limit
                """,
                entities=entities,
                limit=top_k,
            )

            for rank, record in enumerate(records, start=1):
                score = max(0.0, min(1.0, 1.0 - ((rank - 1) * 0.08)))
                source = record.get("document_title") or record.get("document_id")
                if source:
                    sources.append(source)
                hits.append(
                    {
                        "strategy": "graph",
                        "content": (
                            f'{record.get("head_name")} ({record.get("head_type")}) '
                            f'-[{record.get("relation_type")}]-> '
                            f'{record.get("tail_name")} ({record.get("tail_type")}). '
                            f'Evidence: {record.get("evidence")}'
                        ),
                        "score": round(score, 4),
                        "source": source,
                        "metadata": {
                            "head": record.get("head_name"),
                            "relation": record.get("relation_type"),
                            "tail": record.get("tail_name"),
                        },
                    }
                )

        average_score = (
            sum(hit["score"] for hit in hits) / len(hits) if hits else 0.0
        )
        summary = "\n\n".join(hit["content"] for hit in hits[:3]) if hits else None
        return {
            "strategy": "graph",
            "hits": hits,
            "summary": summary,
            "source_documents": unique_preserve_order(sources),
            "average_score": round(average_score, 4),
        }

    def delete_document(self, document_id: str) -> None:
        try:
            self._ensure_schema()
            driver = self._get_driver()
        except Exception:
            return

        with driver.session() as session:
            session.run(
                """
                MATCH ()-[r:RELATES_TO {document_id: $document_id}]->()
                DELETE r
                """,
                document_id=document_id,
            )
            session.run(
                """
                MATCH (d:Document {id: $document_id})
                OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
                DETACH DELETE d, c
                """,
                document_id=document_id,
            )
            session.run(
                """
                MATCH (e:Entity)
                WHERE NOT (e)--()
                DELETE e
                """
            )
