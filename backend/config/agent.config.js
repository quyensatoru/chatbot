import { tools } from '../tools/index.js';
import { createAgent } from 'langchain';
import { openChatModel, openRouterModel } from './llm.config.js';
import { SYSTEM_SUMMARY_PROMPT, SYSTEMT_DECIDE_PROMPT } from '../helper/prompt.js';

const _agentCache = new Map();

export function getAgent(channelId, profileChannel = '') {
    const key = channelId ?? '__default__';

    if (_agentCache.has(key)) return _agentCache.get(key);

    const systemPrompt = profileChannel ? `${SYSTEM_SUMMARY_PROMPT}\n\n${profileChannel}` : SYSTEM_SUMMARY_PROMPT;

    const agent = createAgent({
        model: openRouterModel,
        tools,
        name: 'chatbot-agent',
        systemPrompt,
    });

    _agentCache.set(key, agent);
    return agent;
}

export function getAgentDecision() {
    const key = '__decision__';

    if (_agentCache.has(key)) return _agentCache.get(key);

    const agent = createAgent({
        model: openRouterModel,
        tools: [],
        name: 'chatbot-agent-decision',
        systemPrompt: SYSTEMT_DECIDE_PROMPT,
    });

    _agentCache.set(key, agent);
    return agent;
}

export function invalidateAgentCache() {
    _agentCache.clear();
    console.log('[AgentCache] Invalidated — agents will be recreated on next request');
}
