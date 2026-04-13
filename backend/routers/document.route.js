import { Router } from 'express';
import DocumentController from '../controllers/document.controller.js';

const DocumentRouter = Router();

DocumentRouter.get("/", DocumentController.all);
DocumentRouter.delete("/:id", DocumentController.deleteByDocId);

export default DocumentRouter;