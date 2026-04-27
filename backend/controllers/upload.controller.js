import documentModel from '../models/document.model.js';
import * as path from 'path';
import RagService from '../services/rag.service.js';

const UploadController = {
    uploadFile: async (req, res) => {
        let ragDocument = null;

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const pathFile = path.isAbsolute(req.file.path)
                ? req.file.path
                : path.join(process.cwd(), req.file.path);

            ragDocument = await RagService.upload({
                filePath: pathFile,
                fileName: req.file.originalname,
                mimeType: req.file.mimetype,
            });

            const document = await documentModel.create({
                fileName: req.file.originalname,
                filePath: pathFile,
                mimeType: req.file.mimetype,
                fileSize: req.file.size,
                chunks: ragDocument.chunk_count || 0,
                chunkIds: [],
                externalDocumentId: ragDocument.document_id,
                indexedStrategies: ragDocument.indexed_strategies || [],
            });

            return res.status(200).json({
                success: true,
                data: {
                    _id: document._id,
                    fileName: document.fileName,
                    fileSize: document.fileSize,
                    externalDocumentId: document.externalDocumentId,
                    indexedStrategies: document.indexedStrategies,
                },
            });
        } catch (err) {
            if (ragDocument?.document_id) {
                try {
                    await RagService.deleteDocument(ragDocument.document_id);
                } catch (rollbackError) {
                    console.error('RAG rollback failed:', rollbackError.message);
                }
            }
            console.error('error: ' + err);
            return res.status(500).json({ success: false, error: 'File upload failed' });
        }
    },
};

export default UploadController;
