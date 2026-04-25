import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { evaluate } from 'mathjs';
import { logger, ok, fail } from '../config/tool.config.js';

export const calculateMathTool = new DynamicStructuredTool({
    name: 'calculate_math',
    description:
        'Tính toán biểu thức toán học bằng Math.js. Hỗ trợ phép tính cơ bản đến nâng cao (lượng giác, logarithm, ma trận...). Trả về kết quả số.',
    schema: z
        .object({
            expression: z
                .string()
                .min(1)
                .describe("Biểu thức toán học cần tính. Ví dụ: '(2 + 3) * 4', 'sqrt(16)', 'sin(pi/2)', 'log(100, 10)'"),
        })
        .strict(),
    func: async ({ expression }) => {
        logger.info('Tool: calculate_math', { expression });
        try {
            const result = evaluate(expression);
            return ok({ expression, result: result.toString(), numeric: typeof result === 'number' ? result : null });
        } catch (err) {
            logger.error('calculate_math error', { error: err.message, expression });
            return fail(`Biểu thức không hợp lệ: ${err.message}`);
        }
    },
});

export const calculateTools = [calculateMathTool];
