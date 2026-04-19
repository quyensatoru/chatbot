import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const DocumentSchema = new Schema({
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    chunks: { type: Number, required: true },
    chunkIds: [{ type: String }],
    externalDocumentId: { type: String, index: true },
    indexedStrategies: [{ type: String }],
}, {
    timestamps: true,
    versionKey: false
});

const documentModel = mongoose.model('Document', DocumentSchema);

export default documentModel;
