import { Router } from 'express';
import UploadController from '../controllers/upload.controller.js';
import multer from 'multer';
import fs from 'fs';
import * as path from 'path';

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = process.env.UPLOAD_DIR || './uploads';
            // Tạo folder nếu không tồn tại
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        },
    }),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB default
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not supported`));
        }
    },
});

const UploadRouter = Router();

UploadRouter.post('/', upload.single('file'), UploadController.uploadFile);

export default UploadRouter;
