import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { config, logger, withRetry, ok, fail } from "../config/tool.config.js";

const SCHEDULED_FILE = path.resolve("./data/scheduled_messages.json");
const activeTimers = new Map(); // id → timeout handle

// ─── Mattermost helper ────────────────────────────────────────────────────────

async function sendToMattermost(channelId, message) {
    const res = await fetch(config.mattermost.botUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: channelId, message }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Mattermost error ${res.status}: ${text}`);
    }
    return res;
}

// ─── Scheduled messages (persistent) ─────────────────────────────────────────

function loadScheduled() {
    try {
        if (fs.existsSync(SCHEDULED_FILE)) {
            return JSON.parse(fs.readFileSync(SCHEDULED_FILE, "utf-8"));
        }
    } catch {}
    return [];
}

function saveScheduled(items) {
    fs.mkdirSync(path.dirname(SCHEDULED_FILE), { recursive: true });
    fs.writeFileSync(SCHEDULED_FILE, JSON.stringify(items, null, 2), "utf-8");
}

function scheduleOne(item) {
    const delay = new Date(item.sendAt).getTime() - Date.now();
    if (delay <= 0) return;

    const handle = setTimeout(async () => {
        try {
            await withRetry(() => sendToMattermost(item.channelId, item.message));
            logger.info("Scheduled message sent", { id: item.id, sendAt: item.sendAt });
        } catch (e) {
            logger.error("Scheduled message failed", { id: item.id, error: e.message });
        } finally {
            activeTimers.delete(item.id);
            const items = loadScheduled().filter((s) => s.id !== item.id);
            saveScheduled(items);
        }
    }, delay);

    activeTimers.set(item.id, handle);
}

// Called from server.js on startup to recover pending scheduled messages
export function initScheduledMessages() {
    const items = loadScheduled();
    const now = Date.now();
    let recovered = 0;
    for (const item of items) {
        if (new Date(item.sendAt).getTime() > now) {
            scheduleOne(item);
            recovered++;
        }
    }
    const pending = items.filter((i) => new Date(i.sendAt).getTime() > now);
    if (pending.length !== items.length) saveScheduled(pending);
    if (recovered > 0) logger.info(`[ScheduledMessages] Recovered ${recovered} pending messages`);
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export const sendMessageTool = new DynamicStructuredTool({
    name: "send_message",
    description: "Gửi tin nhắn đến một channel Mattermost.",
    schema: z.object({
        channelId: z.string().optional().describe("ID channel Mattermost. Để trống để dùng channel mặc định"),
        message: z.string().describe("Nội dung tin nhắn (hỗ trợ Markdown)"),
    }).strict(),
    func: async ({ channelId, message }) => {
        logger.info("Tool: send_message", { channelId, preview: message.slice(0, 50) });
        try {
            const targetId = channelId || config.mattermost.channelId;
            await withRetry(() => sendToMattermost(targetId, message));
            return ok({ channelId: targetId, status: "sent" });
        } catch (err) {
            logger.error("send_message error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const sendNotificationTool = new DynamicStructuredTool({
    name: "send_notification",
    description: "Gửi thông báo quan trọng đến channel Mattermost mặc định. Dùng để nhắc nhở, cảnh báo.",
    schema: z.object({
        title: z.string().describe("Tiêu đề thông báo"),
        body: z.string().describe("Nội dung thông báo"),
        urgent: z.boolean().default(false).describe("Thông báo khẩn cấp (thêm emoji nổi bật)"),
    }).strict(),
    func: async ({ title, body, urgent }) => {
        logger.info("Tool: send_notification", { title });
        try {
            const icon = urgent ? "🚨" : "🔔";
            const text = `${icon} **${title}**\n\n${body}`;
            await withRetry(() => sendToMattermost(config.mattermost.channelId, text));
            return ok({ status: "notified", title, urgent });
        } catch (err) {
            logger.error("send_notification error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const scheduleMessageTool = new DynamicStructuredTool({
    name: "schedule_message",
    description: "Lên lịch gửi tin nhắn Mattermost vào thời điểm cụ thể. Persistent — vẫn gửi sau server restart.",
    schema: z.object({
        channelId: z.string().optional().describe("ID channel, mặc định dùng channel đã cấu hình"),
        message: z.string().describe("Nội dung tin nhắn"),
        sendAt: z.string().describe("Thời gian gửi (ISO 8601), ví dụ: 2026-04-21T09:00:00+07:00"),
    }).strict(),
    func: async ({ channelId, message, sendAt }) => {
        logger.info("Tool: schedule_message", { sendAt });
        try {
            const targetId = channelId || config.mattermost.channelId;
            const sendTime = new Date(sendAt).getTime();
            const now = Date.now();
            const delay = sendTime - now;

            if (isNaN(sendTime)) return fail("Định dạng thời gian không hợp lệ");
            if (delay <= 0) return fail("Thời gian gửi phải ở tương lai");
            if (delay > 30 * 24 * 60 * 60 * 1000) return fail("Chỉ hỗ trợ lên lịch tối đa 30 ngày");

            const item = { id: uuidv4(), channelId: targetId, message, sendAt };
            const items = loadScheduled();
            items.push(item);
            saveScheduled(items);
            scheduleOne(item);

            return ok({ id: item.id, scheduled: true, sendAt, delayMs: delay, message: message.slice(0, 100) });
        } catch (err) {
            logger.error("schedule_message error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const cancelScheduledMessageTool = new DynamicStructuredTool({
    name: "cancel_scheduled_message",
    description: "Hủy một tin nhắn đã lên lịch chưa gửi.",
    schema: z.object({
        id: z.string().describe("ID của scheduled message (lấy từ list_scheduled_messages)"),
    }).strict(),
    func: async ({ id }) => {
        logger.info("Tool: cancel_scheduled_message", { id });
        try {
            if (activeTimers.has(id)) {
                clearTimeout(activeTimers.get(id));
                activeTimers.delete(id);
            }
            const items = loadScheduled();
            const idx = items.findIndex((i) => i.id === id);
            if (idx === -1) return fail(`Không tìm thấy scheduled message ID: ${id}`);
            items.splice(idx, 1);
            saveScheduled(items);
            return ok({ cancelled: true, id });
        } catch (err) {
            logger.error("cancel_scheduled_message error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const listScheduledMessagesTool = new DynamicStructuredTool({
    name: "list_scheduled_messages",
    description: "Xem danh sách các tin nhắn đang chờ gửi.",
    schema: z.object({}).strict(),
    func: async () => {
        logger.info("Tool: list_scheduled_messages");
        try {
            const items = loadScheduled();
            const now = Date.now();
            const pending = items.filter((i) => new Date(i.sendAt).getTime() > now);
            return ok({
                total: pending.length,
                messages: pending.map((i) => ({
                    id: i.id,
                    channelId: i.channelId,
                    sendAt: i.sendAt,
                    message: i.message.slice(0, 100),
                    inMs: new Date(i.sendAt).getTime() - now,
                })),
            });
        } catch (err) {
            logger.error("list_scheduled_messages error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const sendImageTool = new DynamicStructuredTool({
    name: "send_image",
    description: "Gửi hình ảnh đến channel Mattermost (nhúng ảnh qua URL).",
    schema: z.object({
        imageUrl: z.string().url().describe("URL công khai của hình ảnh"),
        caption: z.string().optional().describe("Chú thích hiển thị kèm ảnh"),
        channelId: z.string().optional().describe("ID channel, mặc định dùng channel đã cấu hình"),
    }).strict(),
    func: async ({ imageUrl, caption, channelId }) => {
        logger.info("Tool: send_image", { imageUrl });
        try {
            const targetId = channelId || config.mattermost.channelId;
            const text = caption ? `${caption}\n![image](${imageUrl})` : `![image](${imageUrl})`;
            await withRetry(() => sendToMattermost(targetId, text));
            return ok({ channelId: targetId, status: "sent", imageUrl });
        } catch (err) {
            logger.error("send_image error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const messagingTools = [
    sendMessageTool,
    sendNotificationTool,
    scheduleMessageTool,
    cancelScheduledMessageTool,
    listScheduledMessagesTool,
    sendImageTool,
];
