import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { config, logger, withRetry, ok, fail } from '../config/tool.config.js';

function createTransport() {
    return nodemailer.createTransport({
        host: config.email.smtpHost,
        port: config.email.smtpPort,
        secure: config.email.smtpSecure,
        auth: { user: config.email.user, pass: config.email.password },
    });
}

// Skip retry on SMTP auth errors (535/EAUTH) — retrying won't help wrong credentials
async function sendWithSmtp(mailOptions) {
    const transport = createTransport();
    for (let i = 0; i < config.defaults.retryAttempts; i++) {
        try {
            return await transport.sendMail(mailOptions);
        } catch (err) {
            const isAuthError = err.code === 'EAUTH' || err.responseCode === 535 || err.responseCode === 534;
            if (isAuthError || i === config.defaults.retryAttempts - 1) {
                if (isAuthError && config.email.smtpHost.includes('gmail.com')) {
                    err.message +=
                        ' | Gmail yêu cầu App Password (không phải mật khẩu thường): myaccount.google.com/apppasswords';
                }
                throw err;
            }
            logger.warn(`SMTP retry ${i + 1}/${config.defaults.retryAttempts}: ${err.message}`);
            await new Promise((r) => setTimeout(r, config.defaults.retryDelay * Math.pow(2, i)));
        }
    }
}

async function withImap(fn) {
    const client = new ImapFlow({
        host: config.email.imapHost,
        port: config.email.imapPort,
        secure: true,
        auth: { user: config.email.user, pass: config.email.password },
        logger: false,
    });
    await client.connect();
    try {
        return await fn(client);
    } finally {
        await client.logout().catch(() => {});
    }
}

// Find the Drafts folder by \Drafts special-use attribute (works across Gmail, Outlook, etc.)
async function findDraftsFolder(client) {
    const mailboxes = await client.list();
    const draftsBox = mailboxes.find((mb) => mb.specialUse === '\\Drafts');
    return draftsBox?.path || config.email.draftsFolder;
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export const sendEmailTool = new DynamicStructuredTool({
    name: 'send_email',
    description: 'Gửi email qua SMTP. Hỗ trợ CC, BCC và nội dung HTML.',
    schema: z
        .object({
            to: z.union([z.string().email(), z.array(z.string().email())]).describe('Địa chỉ email người nhận'),
            subject: z.string().describe('Tiêu đề email'),
            body: z.string().describe('Nội dung email (hỗ trợ HTML)'),
            cc: z.array(z.string().email()).optional().describe('Danh sách CC'),
            bcc: z.array(z.string().email()).optional().describe('Danh sách BCC'),
            attachments: z.array(z.object({ filename: z.string(), path: z.string() })).optional().describe('Tệp đính kèm (filename + base64 content)'),
        })
        .strict(),
    func: async ({ to, subject, body, cc, bcc, attachments }) => {
        logger.info('Tool: send_email', { to, subject, body, cc, bcc, attachments });
        try {
            const toStr = Array.isArray(to) ? to.join(', ') : to;
            const info = await sendWithSmtp({
                from: config.email.user,
                to: toStr,
                cc: cc?.join(', '),
                bcc: bcc?.join(', '),
                subject,
                html: body,
                attachments: attachments,
            });
            return ok({ messageId: info.messageId, status: 'sent' });
        } catch (err) {
            logger.error('send_email error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const replyEmailTool = new DynamicStructuredTool({
    name: 'reply_email',
    description: 'Trả lời email. Cần Message-ID gốc (dạng <xxx@xxx>) và địa chỉ người nhận.',
    schema: z
        .object({
            replyToMessageId: z.string().describe('Message-ID của email gốc, ví dụ: <abc@mail.com>'),
            to: z.string().email().describe('Email người nhận'),
            subject: z.string().describe("Tiêu đề (sẽ tự thêm 'Re: ' nếu chưa có)"),
            body: z.string().describe('Nội dung trả lời (hỗ trợ HTML)'),
        })
        .strict(),
    func: async ({ replyToMessageId, to, subject, body }) => {
        logger.info('Tool: reply_email', { replyToMessageId });
        try {
            const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
            const info = await sendWithSmtp({
                from: config.email.user,
                to,
                subject: replySubject,
                html: body,
                inReplyTo: replyToMessageId,
                references: replyToMessageId,
            });
            return ok({ messageId: info.messageId, status: 'replied' });
        } catch (err) {
            logger.error('reply_email error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const readEmailsTool = new DynamicStructuredTool({
    name: 'read_emails',
    description: 'Đọc email từ hộp thư IMAP. Mặc định đọc email chưa đọc trong INBOX.',
    schema: z
        .object({
            mailbox: z.string().default('INBOX').describe('Hộp thư cần đọc (INBOX, Sent, Drafts...)'),
            onlyUnread: z.boolean().default(true).describe('Chỉ lấy email chưa đọc'),
            maxResults: z.number().int().min(1).max(20).default(5).describe('Số email tối đa'),
        })
        .strict(),
    func: async ({ mailbox, onlyUnread, maxResults }) => {
        logger.info('Tool: read_emails', { mailbox, onlyUnread });
        try {
            const emails = await withImap(async (client) => {
                await client.mailboxOpen(mailbox);
                const criteria = onlyUnread ? { seen: false } : { all: true };
                const uids = await client.search(criteria, { uid: true });
                const slice = uids.slice(-maxResults);
                if (!slice.length) return [];

                const messages = [];
                for await (const msg of client.fetch(slice, { envelope: true, flags: true }, { uid: true })) {
                    messages.push({
                        uid: msg.uid,
                        messageId: msg.envelope.messageId,
                        from: msg.envelope.from?.[0]?.address,
                        to: msg.envelope.to?.map((a) => a.address),
                        subject: msg.envelope.subject,
                        date: msg.envelope.date,
                        read: msg.flags.has('\\Seen'),
                    });
                }
                return messages;
            });
            return ok(emails);
        } catch (err) {
            logger.error('read_emails error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const searchEmailsTool = new DynamicStructuredTool({
    name: 'search_emails',
    description: 'Tìm kiếm email theo người gửi, tiêu đề, nội dung hoặc ngày.',
    schema: z
        .object({
            from: z.string().optional().describe('Email người gửi'),
            subject: z.string().optional().describe('Từ khóa trong tiêu đề'),
            body: z.string().optional().describe('Từ khóa trong nội dung'),
            since: z.string().optional().describe('Từ ngày (YYYY-MM-DD hoặc ISO 8601)'),
            mailbox: z.string().default('INBOX').describe('Hộp thư cần tìm'),
            maxResults: z.number().int().min(1).max(20).default(5),
        })
        .strict(),
    func: async ({ from, subject, body, since, mailbox, maxResults }) => {
        logger.info('Tool: search_emails', { from, subject });
        try {
            const emails = await withImap(async (client) => {
                await client.mailboxOpen(mailbox);
                const criteria = {};
                if (from) criteria.from = from;
                if (subject) criteria.subject = subject;
                if (body) criteria.body = body;
                if (since) criteria.since = new Date(since);

                const uids = await client.search(Object.keys(criteria).length ? criteria : { all: true }, {
                    uid: true,
                });
                const slice = uids.slice(-maxResults);
                if (!slice.length) return [];

                const messages = [];
                for await (const msg of client.fetch(slice, { envelope: true, flags: true }, { uid: true })) {
                    messages.push({
                        uid: msg.uid,
                        messageId: msg.envelope.messageId,
                        from: msg.envelope.from?.[0]?.address,
                        subject: msg.envelope.subject,
                        date: msg.envelope.date,
                        read: msg.flags.has('\\Seen'),
                    });
                }
                return messages;
            });
            return ok(emails);
        } catch (err) {
            logger.error('search_emails error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const draftEmailTool = new DynamicStructuredTool({
    name: 'draft_email',
    description: 'Lưu email nháp vào thư mục Drafts trên server IMAP.',
    schema: z
        .object({
            to: z.string().email().describe('Email người nhận'),
            subject: z.string().describe('Tiêu đề email'),
            body: z.string().describe('Nội dung email (hỗ trợ HTML)'),
        })
        .strict(),
    func: async ({ to, subject, body }) => {
        logger.info('Tool: draft_email', { to, subject });
        try {
            await withImap(async (client) => {
                const draftsFolder = await findDraftsFolder(client);
                const raw = [
                    `From: ${config.email.user}`,
                    `To: ${to}`,
                    `Subject: ${subject}`,
                    'MIME-Version: 1.0',
                    'Content-Type: text/html; charset=utf-8',
                    '',
                    body,
                ].join('\r\n');
                await client.append(draftsFolder, raw, ['\\Draft', '\\Seen']);
            });
            return ok({ status: 'saved_as_draft', to, subject });
        } catch (err) {
            logger.error('draft_email error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const markEmailTool = new DynamicStructuredTool({
    name: 'mark_email',
    description: 'Đánh dấu email: đã đọc, chưa đọc, quan trọng, hoặc xóa.',
    schema: z
        .object({
            uid: z.number().int().describe('UID của email (lấy từ read_emails hoặc search_emails)'),
            mailbox: z.string().default('INBOX').describe('Hộp thư chứa email'),
            action: z
                .enum(['read', 'unread', 'flag', 'unflag', 'delete'])
                .describe('read=đã đọc, unread=chưa đọc, flag=quan trọng, unflag=bỏ quan trọng, delete=xóa'),
        })
        .strict(),
    func: async ({ uid, mailbox, action }) => {
        logger.info('Tool: mark_email', { uid, action });
        try {
            await withImap(async (client) => {
                await client.mailboxOpen(mailbox);
                const flagMap = {
                    read: { add: ['\\Seen'] },
                    unread: { remove: ['\\Seen'] },
                    flag: { add: ['\\Flagged'] },
                    unflag: { remove: ['\\Flagged'] },
                    delete: { add: ['\\Deleted'] },
                };
                const { add, remove } = flagMap[action];
                if (add) await client.messageFlagsAdd({ uid }, add, { uid: true });
                if (remove) await client.messageFlagsRemove({ uid }, remove, { uid: true });
                if (action === 'delete') await client.messageDelete({ uid }, { uid: true });
            });
            return ok({ uid, action, done: true });
        } catch (err) {
            logger.error('mark_email error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const emailTools = [
    sendEmailTool,
    replyEmailTool,
    readEmailsTool,
    searchEmailsTool,
    draftEmailTool,
    markEmailTool,
];
