import { getAgent, getAgentDecision, invalidateAgentCache } from '../config/agent.config.js';
import ProfileService from './profile.service.js';

const AgentService = {
    chat: async (messages, ctx = {}) => {
        const { channelId } = ctx;

        const userMessage = [...messages].reverse().find((m) => m.role === 'user' && m.content?.trim());

        if (!userMessage) throw new Error('A user message is required');

        const profileChannel = channelId ? ProfileService.getPromptForChannel(channelId) : null;
        const agent = getAgent(channelId, profileChannel ?? '');

        try {
            const response = await agent.invoke({ messages });
            return response.messages;
        } catch (error) {
            console.error('Error during agent chat:', error);
            throw new Error('Agent chat failed');
        }
    },

    decision: async(messages) => {
        if (!messages) throw new Error('A user message is required');

        const agent = getAgentDecision();

        try {
            const response = await agent.invoke({ messages });
            return JSON.parse(response.messages?.[1]?.content ?? "{}");
        } catch (error) {
            console.error('Error during agent decision:', error);
            throw new Error('Agent decision failed');
        }
    },

    invalidateCache() {
        ProfileService.invalidate();
        invalidateAgentCache();
    },
};

export default AgentService;
