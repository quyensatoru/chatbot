import { describe, test, expect, beforeAll, vi, afterEach } from 'vitest';

// Mock tool.config.js — skip retry delays so tests run fast
vi.mock('../../../config/tool.config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    withRetry: (fn) => fn(),  // no retry delays in tests
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  };
});

// Mock @tavily/core before importing the tool
vi.mock('@tavily/core', () => ({
  tavily: vi.fn(),
}));

// Mock chromadb and langchain imports used in web_search.js
vi.mock('../../../config/chorma.config.js', () => ({
  ChromaDB: { addDocuments: vi.fn(), similaritySearch: vi.fn() },
}));
vi.mock('../../../config/llm.config.js', () => ({
  openChatModel: {
    invoke: vi.fn().mockResolvedValue({ content: 'Summary' }),
    pipe: vi.fn().mockReturnThis(),
  },
}));
vi.mock('../../../helper/prompt.js', () => ({
  SYSTEM_SUMMARY_PROMPT: 'You are a helpful assistant.',
}));

let webSearchTool;
let tavilyMock;
let mockSearchFn;

beforeAll(async () => {
  const { tavily } = await import('@tavily/core');
  mockSearchFn = vi.fn();
  tavily.mockReturnValue({ search: mockSearchFn });

  const mod = await import('../../../tools/web_search.js');
  webSearchTool = mod.webSearchTool;
});

afterEach(() => { vi.clearAllMocks(); });

describe('web_search tool', () => {
  describe('happy path', () => {
    test('returns search results as text', async () => {
      mockSearchFn.mockResolvedValueOnce({
        results: [
          { content: 'Node.js is a JavaScript runtime.' },
          { content: 'It uses the V8 engine.' },
          { content: 'Popular for server-side apps.' },
        ],
      });

      const result = JSON.parse(await webSearchTool.func({ query: 'What is Node.js?' }));
      expect(result.success).toBe(true);
      expect(result.data.result).toContain('Node.js is a JavaScript runtime');
      expect(result.data.result).toContain('V8 engine');
    });

    test('calls Tavily with maxResults=5 and maxTokens=1000', async () => {
      mockSearchFn.mockResolvedValueOnce({ results: [{ content: 'ok' }] });

      await webSearchTool.func({ query: 'test query' });
      expect(mockSearchFn).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({ maxResults: 5, maxTokens: 1000 })
      );
    });

    test('joins multiple result contents with double newline', async () => {
      mockSearchFn.mockResolvedValueOnce({
        results: [{ content: 'Part 1' }, { content: 'Part 2' }],
      });
      const result = JSON.parse(await webSearchTool.func({ query: 'test' }));
      expect(result.data.result).toBe('Part 1\n\nPart 2');
    });

    test('empty results returns success with empty string', async () => {
      mockSearchFn.mockResolvedValueOnce({ results: [] });
      const result = JSON.parse(await webSearchTool.func({ query: 'xyzzy_nonexistent_9999' }));
      expect(result.success).toBe(true);
      expect(result.data.result).toBe('');
    });
  });

  describe('error cases', () => {
    test('API error returns fail', async () => {
      mockSearchFn.mockRejectedValueOnce(new Error('Tavily API unavailable'));
      const result = JSON.parse(await webSearchTool.func({ query: 'test' }));
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tavily API unavailable');
    });

    test('401 Unauthorized returns fail', async () => {
      mockSearchFn.mockRejectedValueOnce(new Error('Unauthorized: invalid API key'));
      const result = JSON.parse(await webSearchTool.func({ query: 'test' }));
      expect(result.success).toBe(false);
    });

    test('network timeout returns fail', async () => {
      mockSearchFn.mockRejectedValueOnce(new Error('ETIMEDOUT'));
      const result = JSON.parse(await webSearchTool.func({ query: 'weather today' }));
      expect(result.success).toBe(false);
    });

    test('empty query fails Zod schema (min:1)', () => {
      const { success } = webSearchTool.schema.safeParse({ query: '' });
      expect(success).toBe(false);
    });

    test('missing query field fails Zod schema', () => {
      const { success } = webSearchTool.schema.safeParse({});
      expect(success).toBe(false);
    });
  });

  describe('tool metadata', () => {
    test('has correct name', () => {
      expect(webSearchTool.name).toBe('web_search');
    });

    test('description mentions Tavily', () => {
      expect(webSearchTool.description).toContain('Tavily');
    });
  });
});
