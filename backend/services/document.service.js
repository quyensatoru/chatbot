import documentModel from '../models/document.model.js';
import { ChromaDB } from '../config/chorma.config.js';
import RagService from './rag.service.js';

const DocumentService = {
    find: async () => {
        return documentModel
            .find(
                {},
                {
                    fileName: 1,
                    fileSize: 1,
                    chunks: 1,
                    indexedStrategies: 1,
                },
            )
            .lean()
            .exec();
    },

    delete: async (id) => {
        const doc = await documentModel.findById(id).lean().exec();
        if (!doc) {
            throw new Error('Document not found');
        }

        if (doc.externalDocumentId) {
            await RagService.deleteDocument(doc.externalDocumentId);
            await documentModel.findByIdAndDelete(id);
            return;
        }

        const ids = doc.chunkIds || [];
        if (ids.length) {
            const db = await ChromaDB();
            await db.documentCollection.delete({
                ids,
            });
        }

        await documentModel.findByIdAndDelete(id);
    },
};

export default DocumentService;
