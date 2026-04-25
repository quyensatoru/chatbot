import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { config, logger, ok, fail } from '../config/tool.config.js';

export const currentTimeTool = new DynamicStructuredTool({
    name: 'current_time',
    description:
        'Lấy ngày giờ hiện tại theo múi giờ chỉ định. Dùng khi cần biết thời gian hiện tại, ngày trong tuần, hoặc chuyển đổi múi giờ.',
    schema: z
        .object({
            timezone: z
                .string()
                .optional()
                .describe(
                    "Múi giờ IANA (ví dụ: 'Asia/Ho_Chi_Minh', 'America/New_York', 'UTC'). Mặc định: Asia/Ho_Chi_Minh",
                ),
        })
        .strict(),
    func: async ({ timezone }) => {
        const tz = timezone || config.defaults.timezone;
        logger.info('Tool: current_time', { tz });
        try {
            const now = new Date();
            return ok({
                iso: now.toISOString(),
                timestamp: now.getTime(),
                timezone: tz,
                formatted: now.toLocaleString('vi-VN', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' }),
                date: now.toLocaleDateString('vi-VN', { timeZone: tz, dateStyle: 'short' }),
                time: now.toLocaleTimeString('vi-VN', { timeZone: tz, timeStyle: 'medium' }),
                dayOfWeek: now.toLocaleDateString('vi-VN', { timeZone: tz, weekday: 'long' }),
            });
        } catch (err) {
            logger.error('current_time error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const currentTool = [currentTimeTool];
