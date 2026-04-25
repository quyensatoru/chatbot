import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import RagService from '../services/rag.service.js';
import { logger, ok, fail } from '../config/tool.config.js';

export const documentRagTool = new DynamicStructuredTool({
    name: 'document_rag',
    description: `Tìm kiếm và trả lời từ cơ sở tri thức tài liệu (RAG system).

PHẢI dùng tool này khi người dùng hỏi về:
- Thông tin cá nhân, dữ liệu trong tài liệu
- Bất kỳ sự kiện nào có thể có trong file lưu trữ

QUAN TRỌNG:
- Đây là nguồn sự thật chính cho câu hỏi về tài liệu
- KHÔNG tự trả lời từ bộ nhớ nếu câu hỏi liên quan đến tài liệu
- Luôn gọi tool này trước khi trả lời câu hỏi về tài liệu`,
    schema: z
        .object({
            query: z.string().min(1).describe('Câu hỏi hoặc từ khóa tìm kiếm trong tài liệu'),
            top_k: z
                .number()
                .int()
                .min(1)
                .max(20)
                .optional()
                .default(5)
                .describe('Số lượng đoạn văn bản liên quan trả về (mặc định: 5)'),
        })
        .strict(),
    func: async ({ query, top_k }) => {
        logger.info('Tool: document_rag', { query, top_k });
        try {
            const response = await RagService.query({ query, topK: top_k });
            return ok({
                answer: response.answer,
                sources: response.sources || [],
                strategies: response.selected_strategies || [],
                retrievals: response.retrievals || {},
            });
        } catch (err) {
            logger.error('document_rag error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const documentTools = [documentRagTool];
