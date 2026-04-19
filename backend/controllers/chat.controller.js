import { v4 as uuidv4 } from 'uuid';
import AgentService from "../services/agent.service.js";
import RagService from "../services/rag.service.js";
import { getSession, saveSession } from '../helper/storage.js';

const ChatController = {
    chat: async (req, res) => {
        try {
            const { query, strategy } = req.body;

            if (!query) {
                return res.status(400).json({ success: false, error: 'Query is required' });
            }

            const result = await RagService.query({
                query,
                topK: 5,
                strategy,
            });

            const response = {
                id: uuidv4(),
                answer: result.answer,
                confidence: result.confidence || 0,
                sources: result.sources || [],
                selectedStrategies: result.selected_strategies || [],
                timestamp: new Date(),
            }

            return res.status(200).json({ success: true, data: { response: response } });
        } catch (err) {
            console.error("error: " + err.message);
            return res.status(500).json({ success: false, error: 'Chat failed' });
        }
    },
    agent: async (req, res) => {
        try {
            let { query, conversationId } = req.body;

            if (!query) {
                return res.status(400).json({ success: false, error: 'Query is required' });
            }

            if(!conversationId) {
                conversationId = uuidv4();
            }

            console.log("conversationId: ", conversationId)

            let history = getSession(conversationId);

            console.log("history: ", history)

            const messages = [
                ...history,
                { role: "user", content: query }
            ];

            const result = await AgentService.chat(messages);
            const lastMessage = result[result.length - 1];
            console.log("lastMessage: ", lastMessage.content)

            history.push({ role: "user", content: query });
            history.push({ role: "ai", content: lastMessage.content });

            history = history.slice(-10);

            saveSession(conversationId, history);

            const response = {
                id: uuidv4(),
                answer: lastMessage.content,
                confidence: lastMessage.confidence || 0,
                sources: lastMessage.sources || [],
                selectedStrategies: lastMessage.selectedStrategies || [],
                timestamp: new Date(),
                conversationId,
            };

            return res.status(200).json({ success: true, data: { response } });
        } catch (err) {
            console.error("error: " + err.message);
            return res.status(500).json({ success: false, error: 'Agent chat failed' });
        }
    }
}

export default ChatController;
