import { ChromaClient } from "chromadb";
import { embeddingModel } from "./llm.config.js";

let instance = {
    documentCollection: null,
    metadataCollection: null,
    chroma: null,
};

const chromaEmbedder = {
    generate: async (texts) => {
        return await embeddingModel.embedDocuments(texts);
    },
};

/**
 * @typedef {Object} ChromaDBInstance
 * @property {import("chromadb").ChromaClient} chroma
 * @property {import("chromadb").Collection} documentCollection
 * @property {import("chromadb").Collection} searchCollection
 */

/**
 * @returns {Promise<ChromaDBInstance>}
 */
export const ChromaDB = async () => {
    if (instance.chroma) {
        return instance;
    }

    const chroma = new ChromaClient({
        host: process.env.CHROMA_HOST || "localhost",
        port: process.env.CHROMA_PORT || 8000,
        database: process.env.CHROMA_DB,
    });

    console.log("ChromaDB vector DB connected");

    const documentCollection = await chroma.getOrCreateCollection({
        name: "document",
        embeddingFunction: chromaEmbedder,
    });

    const searchCollection = await chroma.getOrCreateCollection({
        name: "search",
    });

    instance = {
        chroma,
        documentCollection,
        searchCollection,
    };

    return instance;
};
