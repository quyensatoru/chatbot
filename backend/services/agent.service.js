import { getAgent, invalidateAgentCache } from '../config/agent.config.js';
import ProfileService from './profile.service.js';

const AgentService = {
    chat: async (messages, ctx = {}) => {
        const { channelId } = ctx;

        const userMessage = [...messages].reverse().find((m) => m.role === 'user' && m.content?.trim());

        if (!userMessage) throw new Error('A user message is required');

        const profileBlock = channelId ? ProfileService.getPromptBlockForChannel(channelId) : null;

        const agent = getAgent(channelId, profileBlock ?? '');

        try {
            const response = await agent.invoke({ messages });
            return response.messages;
        } catch (error) {
            console.error('Error during agent chat:', error);
            throw new Error('Agent chat failed');
        }
    },

    invalidateCache() {
        ProfileService.invalidate();
        invalidateAgentCache();
    },
};

export default AgentService;
