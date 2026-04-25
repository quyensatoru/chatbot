import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenRouter } from '@langchain/openrouter';

export const embeddingModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'text-embedding-3-small',
});

export const openChatModel = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o',
    maxTokens: 1500,
    temperature: 0.3,
});

export const openRouterModel = new ChatOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
    maxTokens: 1000,
    temperature: 0.3,
})