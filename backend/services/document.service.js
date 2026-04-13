import documentModel from "../models/document.model.js";
import db from "../config/chorma.config.js";

const DocumentService = {
    find: async () => {
        return documentModel.find({}, {
            fileName: 1,
            fileSize: 1,
            chunks: 1,
        }).lean().exec();
    },

    delete: async (id) => {
        const doc = await documentModel.findById(id).lean().exec();
        const ids = doc.chunkIds || [];
        await db.documentCollection.delete({
            ids: ids
        })
        await documentModel.findByIdAndDelete(id);
    }
}

export default DocumentService;