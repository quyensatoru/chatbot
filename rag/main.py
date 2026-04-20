from __future__ import annotations

import os
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from retrievers.graph import GraphRAGRetriever
from retrievers.traditional import TraditionalRAGRetriever
from retrievers.tree import TreeRAGRetriever
from schemas import DeleteResponse, QueryRequest, QueryResponse, UploadResponse
from services.document_store import DocumentStore
from services.ingestion import IngestionService
from settings import get_settings
from workflows.rag_graph import MultiStrategyRAGWorkflow

settings = get_settings()
document_store = DocumentStore(settings)
traditional_retriever = TraditionalRAGRetriever(settings)
tree_retriever = TreeRAGRetriever(settings)
graph_retriever = GraphRAGRetriever(settings)
ingestion_service = IngestionService(
    settings=settings,
    document_store=document_store,
    traditional=traditional_retriever,
    tree=tree_retriever,
    graph=graph_retriever,
)
workflow = MultiStrategyRAGWorkflow(
    settings=settings,
    traditional=traditional_retriever,
    tree=tree_retriever,
    graph=graph_retriever,
)

app = FastAPI(
    title="Multi-Strategy RAG Service",
    version="0.1.0",
    description="Traditional + Tree + Graph RAG microservice",
)


@app.middleware("http")
async def verify_internal_api_key(request: Request, call_next):
    expected_key = settings.rag_internal_api_key
    if (
        expected_key
        and request.url.path.startswith("/api/v1/rag")
        and request.headers.get("x-api-key") != expected_key
    ):
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)


def _save_upload(file: UploadFile) -> Path:
    original_name = Path(file.filename or "upload.bin").name
    destination = settings.upload_dir / f"{uuid4()}-{original_name}"
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return destination


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.post("/api/v1/rag/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name.")

    try:
        saved_path = _save_upload(file)
        file_size = saved_path.stat().st_size
        response = ingestion_service.index_file(
            saved_path,
            file_name=Path(file.filename).name,
            mime_type=file.content_type or "application/octet-stream",
            file_size=file_size,
        )
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        await file.close()


@app.post("/api/v1/rag/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    try:
        normalized_request = request.model_copy(
            update={"top_k": request.top_k or settings.default_top_k}
        )
        return workflow.invoke(normalized_request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/v1/rag/documents")
async def list_documents():
    return {"documents": ingestion_service.list_documents()}



@app.delete("/api/v1/rag/documents/{document_id}", response_model=DeleteResponse)
async def delete_document(document_id: str):
    try:
        deleted = ingestion_service.delete_document(document_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Document not found.")
        return DeleteResponse(document_id=document_id, deleted=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    rag_dir = os.path.dirname(os.path.abspath(__file__))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("RAG_PORT", "8001")),
        reload=True,
        reload_dirs=[rag_dir],
        reload_includes=["*.py"],
        reload_excludes=[
            "data/*",
            "__pycache__",
        ],
    )
