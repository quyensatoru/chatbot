import InitAgent from "../config/agent.config.js";

const AgentService = {
    chat: async (messages) => {
        try {
            const agent = InitAgent();

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