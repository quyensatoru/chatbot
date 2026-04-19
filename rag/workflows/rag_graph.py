from __future__ import annotations

import unicodedata
from typing import Any, TypedDict

from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from retrievers.graph import GraphRAGRetriever
from retrievers.traditional import TraditionalRAGRetriever
from retrievers.tree import TreeRAGRetriever
from schemas import QueryRequest, QueryResponse, RetrievalResult
from settings import Settings
from utils import coerce_text, unique_preserve_order
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger(__name__)

class RAGState(TypedDict, total=False):
    query: str
    top_k: int
    requested_strategy: str | None
    chat_history: list[dict[str, str]]
    selected_strategies: list[str]
    traditional_result: dict[str, Any]
    tree_result: dict[str, Any]
    graph_result: dict[str, Any]
    answer: str
    confidence: float
    sources: list[str]


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return normalized.encode("ascii", "ignore").decode("ascii").lower()


class MultiStrategyRAGWorkflow:
    def __init__(
        self,
        settings: Settings,
        traditional: TraditionalRAGRetriever,
        tree: TreeRAGRetriever,
        graph: GraphRAGRetriever,
    ) -> None:
        self.settings = settings
        self.traditional = traditional
        self.tree = tree
        self.graph = graph
        self._model: ChatOpenAI | None = None
        self._app = self._build_graph()

    def _build_graph(self):
        graph = StateGraph(RAGState)
        graph.add_node("router", self._router_node)
        graph.add_node("traditional", self._traditional_node)
        graph.add_node("tree", self._tree_node)
        graph.add_node("graph", self._graph_node)
        graph.add_node("synthesis", self._synthesis_node)
        graph.add_edge(START, "router")
        graph.add_edge("router", "traditional")
        graph.add_edge("traditional", "tree")
        graph.add_edge("tree", "graph")
        graph.add_edge("graph", "synthesis")
        graph.add_edge("synthesis", END)
        return graph.compile()

    def _get_model(self) -> ChatOpenAI:
        if self._model is not None:
            return self._model
        self._model = ChatOpenAI(
            api_key=self.settings.openai_api_key,
            model=self.settings.openai_chat_model,
            temperature=0.2,
        )
        return self._model

    def _select_strategies(self, query: str, requested_strategy: str | None) -> list[str]:
        all_strategies = ["traditional", "tree", "graph"]

        if requested_strategy in all_strategies:
            return [requested_strategy]
        if requested_strategy == "all":
            return all_strategies

        lowered = _normalize_text(query)

        selected = ["traditional"]

        if any(x in lowered for x in ["tom tat", "tong quan", "overview", "so sanh"]):
            selected.append("tree")

        if any(x in lowered for x in ["moi quan he", "lien quan", "anh huong", "tai sao", "vi sao"]):
            selected.append("graph")

        if len(query.split()) > 12:
            return all_strategies

        if selected == ["traditional"]:
            selected.append("tree")

        return list(dict.fromkeys(selected))

    def _router_node(self, state: RAGState) -> dict[str, Any]:
        return {
            "selected_strategies": self._select_strategies(
                state["query"],
                state.get("requested_strategy"),
            )
        }

    def _traditional_node(self, state: RAGState) -> dict[str, Any]:
        if "traditional" not in state.get("selected_strategies", []):
            return {}
        return {
            "traditional_result": self.traditional.query(
                state["query"],
                top_k=state["top_k"],
            )
        }

    def _tree_node(self, state: RAGState) -> dict[str, Any]:
        if "tree" not in state.get("selected_strategies", []):
            return {}
        return {
            "tree_result": self.tree.query(
                state["query"],
                top_k=max(3, min(5, state["top_k"])),
            )
        }

    def _graph_node(self, state: RAGState) -> dict[str, Any]:
        if "graph" not in state.get("selected_strategies", []):
            return {}
        return {
            "graph_result": self.graph.query(
                state["query"],
                top_k=max(3, min(5, state["top_k"])),
            )
        }

    def _format_history(self, history: list[dict[str, str]]) -> str:
        if not history:
            return ""

        lines: list[str] = []
        for item in history[-6:]:
            role = item.get("role", "user").upper()
            content = item.get("content", "").strip()
            if content:
                lines.append(f"{role}: {content}")
        return "\n".join(lines)

    def _fallback_answer(self, query: str, contexts: list[str]) -> str:
        if not contexts:
            return (
                "I could not find relevant indexed context for this question. "
                "Try uploading more documents or rephrasing the query."
            )
        joined = "\n\n".join(contexts[:3])
        return f"Question: {query}\n\nRelevant context:\n{joined}"

    def _synthesis_node(self, state: RAGState) -> dict[str, Any]:
        result_keys = {
            "traditional": state.get("traditional_result"),
            "tree": state.get("tree_result"),
            "graph": state.get("graph_result"),
        }

        contexts: list[str] = []
        sources: list[str] = []
        confidence_parts: list[float] = []
        for name, result in result_keys.items():
            if not result or not result.get("hits"):
                continue
            confidence_parts.append(float(result.get("average_score", 0.0)))
            sources.extend(result.get("source_documents", []))
            snippet = result.get("summary") or "\n\n".join(
                hit["content"] for hit in result.get("hits", [])[:3]
            )
            contexts.append(f"[{name.upper()}]\n{snippet}")

        confidence = (
            sum(confidence_parts) / len(confidence_parts) if confidence_parts else 0.0
        )

        if not self.settings.openai_api_key:
            answer = self._fallback_answer(state["query"], contexts)
        else:
            prompt = f"""
You are a synthesis node inside a multi-strategy RAG system.
Answer the user's question using only the retrieved evidence below.

Conversation history:
{self._format_history(state.get("chat_history", []))}

Retrieved evidence:
{chr(10).join(contexts)}

Question:
{state["query"]}

Requirements:
- Answer in the same language as the user.
- Merge overlapping evidence from traditional, tree, and graph retrieval.
- If the evidence is incomplete, say so clearly.
- Keep the answer concise but useful.
""".strip()
            response = self._get_model().invoke(prompt)
            answer = coerce_text(response.content).strip()
            if not answer:
                answer = self._fallback_answer(state["query"], contexts)

        return {
            "answer": answer,
            "confidence": round(confidence, 4),
            "sources": unique_preserve_order(sources),
        }

    def invoke(self, request: QueryRequest) -> QueryResponse:
        initial_state: RAGState = {
            "query": request.query,
            "top_k": request.top_k,
            "requested_strategy": request.strategy,
            "chat_history": [message.model_dump() for message in request.chat_history],
        }
        result = self._app.invoke(initial_state)

        retrievals: dict[str, RetrievalResult] = {}
        for key, state_key in (
            ("traditional", "traditional_result"),
            ("tree", "tree_result"),
            ("graph", "graph_result"),
        ):
            raw = result.get(state_key)
            if raw:
                retrievals[key] = RetrievalResult.model_validate(raw)

        return QueryResponse(
            answer=result.get("answer", ""),
            confidence=float(result.get("confidence", 0.0)),
            sources=result.get("sources", []),
            selected_strategies=result.get("selected_strategies", []),
            retrievals=retrievals,
        )
