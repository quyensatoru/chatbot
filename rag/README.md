# Multi-Strategy RAG Service (Traditional + Tree + Graph)

Phần này mô tả kế hoạch xây dựng service RAG nâng cao kết hợp 3 chiến lược: Traditional RAG, Tree RAG, và Graph RAG, sử dụng Python (Langchain, LangGraph) theo yêu cầu.

## User Review Required

> [!IMPORTANT]
> **Data Ingestion Flow**: Theo yêu cầu mới, toàn bộ quá trình xử lý tài liệu (upload, bóc tách bằng Unstructured, chunking) sẽ chuyển hẳn sang Python service. Backend Node.js sẽ gọi API của Python để thực hiện việc này.

> [!IMPORTANT]
> **Database**: Sẽ bổ sung **Neo4j** vào `docker-compose.yml` để phục vụ cho Graph RAG.

## Proposed Changes

Hệ thống RAG mới này sẽ được orchestate bằng **LangGraph**. LangGraph sẽ nhận câu hỏi, điều phối tới một Router. Router có thể chọn 1 trong 3 nhánh hoặc gọi song song cả 3 nhánh (Traditional, Tree, Graph), sau đó đưa kết quả vào một Synthesis Node (LLM kết hợp) để sinh ra câu trả lời cuối cùng.

---

### Python RAG Microservice (Mới)

Thư mục: `c:\Users\ADMIN\WebstormProjects\chatbot\agent\rag`

#### [NEW] [requirements.txt](file:///c:/Users/ADMIN/WebstormProjects/chatbot/agent/requirements.txt)
Chứa các thư viện Python dùng chung cho monolith: `fastapi`, `uvicorn`, `langchain`, `langgraph`, `langchain-openai`, `neo4j`, `chromadb`, `unstructured[all-docs]`, `python-multipart`.

#### [NEW] [main.py](file:///c:/Users/ADMIN/WebstormProjects/chatbot/agent/rag/main.py)
EntryPoint FastAPI với các routes:
- `POST /api/v1/rag/upload`: Nhận file, sử dụng `UnstructuredFileLoader` để bóc tách text, sau đó đưa vào pipeline indexing (Vector, Tree, Graph).
- `POST /api/v1/rag/query`: Nhận query và gọi LangGraph workflow.

#### [NEW] [workflows/rag_graph.py](file:///c:/Users/ADMIN/WebstormProjects/chatbot/agent/rag/workflows/rag_graph.py)
Logic LangGraph quản lý 3 chiến lược RAG.

#### [NEW] [retrievers/traditional.py](file:///c:/Users/ADMIN/WebstormProjects/chatbot/agent/rag/retrievers/traditional.py)
Traditional Vector RAG (ChromaDB).

#### [NEW] [retrievers/tree.py](file:///c:/Users/ADMIN/WebstormProjects/chatbot/agent/rag/retrievers/tree.py)
Tree-based RAG (RAPTOR style) - tóm tắt đa tầng.

#### [NEW] [retrievers/graph.py](file:///c:/Users/ADMIN/WebstormProjects/chatbot/agent/rag/retrievers/graph.py)
Knowledge Graph RAG (Neo4j).

---

### Infrastructure Updates

#### [MODIFY] [docker-compose.yml](file:///c:/Users/ADMIN/WebstormProjects/chatbot/agent/docker-compose.yml)
Thêm service `neo4j` với các cấu hình ports (7474, 7687) và volumes.

---

### Backend Updates

#### [MODIFY] [agent.service.js](file:///c:/Users/ADMIN/WebstormProjects/chatbot/agent/backend/services/agent.service.js)
Cập nhật để agent gọi tới Python RAG REST API.

## Open Questions

- **Authentication**: Chúng ta có cần bảo mật API giữa Node.js và Python không (ví dụ: API Key nội bộ)?
- **Unstructured Dependencies**: `unstructured` yêu cầu một số system dependencies (như `libmagic`, `poppler-utils`, `tesseract`). Tôi sẽ cung cấp hướng dẫn cài đặt hoặc Dockerfile để bao gói các dependency này.

## Verification Plan

### Automated Tests
- Test API upload với các định dạng PDF, Docx để kiểm tra tính ổn định của Unstructured.
- Test LangGraph với các query đòi hỏi kết hợp context từ nhiều nguồn.

### Manual Verification
- Kiểm tra giao diện Neo4j Browser để xác nhận thực thể và quan hệ được tạo đúng sau khi upload document. nội bộ của Python RAG Server `/api/v1/rag/query` với dummy payload để kiểm tra workflow có trigger đúng node trong LangGraph không.
- Test connection với Node.js Backend: Đảm bảo JS agent gọi fetch thành công, lấy được kết quả từ graph/tree/vector pipeline.

### Manual Verification
- Upload test document và theo dõi logs của Python service để xem dữ liệu có được phân rã thành nodes/edges (Graph) và trees không.
- Gửi các user query phức tạp (yêu cầu phân tích tổng quan - Tree, quan hệ giữa các thực thể - Graph, cụ thể chi tiết - Traditional) để kiểm chứng chất lượng sinh câu trả lời.
