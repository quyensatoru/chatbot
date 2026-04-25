import { tools } from '../tools/index.js';
import { createAgent } from 'langchain';
import { openChatModel } from './llm.config.js';
import { SYSTEM_SUMMARY_PROMPT } from '../helper/prompt.js';

const _agentCache = new Map();

export function getAgent(channelId, profileBlock = '') {
    const key = channelId ?? '__default__';

    if (_agentCache.has(key)) return _agentCache.get(key);

    const systemPrompt = profileBlock ? `${SYSTEM_SUMMARY_PROMPT}\n\n${profileBlock}` : SYSTEM_SUMMARY_PROMPT;

    console.log('systemPrompt: ', systemPrompt);
    const agent = createAgent({
        model: openChatModel,
        tools,
        name: 'chatbot-agent',
        systemPrompt,
    });

    _agentCache.set(key, agent);
    return agent;
}

export function invalidateAgentCache() {
    _agentCache.clear();
    console.log('[AgentCache] Invalidated — agents will be recreated on next request');
}
