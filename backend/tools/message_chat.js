import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import TelegramBot from "node-telegram-bot-api";
import { config, logger, ok, fail } from "../config/tool.config.js";

let botInstance = null;

function getBot() {
    if (!botInstance) {
        botInstance = new TelegramBot(config.telegram.botToken);
    }
    return botInstance;
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export const sendMessageTool = new DynamicStructuredTool({
    name: "send_message",
    description:
        "Gửi tin nhắn qua Telegram. Dùng khi người dùng muốn gửi thông báo, nhắn tin đến ai đó.",
    schema: z.object({
        chatId: z
            .string()
            .optional()
            .describe("Chat ID người nhận. Để trống để dùng chat ID mặc định"),
        message: z.string().describe("Nội dung tin nhắn"),
        parseMode: z
            .enum(["Markdown", "HTML", "MarkdownV2"])
            .optional()
            .describe("Định dạng tin nhắn"),
        disablePreview: z.boolean().default(false).describe("Tắt link preview"),
    }),
    func: async ({ chatId, message, parseMode, disablePreview }) => {
        logger.info("Tool: send_message", { chatId, preview: message.slice(0, 50) });
        try {
            const bot = getBot();
            const targetId = chatId || config.telegram.chatId;
            const res = await bot.sendMessage(targetId, message, {
                parse_mode: parseMode,
                disable_web_page_preview: disablePreview,
            });
            return ok({ messageId: res.message_id, chatId: targetId, status: "sent" });
        } catch (err) {
            logger.error("send_message error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const sendNotificationTool = new DynamicStructuredTool({
    name: "send_notification",
    description:
        "Gửi thông báo quan trọng đến thiết bị cá nhân qua Telegram. Dùng để nhắc nhở, cảnh báo.",
    schema: z.object({
        title: z.string().describe("Tiêu đề thông báo"),
        body: z.string().describe("Nội dung thông báo"),
        urgent: z.boolean().default(false).describe("Thông báo khẩn cấp (bật âm thanh)"),
    }),
    func: async ({ title, body, urgent }) => {
        logger.info("Tool: send_notification", { title });
        try {
            const bot = getBot();
            const text = `🔔 *${title}*\n\n${body}`;
            const res = await bot.sendMessage(config.telegram.chatId, text, {
                parse_mode: "Markdown",
                disable_notification: !urgent,
            });
            return ok({ messageId: res.message_id, status: "notified" });
        } catch (err) {
            logger.error("send_notification error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const scheduleMessageTool = new DynamicStructuredTool({
    name: "schedule_message",
    description:
        "Lên lịch gửi tin nhắn vào một thời điểm cụ thể trong tương lai.",
    schema: z.object({
        chatId: z.string().optional().describe("Chat ID, mặc định dùng ID đã cấu hình"),
        message: z.string().describe("Nội dung tin nhắn"),
        sendAt: z
            .string()
            .describe("Thời gian gửi (ISO 8601). Ví dụ: 2024-12-31T09:00:00+07:00"),
    }),
    func: async ({ chatId, message, sendAt }) => {
        logger.info("Tool: schedule_message", { sendAt });
        try {
            const targetId = chatId || config.telegram.chatId;
            const sendTime = new Date(sendAt).getTime();
            const now = Date.now();
            const delay = sendTime - now;

            if (delay <= 0) {
                return fail("Thời gian gửi phải ở tương lai");
            }
            if (delay > 24 * 60 * 60 * 1000 * 7) {
                return fail("Chỉ hỗ trợ lên lịch tối đa 7 ngày");
            }

            setTimeout(async () => {
                try {
                    const bot = getBot();
                    await bot.sendMessage(targetId, message);
                    logger.info("Scheduled message sent", { sendAt });
                } catch (e) {
                    logger.error("Scheduled message failed", { error: e.message });
                }
            }, delay);

            return ok({
                scheduled: true,
                sendAt,
                delayMs: delay,
                message: message.slice(0, 100),
            });
        } catch (err) {
            logger.error("schedule_message error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const sendPhotoTool = new DynamicStructuredTool({
    name: "send_photo",
    description: "Gửi hình ảnh qua Telegram kèm caption tùy chọn.",
    schema: z.object({
        photoUrl: z.string().url().describe("URL của hình ảnh cần gửi"),
        caption: z.string().optional().describe("Chú thích ảnh"),
        chatId: z.string().optional(),
    }),
    func: async ({ photoUrl, caption, chatId }) => {
        logger.info("Tool: send_photo", { photoUrl });
        try {
            const bot = getBot();
            const targetId = chatId || config.telegram.chatId;
            const res = await bot.sendPhoto(targetId, photoUrl, { caption });
            return ok({ messageId: res.message_id, status: "photo_sent" });
        } catch (err) {
            logger.error("send_photo error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const messagingTools = [
    sendMessageTool,
    sendNotificationTool,
    scheduleMessageTool,
    sendPhotoTool,
];