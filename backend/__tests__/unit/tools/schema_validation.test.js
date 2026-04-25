import { describe, test, expect, beforeAll, vi } from 'vitest';

// Minimal mocks so all tools can be imported
vi.mock('@tavily/core', () => ({ tavily: vi.fn(() => ({ search: vi.fn() })) }));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));
vi.mock('imapflow', () => ({ ImapFlow: vi.fn() }));
vi.mock('qrcode', () => ({ default: { toFile: vi.fn() } }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('node-cron', () => ({ default: { validate: vi.fn(), schedule: vi.fn() } }));
vi.mock('fs', () => {
    const m = {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn().mockReturnValue('[]'),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        statSync: vi.fn().mockReturnValue({ isDirectory: () => false, isFile: () => true, size: 0, mtime: new Date() }),
        readdirSync: vi.fn().mockReturnValue([]),
        unlinkSync: vi.fn(),
        rmdirSync: vi.fn(),
        appendFileSync: vi.fn(),
    };
    return { default: m, ...m };
});
vi.mock('../../../config/chorma.config.js', () => ({ ChromaDB: {} }));
vi.mock('../../../config/llm.config.js', () => ({
    openChatModel: { pipe: vi.fn().mockReturnThis(), invoke: vi.fn() },
}));
vi.mock('../../../helper/prompt.js', () => ({ SYSTEM_SUMMARY_PROMPT: '' }));

let tools;
beforeAll(async () => {
    const mod = await import('../../../tools/index.js');
    tools = mod.tools;
});

describe('All tools — Zod schema validation', () => {
    test('all tools have non-empty name', () => {
        for (const tool of tools) {
            expect(tool.name.length).toBeGreaterThan(0);
        }
    });

    test('all tools have description longer than 20 chars', () => {
        for (const tool of tools) {
            expect(tool.description.length, `Tool "${tool.name}" description too short`).toBeGreaterThan(20);
        }
    });

    test('all tools have a schema (func property)', () => {
        for (const tool of tools) {
            expect(typeof tool.func).toBe('function');
        }
    });

    test('no two tools share the same name', () => {
        const names = tools.map((t) => t.name);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
    });

    // Schema rejection tests — invalid inputs must fail safeParse
    // Note: tool.func() bypasses Zod validation (LangChain validates at agent level)
    // Use tool.schema.safeParse() to test schema constraints directly
    const invalidInputCases = [
        // [toolName, invalidInput, reason]
        ['calculate_math', { expression: '' }, 'empty expression violates min(1)'],
        ['calculate_math', { expression: 123 }, 'number instead of string'],
        ['calculate_math', {}, 'missing required field'],
        ['web_search', { query: '' }, 'empty query violates min(1)'],
        ['web_search', {}, 'missing required field'],
        ['send_email', { subject: 'hi', body: 'hi' }, 'missing required "to" field'],
        ['send_email', { to: 'bad-email', subject: 'x', body: 'y' }, 'invalid email format'],
        ['create_file', { content: 'x' }, 'missing required "filePath" field'],
        ['create_file', {}, 'missing all required fields'],
        ['read_file', {}, 'missing required "filePath" field'],
        ['delete_file', {}, 'missing required "filePath" field'],
        ['create_automation', { name: 'x' }, 'missing task and schedule'],
        ['toggle_automation', { id: 'x' }, 'missing required "enabled" field'],
        ['delete_automation', {}, 'missing required "id" field'],
        ['generate_qr_code', {}, 'missing required "content" field'],
        ['shorten_url', { url: 'not-a-url' }, 'invalid URL format'],
        ['mark_email', { uid: 1, mailbox: 'INBOX' }, 'missing required "action" field'],
        ['mark_email', { uid: 1, mailbox: 'INBOX', action: 'invalid_action' }, 'invalid enum value'],
    ];

    test.each(invalidInputCases)('tool "%s" rejects invalid input via schema: %s', (toolName, invalidInput, reason) => {
        const tool = tools.find((t) => t.name === toolName);
        expect(tool, `Tool "${toolName}" not found`).toBeDefined();
        const { success } = tool.schema.safeParse(invalidInput);
        expect(success, `Expected schema to reject: ${reason}`).toBe(false);
    });
});

describe('Tool registry completeness', () => {
    const expectedTools = [
        'calculate_math',
        'current_time',
        'web_search',
        'api_call',
        'send_email',
        'reply_email',
        'read_emails',
        'search_emails',
        'draft_email',
        'mark_email',
        'list_files',
        'read_file',
        'create_file',
        'write_file',
        'delete_file',
        'search_files',
        'create_automation',
        'list_automations',
        'toggle_automation',
        'delete_automation',
        'translate_text',
        'calculate',
        'convert_timezone',
        'get_current_time',
        'generate_qr_code',
        'shorten_url',
        'get_exchange_rate',
    ];

    test.each(expectedTools)('tool "%s" is registered', (toolName) => {
        const found = tools.find((t) => t.name === toolName);
        expect(found, `Expected tool "${toolName}" to be registered`).toBeDefined();
    });
});
