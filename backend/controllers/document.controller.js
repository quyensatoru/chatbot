import DocumentService from "../services/document.service.js";

const DocumentController = {
    all: async (req, res) => {
        try {
            const documents = await DocumentService.find();
            return res.status(200).json({ success: true, data: documents });
        } catch (err) {
            console.error("error: " + err.message);
            return res.status(500).json({ success: false, error: 'Document failed' });
        }
    },
    deleteByDocId: async (req, res) => {
        try {
            const { id } = req.params;
            await DocumentService.delete(id);
            return res.status(200).json({ success: true, message: `Document ${id} deleted successfully` });
        } catch (err) {
            console.error("error: " + err.message);
            return res.status(500).json({ success: false, error: 'Delete collection failed' });
        }
    }
}

export default DocumentController;
