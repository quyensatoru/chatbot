import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import { JSONLoader } from '@langchain/classic/document_loaders/fs/json';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import fs from 'fs/promises';

import { ChromaDB } from '../config/chorma.config.js';
import documentModel from '../models/document.model.js';

export const separators = [
    '\n## ',
    '\n### ',
    '\n#### ',
    '\n###',
    '\n##',
    '\n#',
    '```',
    '\n1)',
    '\n2)',
    '\n3)',
    '\n4)',
    '\n\n',
    '\n',
    '. ',
    '? ',
    '! ',
    '; ',
    ': ',
    ', ',
    ' ',
    '',
];

const VectorService = {
    add: async (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        let loader;

        const chunkSize = ext === '.pdf' ? 600 : 900;
        const chunkOverlap = ext === '.pdf' ? 150 : 200;

        switch (ext) {
            case '.pdf':
                loader = new PDFLoader(filePath);
                break;

            case '.docx':
            case '.doc':
                loader = new DocxLoader(filePath);
                break;

            case '.txt':
            case '.md':
            case '.markdown':
                loader = new TextLoader(filePath);
                break;

            case '.json':
                loader = new JSONLoader(filePath);
                break;

            case '.csv':
                loader = new CSVLoader(filePath);
                break;

            default:
                throw new Error(`Unsupported file type: ${ext}`);
        }

        const docs = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap,
            separators,
        });
        const allSplits = await splitter.splitDocuments(docs);
        const texts = allSplits.map((doc) => doc.pageContent);
        const metadatas = allSplits.map((doc) => ({
            source: doc.metadata.source ?? '',
            pdf_version: doc.metadata.pdf?.version ?? '',
            pdf_pages: doc.metadata.pdf?.numPages ?? 0,
            loc_page: doc.metadata.loc?.pageNumber ?? 0,
            loc_lines_from: doc.metadata.loc?.lines?.from ?? 0,
            loc_lines_to: doc.metadata.loc?.lines?.to ?? 0,
        }));
        const docIds = allSplits.map(() => uuidv4());
        const db = await ChromaDB();

        await db.documentCollection.add({
            ids: docIds,
            documents: texts,
            metadatas,
        });

        const fileStats = await fs.stat(filePath);

        await documentModel.create({
            fileName: path.basename(filePath),
            filePath,
            mimeType: ext,
            fileSize: (fileStats.size / 1024).toFixed(2),
            chunks: allSplits.length,
            chunkIds: docIds,
        });
    },

    query: async ({ query, topK = 5 }) => {
        try {
            const db = await ChromaDB();
            const context = await db.documentCollection.query({
                queryTexts: [query],
                topK: topK * 2,
                includeMetadata: true,
                nResults: topK,
                include: ['documents', 'metadatas', 'distances'],
            });

            const sources = [
                ...new Set(context.metadatas[0].map((item) => path.basename(item.source || item.fileName))),
            ];

            const validDistances = context.distances[0]?.filter((distance) => distance !== null);
            const averageDistance = validDistances?.length
                ? validDistances.reduce((left, right) => left + right, 0) / validDistances.length
                : 1;
            const confidence = Math.max(0, Math.min(1, 1 - averageDistance / 2));
            const document = context.documents[0].join('\n\n');

            return {
                document,
                sources,
                confidence,
            };
        } catch (error) {
            console.error(error);
        }
    },

    deleteCollection: async (name) => {
        const db = await ChromaDB();
        await db.chroma.deleteCollection({
            name,
        });
    },
};

export default VectorService;
