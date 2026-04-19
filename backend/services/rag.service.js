import fs from "fs/promises";
import * as dotenv from "dotenv"
dotenv.config()

const baseUrl = (process.env.RAG_SERVICE_URL || "http://localhost:8001").replace(/\/$/, "");
const timeoutMs = Number.parseInt(process.env.RAG_SERVICE_TIMEOUT || "60000", 10);

const buildHeaders = (headers = {}) => {
    const normalizedHeaders = { ...headers };

    if (process.env.RAG_API_KEY) {
        normalizedHeaders["x-api-key"] = process.env.RAG_API_KEY;
    }

    return normalizedHeaders;
};

const normalizeRole = (role) => {
    if (role === "ai" || role === "assistant" || role === "bot") {
        return "assistant";
    }

    if (role === "system") {
        return "system";
    }

    return "user";
};

const normalizeHistory = (chatHistory = []) => {
    return chatHistory
        .filter((message) => message?.content)
        .map((message) => ({
            role: normalizeRole(message.role),
            content: String(message.content).trim(),
        }))
        .filter((message) => message.content.length > 0);
};

const parseResponse = async (response) => {
    const raw = await response.text();

    if (!raw) {
        return {};
    }

    try {
        return JSON.parse(raw);
    } catch {
        return { raw };
    }
};

const request = async (path, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        console.log(`${baseUrl}${path}`)
        const response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: buildHeaders(options.headers),
            signal: controller.signal,
        });

        const payload = await parseResponse(response);

        if (!response.ok) {
            throw new Error(
                payload?.detail ||
                payload?.error ||
                payload?.message ||
                `RAG service request failed with status ${response.status}`
            );
        }

        return payload;
    } finally {
        clearTimeout(timer);
    }
};

const RagService = {
    upload: async ({ filePath, fileName, mimeType }) => {
        const buffer = await fs.readFile(filePath);
        const formData = new FormData();

        formData.append(
            "file",
            new Blob([buffer], {
                type: mimeType || "application/octet-stream",
            }),
            fileName,
        );

        return request("/api/v1/rag/upload", {
            method: "POST",
            body: formData,
        });
    },

    query: async ({ query, topK = 5, strategy, chatHistory = [] }) => {
        return request("/api/v1/rag/query", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                top_k: topK,
                strategy,
                chat_history: normalizeHistory(chatHistory),
            }),
        });
    },

    deleteDocument: async (documentId) => {
        return request(`/api/v1/rag/documents/${documentId}`, {
            method: "DELETE",
        });
    },
};

export default RagService;
