import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { google } from "googleapis";
import { config, logger, withRetry, ok, fail } from "../config/tool.config.js";

function getAuth() {
    const auth = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
    );
    auth.setCredentials({ refresh_token: config.google.refreshToken });
    return auth;
}

function getGmail() {
    return google.gmail({ version: "v1", auth: getAuth() });
}

function encodeEmail({ to, cc, bcc, subject, body, threadId }) {
    const lines = [
        `To: ${Array.isArray(to) ? to.join(", ") : to}`,
        cc?.length ? `Cc: ${Array.isArray(cc) ? cc.join(", ") : cc}` : null,
        bcc?.length ? `Bcc: ${Array.isArray(bcc) ? bcc.join(", ") : bcc}` : null,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        "",
        body,
    ]
        .filter(Boolean)
        .join("\r\n");

    return {
        raw: Buffer.from(lines).toString("base64url"),
        ...(threadId ? { threadId } : {}),
    };
}

function parseMessage(msg) {
    const headers = msg.payload?.headers || [];
    const get = (name) => headers.find((h) => h.name.toLowerCase() === name)?.value || "";

    let body = "";
    const parts = msg.payload?.parts || [msg.payload];
    for (const part of parts) {
        if (part?.mimeType === "text/plain" || part?.mimeType === "text/html") {
            body = Buffer.from(part.body?.data || "", "base64url").toString("utf-8");
            break;
        }
    }

    return {
        id: msg.id,
        threadId: msg.threadId,
        from: get("from"),
        to: get("to"),
        subject: get("subject"),
        date: get("date"),
        snippet: msg.snippet,
        body: body.slice(0, 2000),
        labelIds: msg.labelIds || [],
    };
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export const readEmailsTool = new DynamicStructuredTool({
    name: "read_emails",
    description:
        "Đọc email từ Gmail. Dùng khi người dùng muốn xem email mới, inbox, hoặc tìm email theo bộ lọc.",
    schema: z.object({
        query: z
            .string()
            .default("is:unread")
            .describe("Bộ lọc Gmail (ví dụ: 'is:unread', 'from:boss@example.com', 'subject:invoice')"),
        maxResults: z.number().int().min(1).max(20).default(5).describe("Số email tối đa"),
        labelIds: z
            .array(z.string())
            .optional()
            .describe("Lọc theo label: INBOX, SENT, DRAFT, SPAM..."),
    }),
    func: async ({ query, maxResults, labelIds }) => {
        logger.info("Tool: read_emails", { query, maxResults });
        try {
            const gmail = getGmail();
            const listRes = await withRetry(() =>
                gmail.users.messages.list({
                    userId: "me",
                    q: query,
                    maxResults,
                    labelIds,
                })
            );

            const messages = listRes.data.messages || [];
            if (!messages.length) return ok([]);

            const emails = await Promise.all(
                messages.map((m) =>
                    withRetry(() =>
                        gmail.users.messages.get({ userId: "me", id: m.id, format: "full" })
                    ).then((r) => parseMessage(r.data))
                )
            );

            return ok(emails);
        } catch (err) {
            logger.error("read_emails error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const sendEmailTool = new DynamicStructuredTool({
    name: "send_email",
    description:
        "Soạn và gửi email qua Gmail. Dùng khi người dùng muốn gửi email đến ai đó.",
    schema: z.object({
        to: z
            .union([z.string().email(), z.array(z.string().email())])
            .describe("Địa chỉ email người nhận"),
        subject: z.string().describe("Tiêu đề email"),
        body: z.string().describe("Nội dung email (hỗ trợ HTML)"),
        cc: z.array(z.string().email()).optional().describe("Danh sách CC"),
        bcc: z.array(z.string().email()).optional().describe("Danh sách BCC"),
    }),
    func: async ({ to, subject, body, cc, bcc }) => {
        logger.info("Tool: send_email", { to, subject });
        try {
            const gmail = getGmail();
            const encoded = encodeEmail({ to, subject, body, cc, bcc });
            const res = await withRetry(() =>
                gmail.users.messages.send({ userId: "me", resource: encoded })
            );
            return ok({ id: res.data.id, threadId: res.data.threadId, status: "sent" });
        } catch (err) {
            logger.error("send_email error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const replyEmailTool = new DynamicStructuredTool({
    name: "reply_email",
    description: "Trả lời một email trong thread. Cần có threadId và messageId của email gốc.",
    schema: z.object({
        threadId: z.string().describe("ID của thread email"),
        replyToMessageId: z.string().describe("ID của email cần trả lời"),
        to: z.string().email().describe("Email người nhận (thường là người gửi gốc)"),
        subject: z.string().describe("Tiêu đề (thường thêm 'Re: ' vào trước)"),
        body: z.string().describe("Nội dung trả lời"),
    }),
    func: async ({ threadId, replyToMessageId, to, subject, body }) => {
        logger.info("Tool: reply_email", { threadId, replyToMessageId });
        try {
            const gmail = getGmail();
            const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
            const encoded = encodeEmail({ to, subject: replySubject, body, threadId });
            encoded.resource = { ...encoded, threadId };

            const res = await withRetry(() =>
                gmail.users.messages.send({
                    userId: "me",
                    resource: { raw: encoded.raw, threadId },
                })
            );
            return ok({ id: res.data.id, threadId: res.data.threadId, status: "replied" });
        } catch (err) {
            logger.error("reply_email error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const searchEmailsTool = new DynamicStructuredTool({
    name: "search_emails",
    description:
        "Tìm kiếm email theo từ khóa, người gửi, tiêu đề hoặc khoảng thời gian.",
    schema: z.object({
        query: z.string().describe(
            "Cú pháp tìm kiếm Gmail. Ví dụ: 'from:alice subject:report after:2024/01/01'"
        ),
        maxResults: z.number().int().min(1).max(20).default(5),
    }),
    func: async ({ query, maxResults }) => {
        logger.info("Tool: search_emails", { query });
        try {
            const gmail = getGmail();
            const listRes = await withRetry(() =>
                gmail.users.messages.list({ userId: "me", q: query, maxResults })
            );
            const messages = listRes.data.messages || [];
            if (!messages.length) return ok([]);

            const emails = await Promise.all(
                messages.map((m) =>
                    withRetry(() =>
                        gmail.users.messages.get({ userId: "me", id: m.id })
                    ).then((r) => parseMessage(r.data))
                )
            );
            return ok(emails);
        } catch (err) {
            logger.error("search_emails error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const draftEmailTool = new DynamicStructuredTool({
    name: "draft_email",
    description: "Lưu email nháp vào Gmail mà chưa gửi.",
    schema: z.object({
        to: z.string().email().describe("Email người nhận"),
        subject: z.string().describe("Tiêu đề email"),
        body: z.string().describe("Nội dung email"),
    }),
    func: async ({ to, subject, body }) => {
        logger.info("Tool: draft_email", { to, subject });
        try {
            const gmail = getGmail();
            const encoded = encodeEmail({ to, subject, body });
            const res = await withRetry(() =>
                gmail.users.drafts.create({
                    userId: "me",
                    resource: { message: { raw: encoded.raw } },
                })
            );
            return ok({ draftId: res.data.id, status: "saved_as_draft" });
        } catch (err) {
            logger.error("draft_email error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const labelEmailTool = new DynamicStructuredTool({
    name: "label_email",
    description: "Gắn hoặc gỡ nhãn cho email trong Gmail.",
    schema: z.object({
        messageId: z.string().describe("ID của email"),
        addLabelIds: z.array(z.string()).optional().describe("Danh sách label thêm vào"),
        removeLabelIds: z.array(z.string()).optional().describe("Danh sách label cần xóa"),
    }),
    func: async ({ messageId, addLabelIds, removeLabelIds }) => {
        logger.info("Tool: label_email", { messageId });
        try {
            const gmail = getGmail();
            await withRetry(() =>
                gmail.users.messages.modify({
                    userId: "me",
                    id: messageId,
                    resource: { addLabelIds, removeLabelIds },
                })
            );
            return ok({ messageId, modified: true });
        } catch (err) {
            logger.error("label_email error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const emailTools = [
    readEmailsTool,
    sendEmailTool,
    replyEmailTool,
    searchEmailsTool,
    draftEmailTool,
    labelEmailTool,
];