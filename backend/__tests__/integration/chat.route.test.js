import { describe, test, expect, beforeAll, vi, afterEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';

// Mock all heavy dependencies before any app import
vi.mock('../../config/mongo.config.js', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../config/mattermost.js',   () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../tools/automation.js', () => ({
  initAutomations:     vi.fn(),
  createAutomationTool: {},
  listAutomationsTool:  {},
  toggleAutomationTool: {},
  deleteAutomationTool: {},
  automationTools: [],
}));
vi.mock('../../tools/message_chat.js', () => ({
  initScheduledMessages: vi.fn(),
  messagingTools: [],
}));
vi.mock('../../services/agent.service.js', () => ({
  default: {
    chat: vi.fn(),
  },
}));
vi.mock('../../services/rag.service.js', () => ({
  default: {
    query: vi.fn(),
  },
}));
// Mock all tools to prevent real API calls
vi.mock('../../tools/index.js', () => ({ tools: [] }));
vi.mock('../../config/agent.config.js', () => ({ default: vi.fn() }));

let app;
let AgentService;
let RagService;

beforeAll(async () => {
  AgentService = (await import('../../services/agent.service.js')).default;
  RagService   = (await import('../../services/rag.service.js')).default;

  // Build a minimal Express app matching the real server (without DB/bot side effects)
  const { default: routers }          = await import('../../routers/index.js');
  const { default: errorMiddleware }  = await import('../../middleware/error.middleware.js');

  app = express();
  app.use(express.json());
  app.use(errorMiddleware);
  app.use('/api/', routers);
});

afterEach(() => { vi.clearAllMocks(); });

// ─── POST /api/chat/agent ─────────────────────────────────────────────────────
describe('POST /api/chat/agent', () => {
  test('200 — returns answer and conversationId', async () => {
    AgentService.chat.mockResolvedValueOnce([
      { role: 'user',      content: 'Hello' },
      { role: 'assistant', content: 'Xin chào! Tôi có thể giúp gì?' },
    ]);

    const res = await supertest(app)
      .post('/api/chat/agent')
      .send({ query: 'Hello', conversationId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.response.answer).toBe('Xin chào! Tôi có thể giúp gì?');
    expect(res.body.data.response.conversationId).toBe('session-1');
    expect(res.body.data.response.timestamp).toBeDefined();
  });

  test('200 — creates new conversationId when not provided', async () => {
    AgentService.chat.mockResolvedValueOnce([
      { role: 'assistant', content: 'Hi there!' },
    ]);

    const res = await supertest(app)
      .post('/api/chat/agent')
      .send({ query: 'Hello' });

    expect(res.status).toBe(200);
    expect(res.body.data.response.conversationId).toBeDefined();
    expect(typeof res.body.data.response.conversationId).toBe('string');
  });

  test('400 — missing query field', async () => {
    const res = await supertest(app)
      .post('/api/chat/agent')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Query is required/i);
  });

  test('400 — empty query string', async () => {
    const res = await supertest(app)
      .post('/api/chat/agent')
      .send({ query: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('500 — agent service throws returns 500', async () => {
    AgentService.chat.mockRejectedValueOnce(new Error('LLM unavailable'));

    const res = await supertest(app)
      .post('/api/chat/agent')
      .send({ query: 'test', conversationId: 'err-session' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('conversation history is appended for same session', async () => {
    const convId = `conv-${Date.now()}`;

    AgentService.chat.mockResolvedValue([
      { role: 'assistant', content: 'Response' },
    ]);

    // First turn
    await supertest(app).post('/api/chat/agent').send({ query: 'First message', conversationId: convId });
    // Second turn
    await supertest(app).post('/api/chat/agent').send({ query: 'Second message', conversationId: convId });

    // Second call should have history containing first message
    const secondCallArg = AgentService.chat.mock.calls[1][0];
    const hasFirstMessage = secondCallArg.some((m) => m.content === 'First message');
    expect(hasFirstMessage).toBe(true);
  });

  test('conversation history window is capped at 10 entries', async () => {
    const convId = `window-${Date.now()}`;
    AgentService.chat.mockResolvedValue([{ role: 'assistant', content: 'OK' }]);

    // Send 7 messages (each adds 2 to history: user + ai → 7*2 = 14, capped to 10)
    for (let i = 0; i < 7; i++) {
      await supertest(app).post('/api/chat/agent').send({ query: `Message ${i}`, conversationId: convId });
    }

    // The 7th call messages array should have ≤ 10 history entries + current = ≤ 11
    const lastCallArg = AgentService.chat.mock.calls.at(-1)[0];
    expect(lastCallArg.length).toBeLessThanOrEqual(11);
  });
});

// ─── POST /api/chat (RAG only) ────────────────────────────────────────────────
describe('POST /api/chat', () => {
  test('200 — returns RAG answer with sources', async () => {
    RagService.query.mockResolvedValueOnce({
      answer: 'The document explains RAG architecture.',
      confidence: 0.92,
      sources: [{ title: 'rag_guide.pdf', page: 1 }],
      selected_strategies: ['traditional'],
    });

    const res = await supertest(app)
      .post('/api/chat')
      .send({ query: 'What is RAG?', strategy: 'traditional' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.response.answer).toBe('The document explains RAG architecture.');
    expect(res.body.data.response.confidence).toBe(0.92);
    expect(res.body.data.response.sources).toHaveLength(1);
  });

  test('400 — missing query returns 400', async () => {
    const res = await supertest(app).post('/api/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('500 — RAG service error returns 500', async () => {
    RagService.query.mockRejectedValueOnce(new Error('ChromaDB unavailable'));
    const res = await supertest(app).post('/api/chat').send({ query: 'test' });
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  test('200 — returns healthy status', async () => {
    const res = await supertest(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/healthy/i);
  });
});
