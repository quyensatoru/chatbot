import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Document } from '@langchain/core/documents';
import { tavily } from '@tavily/core';
import dotenv from 'dotenv';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { v4 as uuidV4 } from 'uuid';
import { openChatModel } from '../config/llm.config.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SYSTEM_SUMMARY_PROMPT } from '../helper/prompt.js';
import { ChromaDB } from '../config/chorma.config.js';
import { logger, withRetry, ok, fail } from '../config/tool.config.js';

dotenv.config();

const separators = [
    '\n## ',
    '\n### ',
    '\n#### ',
    '\n###',
    '\n##',
    '\n#',
    '```',
    '\n1)',
    '\n2)',
    '\n3)',
    '\n4)',
    '\n\n',
    '\n',
    '. ',
    '? ',
    '! ',
    '; ',
    ': ',
    ', ',
    ' ',
    '',
];

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

async function performWebSearch(query) {
    const result = await withRetry(() => client.search(query, { maxResults: 5, maxTokens: 1000 }));
    return result.results.map((r) => r.content).join('\n\n');
}

export const webSearchTool = new DynamicStructuredTool({
    name: 'web_search',
    description:
        'Tìm kiếm thông tin trên internet bằng Tavily. Dùng khi cần thông tin thời sự, sự kiện mới, hoặc câu hỏi không có trong tài liệu nội bộ. Trả về câu trả lời đã tổng hợp từ kết quả web.',
    schema: z
        .object({
            query: z.string().min(1).describe('Câu hỏi hoặc từ khóa cần tìm kiếm trên web'),
        })
        .strict(),
    func: async ({ query }) => {
        logger.info('Tool: web_search', { query });
        try {
            const results = await performWebSearch(query);
            return ok({ result: results });
        } catch (err) {
            logger.error('web_search error', { error: err.message, query });
            return fail(err.message);
        }
    },
});

export const searchTools = [webSearchTool];
