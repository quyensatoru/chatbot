import db from "../config/chorma.config.js";
import { openChatModel } from "../config/llm.config.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { v4 as uuidv4 } from 'uuid';
import VectorService from "../services/vector.service.js";
import AgentService from "../services/agent.service.js";
import { SYSTEM_SUMMARY_PROMPT } from "../helper/prompt.js";
import { HumanMessage } from "langchain";



const ChatController = {
    chat: async (req, res) => {
        try {
            const { query } = req.body;

            if (!query) {
                return res.status(400).json({ success: false, error: 'Query is required' });
            }

            const {
                document,
                sources,
                confidence
            } = await VectorService.query({ query, topK: 5 });

            const template = ChatPromptTemplate.fromMessages([
                ['system', SYSTEM_SUMMARY_PROMPT],
                [
                    'user', 
                    `Based on the following documents:
{context}
Answer this question: {question}
Provide a clear, accurate response.
`]
            ])

            const chain = template.pipe(openChatModel);

            const result = await chain.invoke({
                context: document,
                question: query,
            });

            const response = {
                id: uuidv4(),
                answer: result.content,
                confidence: confidence,
                sources: sources,
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
            const { query } = req.body;

            if (!query) {
                return res.status(400).json({ success: false, error: 'Query is required' });
            }

            const result = await AgentService.chat([
                {
                    role: "user", content: query
                }
            ]);
            const lastMessage = result[result.length - 1];
            
            const response = {
                id: uuidv4(),
                answer: lastMessage.content,
                timestamp: new Date(),
            }
            return res.status(200).json({ success: true, data: { response: response } });
        } catch (err) {
            console.error("error: " + err.message);
            return res.status(500).json({ success: false, error: 'Agent chat failed' });
        }
    }
}

export default ChatController;