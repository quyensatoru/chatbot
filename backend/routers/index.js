import { Router } from 'express';
import UploadRouter from './upload.route.js';
import HealthRouter from './health.route.js';
import ChatRouter from './chat.route.js';
import DocumentRouter from './document.route.js';

const routers = Router();

routers.use('/upload', UploadRouter);
routers.use('/health', HealthRouter);
routers.use('/chat', ChatRouter);
routers.use('/documents', DocumentRouter);

export default routers;
