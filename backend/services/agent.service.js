import InitAgent from "../config/agent.config.js";
import RagService from "./rag.service.js";

const AgentService = {
    chat: async (messages) => {
        try {
            const agent = InitAgent();
            const userMessage = [...messages]
                .reverse()
                .find((message) => message.role === "user" && message.content?.trim());

            if (!userMessage) {
                throw new Error("A user message is required");
            }

            const response = await agent.invoke({
                messages: messages
            });

            return response.messages;
        } catch (error) {
            console.error("Error during agent chat:", error);
            throw new Error("Agent chat failed");
        }
    }
}

export default AgentService;