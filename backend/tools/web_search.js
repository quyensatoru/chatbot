import * as z from "zod";
import { Document, tool } from "langchain";
import { tavily } from "@tavily/core";
import dotenv from "dotenv";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { separators } from "../services/vector.service.js";
import { v4 as uuidV4 } from "uuid"
import documentModel from "../models/document.model.js";
import { openChatModel } from "../config/llm.config.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SYSTEM_SUMMARY_PROMPT } from "../helper/prompt.js";
import db from "../config/chorma.config.js";

dotenv.config();

const WebSearchInput = z.object({
    query: z.string().min(1).describe("Search query string to perform a web search."),
});

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

export const web_search = tool(
    async ({ query }) => {
        try {
            const results = await performWebSearch(query);

            const documents = results.map(r => new Document({ 
                pageContent: r.content,
                metadata: {
                    source: r.url
                }
            }));

            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 500,
                chunkOverlap: 120,
                separators: separators
            })

            const chunks = await splitter.splitDocuments(documents);

            const texts = chunks.map(c => c.pageContent);

            const metadatas = chunks.map(c => ({
                source: c.metadata.source,
                loc_page_from: c.metadata.source?.lines?.from,
                loc_page_to: c.metadata.source?.lines?.to
            }));

            const ids = chunks.map(() => uuidV4())

            //index to vectordb

            await db.searchCollection.add({
                ids: ids,
                documents: texts,
                metadatas,
            })

            const context = await db.searchCollection.query({
                queryTexts: [query],
                topK: 10 * 2,
                includeMetadata: true,
                nResults: 10,
                include: ['documents', 'metadatas', 'distances'],
            })

            const docs = context.documents[0].join("\n");

            //search topK from vectordb and inject to llm
            const template = ChatPromptTemplate.fromMessages([
                ["system", SYSTEM_SUMMARY_PROMPT],
                ["user", `Based on the following documents:
    {context}
    Answer this question: {question}
    Provide a clear, accurate response.
    `]
            ]);

            const chain = template.pipe(openChatModel);

            const m = await chain.invoke({
                context: docs,
                question: query,
            })

            //remove after search vectorDB
            await db.searchCollection.delete({
                ids: ids
            })
            return m.content
        } catch (e) {
            console.error(e)
            return "Could not search web"
        }
    },
    {
        name: "web_search",
        description: "Performs web searches. Call this tool when you need to retrieve information from the web. Returns a list of search results with titles and URLs.",
        schema: WebSearchInput,
    }
);

async function performWebSearch(query) {
    const result = await client.search(query, {
        maxResults: 10,
        maxTokens: 1000,
    })
    return result.results;
}