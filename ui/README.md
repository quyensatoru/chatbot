# Chatbot UI

A React-based RAG (Retrieval Augmented Generation) chatbot UI with document upload capabilities.

## Features

- 📄 Document Upload: Upload PDF, DOCX, TXT, and Markdown files
- 💬 Chat Interface: Real-time chat with the AI assistant
- 📊 Document Management: View and delete uploaded documents
- 🔍 RAG Support: Query documents using retrieval augmented generation

## Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_API_URL=http://localhost:3000
```

## Structure

```
src/
├── App.jsx              # Main application component
├── main.jsx             # React entry point
├── index.css            # Global styles
├── components/
│   ├── ChatInterface.jsx    # Chat component
│   ├── DocumentUpload.jsx   # Upload component
│   ├── DocumentList.jsx     # Document list component
│   └── MessageBubble.jsx    # Message display component
└── services/
    └── api.js           # API client
```

## API Routes

- `POST /api/upload` - Upload document
- `GET /api/documents` - List documents
- `DELETE /api/documents/:id` - Delete document
- `POST /api/chat` - Send chat message
- `GET /api/chat/:conversationId` - Get chat history
