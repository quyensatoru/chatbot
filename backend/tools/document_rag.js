import { tool } from "langchain";
import VectorService from "../services/vector.service.js";
import * as z from "zod";

const retrieve = async (input) => await VectorService.query(input);

export const document_rag = tool(retrieve, {
    name: "document_rag",
    description: `Retrieve relevant information from the document knowledge base (RAG system).

This tool MUST be used whenever the user asks about:
- Personal information
- Data contained in documents
- Any factual detail that could exist in stored files

The tool performs semantic search over documents and returns the most relevant text chunks.

IMPORTANT:
- This is the primary source of truth for all document-related questions
- Do NOT answer from memory if the question is about documents
- Always call this tool first before answering document-related queries`,
    schema: z.object({
        query: z.string().describe("User query to search relevant documents"),
        top_k: z
            .number()
            .optional()
            .default(5)
            .describe("Number of chunks to return"),
    }),
})