import { Router } from 'express';
import PersonalityController from '../controllers/personality.controller.js';

const PersonalityRouter = Router();

PersonalityRouter.get('/', PersonalityController.list);
PersonalityRouter.get('/:username', PersonalityController.getOne);

export default PersonalityRouter;
