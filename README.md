# Mattermost Agent

AI Agent tự động tích hợp với Mattermost, có khả năng thực hiện các tác vụ phức tạp qua ngôn ngữ tự nhiên. Hệ thống kết hợp LLM (GPT-4o), RAG đa chiến lược, và hơn 60 công cụ tích hợp để tự động hóa công việc hàng ngày.

---

## Tính năng nổi bật

- **Mattermost Bot** — nhận lệnh trực tiếp từ chat, trả lời và thực thi công việc
- **14 nhóm công cụ / 60+ tools** — lịch, email, tasks, file, tìm kiếm web, tài chính, QR, dịch thuật...
- **RAG đa chiến lược** — Traditional (semantic), Tree (phân cấp), Graph (tri thức) để truy vấn tài liệu thông minh
- **Automation / Cron Jobs** — tạo job định kỳ bằng ngôn ngữ tự nhiên, persistent qua restart
- **Scheduled Messages** — lên lịch gửi tin nhắn Mattermost tương lai
- **Web UI** — quản lý tài liệu và chat trực tiếp với agent
- **Conversation Memory** — duy trì ngữ cảnh hội thoại qua nhiều lượt

---

## Kiến trúc hệ thống

```
┌─────────────────┐     WebSocket      ┌─────────────────────────┐
│   Mattermost    │ ←───────────────── │   Backend (Node.js)     │
│   Chat Platform │ ───────────────→   │   Express + LangChain   │
└─────────────────┘                    │                         │
                                       │   ┌─────────────────┐   │
┌─────────────────┐     HTTP/REST      │   │   AI Agent      │   │
│   Web UI        │ ←───────────────── │   │   GPT-4o        │   │
│   React + Vite  │ ───────────────→   │   │   60+ Tools     │   │
└─────────────────┘                    │   └────────┬────────┘   │
                                       └────────────│────────────┘
                                                    │
                          ┌─────────────────────────┼──────────────┐
                          │                         │              │
                   ┌──────▼──────┐          ┌───────▼──────┐  ┌───▼─────┐
                   │  RAG Service │          │   MongoDB    │  │  Chroma │
                   │  FastAPI     │          │   Chat Hist  │  │  Vector │
                   │  Python      │          └──────────────┘  │  DB     │
                   │  Port 8001   │                            └─────────┘
                   └──────┬───────┘
                          │
              ┌───────────┼───────────┐
       ┌──────▼─────┐ ┌──▼──────┐ ┌──▼──────┐
       │Traditional │ │  Tree   │ │  Graph  │
       │  Chroma    │ │  Chroma │ │  Neo4j  │
       └────────────┘ └─────────┘ └─────────┘
```

---

## Tech Stack

| Layer           | Công nghệ                        |
| --------------- | -------------------------------- |
| **LLM**         | OpenAI GPT-4o, LangChain         |
| **Backend**     | Node.js, Express 5, LangChain JS |
| **RAG Service** | Python, FastAPI, Uvicorn         |
| **Vector DB**   | ChromaDB                         |
| **Graph DB**    | Neo4j                            |
| **Database**    | MongoDB + Mongoose               |
| **Scheduling**  | node-cron                        |
| **Validation**  | Zod                              |
| **Logging**     | Winston                          |
| **Frontend**    | React 19, Vite, Axios            |
| **Embeddings**  | OpenAI text-embedding-3-small    |
| **Container**   | Docker + Docker Compose          |

---

## Cấu trúc thư mục

```
mattermost-agent/
├── backend/
│   ├── config/           # Cấu hình agent, LLM, Mattermost, DB
│   ├── controllers/      # Request handlers (chat, document, upload, health)
│   ├── services/         # Business logic (agent, RAG, vector, memory)
│   ├── tools/            # 14 nhóm công cụ AI
│   │   ├── calendar.js       # Cal.com — lịch & booking
│   │   ├── email.js          # SMTP/IMAP — gửi/đọc email
│   │   ├── task_execute.js   # Notion — quản lý task
│   │   ├── message_chat.js   # Mattermost messaging & scheduling
│   │   ├── automation.js     # Cron job automation
│   │   ├── file.js           # Thao tác file
│   │   ├── document_rag.js   # Truy vấn tài liệu RAG
│   │   ├── web_search.js     # Tavily web search
│   │   ├── finance.js        # Google Sheets — theo dõi chi tiêu
│   │   ├── utility.js        # Dịch thuật, QR, rút gọn URL
│   │   ├── api_call.js       # HTTP calls tùy ý
│   │   ├── calculate_math.js # Toán học (Math.js)
│   │   └── current_time.js   # Thời gian theo múi giờ
│   ├── models/           # MongoDB schemas
│   ├── routers/          # Express routes
│   ├── middleware/       # Auth, error handling
│   ├── helper/           # Storage, system prompt
│   └── server.js         # Entry point
│
├── rag/                  # Python RAG microservice
│   ├── main.py           # FastAPI app
│   ├── retrievers/       # Traditional, Tree, Graph
│   ├── services/         # Ingestion, document store
│   ├── workflows/        # Multi-strategy orchestration
│   └── data/             # Chroma persistent storage
│
├── ui/                   # React frontend
│   └── src/
│       ├── components/   # ChatInterface, DocumentUpload, DocumentList
│       └── services/     # API client
│
├── data/                 # Runtime: automations.json, scheduled_messages.json
├── logs/                 # Winston log files
├── uploads/              # File uploads
├── .env.example          # Mẫu cấu hình
├── docker-compose.yml
└── package.json
```

---

## Công cụ (Tools)

| Nhóm             | Mô tả                                                               |
| ---------------- | ------------------------------------------------------------------- |
| **Calendar**     | Tạo/xem/cập nhật/xóa lịch hẹn qua Cal.com API                       |
| **Email**        | Gửi, đọc, tìm kiếm, nháp email qua SMTP/IMAP                        |
| **Tasks**        | Tạo và quản lý task, ghi chú trên Notion                            |
| **Messaging**    | Gửi tin nhắn, thông báo, ảnh, lên lịch gửi trên Mattermost          |
| **Automation**   | Tạo cron job định kỳ bằng ngôn ngữ tự nhiên, persistent qua restart |
| **File**         | Liệt kê, tìm kiếm, đọc, viết file trên hệ thống                     |
| **Document RAG** | Truy vấn tài liệu đã index bằng RAG đa chiến lược                   |
| **Web Search**   | Tìm kiếm internet realtime qua Tavily                               |
| **Finance**      | Ghi chép và xem chi tiêu qua Google Sheets                          |
| **Utility**      | Dịch thuật, rút gọn URL, tạo QR code, chuyển đổi múi giờ            |
| **Math**         | Tính toán biểu thức phức tạp bằng Math.js                           |
| **Time**         | Lấy giờ hiện tại theo múi giờ bất kỳ                                |
| **API Call**     | Thực hiện HTTP request (GET/POST/PUT/PATCH/DELETE) tùy ý            |

---

## RAG — Hệ thống tìm kiếm tài liệu

Ba chiến lược retrieval được kết hợp tự động:

| Chiến lược      | Cơ chế                                               | Phù hợp nhất                       |
| --------------- | ---------------------------------------------------- | ---------------------------------- |
| **Traditional** | Semantic search với OpenAI embeddings + Chroma       | Câu hỏi chung, tìm kiếm nhanh      |
| **Tree**        | Phân cấp tài liệu, tóm tắt theo tầng                 | Tài liệu dài, cần tổng quan        |
| **Graph**       | Knowledge graph (Neo4j), trích xuất entity + quan hệ | Câu hỏi thực thể, quan hệ phức tạp |

**Định dạng tài liệu hỗ trợ:** PDF, DOCX, TXT, Markdown, JSON, CSV

---

## Automation (Cron Jobs)

Agent có thể tạo automation job bằng ngôn ngữ tự nhiên:

```
"Mỗi ngày 9 giờ sáng kiểm tra email mới và tóm tắt"
"Mỗi 30 phút nhắc nhở nghỉ mắt"
"Thứ 2 hàng tuần lúc 8h tổng hợp task tuần mới"
```

Các preset lịch có sẵn: `every_5min`, `every_30min`, `every_hour`, `daily_9am`, `weekdays_9am`, `monday_9am`... hoặc dùng cron expression tùy ý.

Jobs được lưu vào `data/automations.json` và tự động khôi phục sau server restart.

---

## Cài đặt & Chạy

### Yêu cầu

- Node.js >= 18
- Python >= 3.10
- MongoDB
- ChromaDB
- Neo4j (tùy chọn — dùng Graph RAG)

### 1. Clone & cài dependencies

```bash
git clone <repo-url>
cd mattermost-agent

# Node dependencies
npm install

# Python dependencies (cho RAG service)
cd rag && pip install -r requirements.txt && cd ..
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Chỉnh sửa `.env` với các giá trị thực:

```env
PORT=3000

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Mattermost
MATTERMOST_BOT_URL=http://your-mattermost/api/v4/posts
MATTERMOST_CHANNEL_ID=your-channel-id

# MongoDB
MONGODB_URI=mongodb://localhost:27017/mattermost-agent

# Tavily (web search)
TAVILY_API_KEY=tvly-...

# Email (SMTP/IMAP)
EMAIL_USER=your@email.com
EMAIL_PASSWORD=your-password

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Neo4j (Graph RAG - tùy chọn)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
```

### 3. Chạy tất cả services

```bash
npm run dev
```

Lệnh này chạy đồng thời:

- **Backend API** → http://localhost:3000
- **RAG Service** → http://localhost:8001
- **Web UI** → http://localhost:5173

### Chạy riêng từng service

```bash
npm run dev:server   # Chỉ backend
npm run dev:rag      # Chỉ RAG service
npm run dev:ui       # Chỉ UI
```

### Docker (tùy chọn)

```bash
docker-compose up -d
```

---

## API Endpoints

### Chat & Agent

| Method | Endpoint          | Mô tả                                  |
| ------ | ----------------- | -------------------------------------- |
| `POST` | `/api/chat`       | Chat đơn giản với RAG (không có tools) |
| `POST` | `/api/chat/agent` | Agent đầy đủ với 60+ tools             |
| `GET`  | `/api/health`     | Health check                           |

#### POST `/api/chat/agent`

```json
// Request
{
  "query": "Gửi email cho john@example.com về cuộc họp ngày mai lúc 9h",
  "conversationId": "uuid-optional"
}

// Response
{
  "success": true,
  "data": {
    "response": {
      "id": "uuid",
      "answer": "Đã gửi email thành công đến john@example.com.",
      "conversationId": "uuid",
      "timestamp": "2026-04-20T09:00:00.000Z"
    }
  }
}
```

#### POST `/api/chat` (RAG query)

```json
// Request
{
  "query": "Doanh thu Q4 là bao nhiêu?",
  "strategy": "traditional"
}

// Response
{
  "success": true,
  "data": {
    "response": {
      "answer": "Doanh thu Q4 tăng 15% so với cùng kỳ...",
      "confidence": 0.92,
      "sources": ["bao-cao-2024.pdf"]
    }
  }
}
```

### Tài liệu

| Method   | Endpoint             | Mô tả                       |
| -------- | -------------------- | --------------------------- |
| `POST`   | `/api/upload`        | Upload tài liệu vào RAG     |
| `GET`    | `/api/documents`     | Danh sách tài liệu đã index |
| `DELETE` | `/api/documents/:id` | Xóa tài liệu                |

---

## Tích hợp bên ngoài

| Dịch vụ         | Mục đích          | Biến env cần thiết                              |
| --------------- | ----------------- | ----------------------------------------------- |
| **OpenAI**      | LLM + embeddings  | `OPENAI_API_KEY`                                |
| **Mattermost**  | Chat bot          | `MATTERMOST_BOT_URL`, `MATTERMOST_CHANNEL_ID`   |
| **MongoDB**     | Lịch sử hội thoại | `MONGODB_URI`                                   |
| **ChromaDB**    | Vector database   | `CHROMA_HOST`, `CHROMA_PORT`                    |
| **Neo4j**       | Graph retrieval   | `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` |
| **Tavily**      | Tìm kiếm web      | `TAVILY_API_KEY`                                |
| **Google APIs** | Calendar, Sheets  | OAuth2 credentials                              |
| **Notion**      | Task management   | `NOTION_API_KEY`                                |
| **Cal.com**     | Scheduling        | `CAL_API`                                       |
| **Gmail/SMTP**  | Email             | `EMAIL_USER`, `EMAIL_PASSWORD`                  |

---

## Logs

Logs được ghi bởi Winston vào thư mục `logs/`:

```
logs/
├── agent-2026-04-20.log    # Log theo ngày
└── ...
```

---

## Lưu ý

- **Conversation memory** lưu in-memory (mất khi restart server). Dữ liệu hội thoại dài hạn cần dùng MongoDB session.
- **Automation jobs** và **Scheduled messages** được persist vào `data/` và tự khôi phục sau restart.
- Agent sử dụng persona **"Gojo Satoru"** — trả lời bằng tiếng Việt, chủ động thực thi không hỏi lại.
