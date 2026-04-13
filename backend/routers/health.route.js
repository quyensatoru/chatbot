import { Router } from 'express';
import HealthController from '../controllers/health.controller.js';

const HealthRouter = Router();

HealthRouter.get('/', HealthController.health)

export default HealthRouter;
