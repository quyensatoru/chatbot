import * as z from "zod";
import { Document, tool } from "langchain";
import { tavily } from "@tavily/core";
import dotenv from "dotenv";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { v4 as uuidV4 } from "uuid";
import { openChatModel } from "../config/llm.config.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SYSTEM_SUMMARY_PROMPT } from "../helper/prompt.js";
import { ChromaDB } from "../config/chorma.config.js";

dotenv.config();

const separators = [
    "\n## ",
    "\n### ",
    "\n#### ",
    "\n###",
    "\n##",
    "\n#",
    "```",
    "\n1)", "\n2)", "\n3)", "\n4)",
    "\n\n",
    "\n",
    ". ", "? ", "! ",
    "; ", ": ",
    ", ",
    " ",
    "",
];

const WebSearchInput = z.object({
    query: z.string().min(1).describe("Search query string to perform a web search."),
});

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

const web_search = tool(
    async ({ query }) => {
        try {
            const db = await ChromaDB();
            const results = await performWebSearch(query);

            const documents = results.map((result) => new Document({
                pageContent: result.content,
                metadata: {
                    source: result.url,
                },
            }));

            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 500,
                chunkOverlap: 120,
                separators,
            });

            const chunks = await splitter.splitDocuments(documents);
            const texts = chunks.map((chunk) => chunk.pageContent);
            const metadatas = chunks.map((chunk) => ({
                source: chunk.metadata.source,
                loc_page_from: chunk.metadata.source?.lines?.from,
                loc_page_to: chunk.metadata.source?.lines?.to,
            }));
            const ids = chunks.map(() => uuidV4());

            await db.searchCollection.add({
                ids,
                documents: texts,
                metadatas,
            });

            const context = await db.searchCollection.query({
                queryTexts: [query],
                topK: 20,
                includeMetadata: true,
                nResults: 10,
                include: ["documents", "metadatas", "distances"],
            });

            const docs = context.documents[0].join("\n");
            const template = ChatPromptTemplate.fromMessages([
                ["system", SYSTEM_SUMMARY_PROMPT],
                [
                    "user",
                    `Based on the following documents:
{context}
Answer this question: {question}
Provide a clear, accurate response.
`,
                ],
            ]);

            const chain = template.pipe(openChatModel);
            const message = await chain.invoke({
                context: docs,
                question: query,
            });

            await db.searchCollection.delete({ ids });
            return message.content;
        } catch (error) {
            console.error(error);
            return "Could not search web";
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
    });
    return result.results;
}

export const searchTools = [web_search]