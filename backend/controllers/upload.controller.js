import { date } from "zod/v4";
import VectorService from "../services/vector.service.js";
import * as path from "path";

const UploadController = {
    uploadFile: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const fileName = req.file.filename;
            const destination = req.file.destination;

            const pathFile = path.join(process.cwd(), destination, fileName);

            await VectorService.add(pathFile);

            return res.status(200).json({ 
                success: true, 
                data: {
                    _id: Date.now(),
                    fileName: req.file.originalname,
                    fileSize:  req.file.size,
                } 
            });
        } catch (err) {
            console.error("error: " + err);
            return res.status(500).json({ success: false, error: 'File upload failed' });
            
        }
    }
};

export default UploadController;