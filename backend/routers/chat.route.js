import { Router } from "express";
import ChatController from "../controllers/chat.controller.js";

const ChatRouter = Router();

ChatRouter.post("/", ChatController.chat);
ChatRouter.post("/agent", ChatController.agent);

export default ChatRouter;