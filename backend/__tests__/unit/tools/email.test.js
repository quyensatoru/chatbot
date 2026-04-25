import { describe, test, expect, beforeAll, beforeEach, vi } from 'vitest';

// ─── Shared IMAP mock instance (configured per-test) ─────────────────────────
// vitest's vi.fn() used as constructor: fn must return object explicitly
const imap = {
    connect: vi.fn(),
    logout: vi.fn(),
    mailboxOpen: vi.fn(),
    search: vi.fn(),
    list: vi.fn(),
    append: vi.fn(),
    messageFlagsAdd: vi.fn(),
    messageFlagsRemove: vi.fn(),
    messageDelete: vi.fn(),
    fetch: vi.fn(),
};

const imapConstructor = vi.fn(function () {
    return imap;
}); // regular fn, not arrow

vi.mock('imapflow', () => ({ ImapFlow: imapConstructor }));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));

let sendEmailTool, replyEmailTool, readEmailsTool, searchEmailsTool, draftEmailTool, markEmailTool;
let nodemailer;

beforeAll(async () => {
    nodemailer = (await import('nodemailer')).default;
    const mod = await import('../../../tools/email.js');
    sendEmailTool = mod.sendEmailTool;
    replyEmailTool = mod.replyEmailTool;
    readEmailsTool = mod.readEmailsTool;
    searchEmailsTool = mod.searchEmailsTool;
    draftEmailTool = mod.draftEmailTool;
    markEmailTool = mod.markEmailTool;
});

// Reset all imap mocks to safe defaults before each test
beforeEach(() => {
    imap.connect.mockResolvedValue(undefined);
    imap.logout.mockResolvedValue(undefined);
    imap.mailboxOpen.mockResolvedValue(undefined);
    imap.search.mockResolvedValue([]);
    imap.list.mockResolvedValue([]);
    imap.append.mockResolvedValue(undefined);
    imap.messageFlagsAdd.mockResolvedValue(undefined);
    imap.messageFlagsRemove.mockResolvedValue(undefined);
    imap.messageDelete.mockResolvedValue(undefined);
    // Default empty async iterable for fetch
    imap.fetch.mockReturnValue({
        [Symbol.asyncIterator]() {
            return {
                next() {
                    return Promise.resolve({ done: true, value: undefined });
                },
            };
        },
    });
    // Clear call history
    Object.values(imap).forEach((fn) => fn.mockClear());
    imapConstructor.mockClear();
    nodemailer.createTransport.mockReset();
});

// Helper: configure fetch to yield specific messages
function setupFetch(messages) {
    imap.fetch.mockReturnValue({
        [Symbol.asyncIterator]() {
            const iter = messages[Symbol.iterator]();
            return {
                next() {
                    const { value, done } = iter.next();
                    return Promise.resolve({ value, done: done ?? false });
                },
            };
        },
    });
}

// Helper: create SMTP transport mock
function setupSmtp(messageId = '<test@mail.com>') {
    const sendMail = vi.fn().mockResolvedValue({ messageId });
    nodemailer.createTransport.mockReturnValue({ sendMail });
    return sendMail;
}

// ─── send_email ───────────────────────────────────────────────────────────────
describe('send_email tool', () => {
    test('sends email with required fields', async () => {
        const sendMail = setupSmtp('<test-123@mail.com>');
        const result = JSON.parse(
            await sendEmailTool.func({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                body: 'Hello',
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('sent');
        expect(sendMail).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'recipient@example.com', subject: 'Test Subject' }),
        );
    });

    test('sends to multiple recipients (array)', async () => {
        setupSmtp();
        const result = JSON.parse(
            await sendEmailTool.func({
                to: ['a@test.com', 'b@test.com'],
                subject: 'Multi',
                body: 'Hi',
            }),
        );
        expect(result.success).toBe(true);
    });

    test('sends with CC and BCC', async () => {
        const sendMail = setupSmtp();
        const result = JSON.parse(
            await sendEmailTool.func({
                to: 'a@test.com',
                subject: 'Sub',
                body: 'Body',
                cc: ['cc@test.com'],
                bcc: ['bcc@test.com'],
            }),
        );
        expect(result.success).toBe(true);
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ cc: 'cc@test.com', bcc: 'bcc@test.com' }));
    });

    test('SMTP auth error returns fail', async () => {
        nodemailer.createTransport.mockReturnValue({
            sendMail: vi
                .fn()
                .mockRejectedValue(Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535 })),
        });
        const result = JSON.parse(
            await sendEmailTool.func({
                to: 'a@test.com',
                subject: 'Sub',
                body: 'Body',
            }),
        );
        expect(result.success).toBe(false);
    });

    test('invalid email fails Zod schema', () => {
        expect(sendEmailTool.schema.safeParse({ to: 'bad-email', subject: 'S', body: 'B' }).success).toBe(false);
    });

    test('missing "to" fails Zod schema', () => {
        expect(sendEmailTool.schema.safeParse({ subject: 'Sub', body: 'Body' }).success).toBe(false);
    });
});

// ─── reply_email ─────────────────────────────────────────────────────────────
describe('reply_email tool', () => {
    test('sends reply with Re: prefix added', async () => {
        const sendMail = setupSmtp('reply-id');
        const result = JSON.parse(
            await replyEmailTool.func({
                replyToMessageId: '<orig@mail.com>',
                to: 'sender@example.com',
                subject: 'Hello',
                body: 'Got it!',
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('replied');
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Re: Hello' }));
    });

    test('does not double-prefix Re:', async () => {
        const sendMail = setupSmtp();
        await replyEmailTool.func({
            replyToMessageId: '<id@m.com>',
            to: 'a@t.com',
            subject: 'Re: Already',
            body: 'OK',
        });
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Re: Already' }));
    });
});

// ─── read_emails ─────────────────────────────────────────────────────────────
describe('read_emails tool', () => {
    test('returns email list from INBOX', async () => {
        imap.search.mockResolvedValue([101]);
        setupFetch([
            {
                uid: 101,
                envelope: {
                    messageId: '<msg1@mail.com>',
                    from: [{ address: 'sender@example.com' }],
                    to: [{ address: 'me@example.com' }],
                    subject: 'Test Email',
                    date: new Date('2026-04-20'),
                },
                flags: new Set(['\\Seen']),
            },
        ]);

        const result = JSON.parse(await readEmailsTool.func({ mailbox: 'INBOX', onlyUnread: false, maxResults: 5 }));
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({
            uid: 101,
            subject: 'Test Email',
            from: 'sender@example.com',
            read: true,
        });
    });

    test('returns empty array when no emails match', async () => {
        imap.search.mockResolvedValue([]);
        const result = JSON.parse(await readEmailsTool.func({ mailbox: 'INBOX', onlyUnread: true, maxResults: 5 }));
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(0);
    });

    test('IMAP connect failure returns fail', async () => {
        imap.connect.mockRejectedValue(new Error('Connection refused'));
        const result = JSON.parse(await readEmailsTool.func({ mailbox: 'INBOX', onlyUnread: true, maxResults: 5 }));
        expect(result.success).toBe(false);
    });
});

// ─── search_emails ────────────────────────────────────────────────────────────
describe('search_emails tool', () => {
    test('searches by sender', async () => {
        imap.search.mockResolvedValue([55]);
        setupFetch([
            {
                uid: 55,
                envelope: {
                    messageId: '<m@mail.com>',
                    from: [{ address: 'boss@company.com' }],
                    subject: 'Important',
                    date: new Date(),
                },
                flags: new Set(),
            },
        ]);

        const result = JSON.parse(await searchEmailsTool.func({ from: 'boss@company.com', maxResults: 5 }));
        expect(result.success).toBe(true);
        expect(result.data[0].from).toBe('boss@company.com');
    });

    test('returns empty list when nothing found', async () => {
        imap.search.mockResolvedValue([]);
        const result = JSON.parse(await searchEmailsTool.func({ subject: 'Invoice', maxResults: 5 }));
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(0);
    });

    test('IMAP failure returns fail', async () => {
        imap.connect.mockRejectedValue(new Error('Auth failed'));
        const result = JSON.parse(await searchEmailsTool.func({ subject: 'test', maxResults: 5 }));
        expect(result.success).toBe(false);
    });
});

// ─── draft_email ─────────────────────────────────────────────────────────────
describe('draft_email tool', () => {
    test('saves draft to \\Drafts IMAP folder', async () => {
        imap.list.mockResolvedValue([{ path: 'Drafts', specialUse: '\\Drafts' }]);

        const result = JSON.parse(
            await draftEmailTool.func({
                to: 'someone@example.com',
                subject: 'Draft Subject',
                body: '<p>Draft</p>',
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('saved_as_draft');
        expect(imap.append).toHaveBeenCalledWith(
            'Drafts',
            expect.stringContaining('Draft Subject'),
            expect.arrayContaining(['\\Draft']),
        );
    });

    test('falls back to config.draftsFolder when no \\Drafts found', async () => {
        imap.list.mockResolvedValue([]); // no special-use Drafts
        const result = JSON.parse(
            await draftEmailTool.func({
                to: 'a@b.com',
                subject: 'Sub',
                body: 'Body',
            }),
        );
        expect(result.success).toBe(true);
        expect(imap.append).toHaveBeenCalled();
    });
});

// ─── mark_email ──────────────────────────────────────────────────────────────
describe('mark_email tool', () => {
    test.each([
        ['read', { expectAdd: ['\\Seen'], expectRemove: undefined }],
        ['unread', { expectAdd: undefined, expectRemove: ['\\Seen'] }],
        ['flag', { expectAdd: ['\\Flagged'], expectRemove: undefined }],
        ['unflag', { expectAdd: undefined, expectRemove: ['\\Flagged'] }],
    ])('action "%s" applies correct IMAP flags', async (action, { expectAdd, expectRemove }) => {
        const result = JSON.parse(await markEmailTool.func({ uid: 42, mailbox: 'INBOX', action }));
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({ uid: 42, action, done: true });
        if (expectAdd)
            expect(imap.messageFlagsAdd).toHaveBeenCalledWith(expect.anything(), expectAdd, expect.anything());
        if (expectRemove)
            expect(imap.messageFlagsRemove).toHaveBeenCalledWith(expect.anything(), expectRemove, expect.anything());
    });

    test('action "delete" marks \\Deleted and calls messageDelete', async () => {
        const result = JSON.parse(await markEmailTool.func({ uid: 99, mailbox: 'INBOX', action: 'delete' }));
        expect(result.success).toBe(true);
        expect(imap.messageFlagsAdd).toHaveBeenCalledWith(expect.anything(), ['\\Deleted'], expect.anything());
        expect(imap.messageDelete).toHaveBeenCalled();
    });

    test('invalid action fails Zod schema', () => {
        expect(markEmailTool.schema.safeParse({ uid: 1, mailbox: 'INBOX', action: 'invalid' }).success).toBe(false);
    });
});
