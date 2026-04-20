import { describe, test, expect, beforeAll, vi } from 'vitest';

// Mock RagService
vi.mock('../../../services/rag.service.js', () => ({
  default: { query: vi.fn() },
}));

let documentRagTool;
let RagService;

beforeAll(async () => {
  RagService = (await import('../../../services/rag.service.js')).default;
  const mod = await import('../../../tools/document_rag.js');
  documentRagTool = mod.documentRagTool;
});

describe('document_rag tool', () => {
  describe('happy path', () => {
    test('returns answer with sources', async () => {
      RagService.query.mockResolvedValueOnce({
        answer: 'The document discusses RAG architecture.',
        sources: [{ title: 'guide.pdf', page: 1 }],
        selected_strategies: ['traditional'],
        retrievals: { traditional: ['chunk1'] },
      });

      const result = JSON.parse(await documentRagTool.func({ query: 'What is RAG?', top_k: 5 }));
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        answer: 'The document discusses RAG architecture.',
        sources: expect.arrayContaining([expect.objectContaining({ title: 'guide.pdf' })]),
        strategies: ['traditional'],
      });
    });

    test('passes correct params to RagService', async () => {
      RagService.query.mockResolvedValueOnce({
        answer: 'answer', sources: [], selected_strategies: [], retrievals: {},
      });

      await documentRagTool.func({ query: 'My query', top_k: 10 });
      expect(RagService.query).toHaveBeenCalledWith({ query: 'My query', topK: 10 });
    });

    test('top_k schema default is 5', () => {
      // Zod default applies via schema.parse, not via func() directly
      const parsed = documentRagTool.schema.parse({ query: 'test' });
      expect(parsed.top_k).toBe(5);
    });

    test('handles missing optional fields gracefully', async () => {
      RagService.query.mockResolvedValueOnce({ answer: 'Some answer' });

      const result = JSON.parse(await documentRagTool.func({ query: 'test' }));
      expect(result.success).toBe(true);
      expect(result.data.sources).toEqual([]);
      expect(result.data.strategies).toEqual([]);
    });
  });

  describe('error handling', () => {
    test('RAG service unavailable returns fail', async () => {
      RagService.query.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = JSON.parse(await documentRagTool.func({ query: 'test' }));
      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });

    test('RAG service timeout returns fail', async () => {
      RagService.query.mockRejectedValueOnce(new Error('Request timeout'));
      const result = JSON.parse(await documentRagTool.func({ query: 'test' }));
      expect(result.success).toBe(false);
    });
  });

  describe('schema validation', () => {
    test('empty query fails schema', () => {
      expect(documentRagTool.schema.safeParse({ query: '' }).success).toBe(false);
    });

    test('missing query fails schema', () => {
      expect(documentRagTool.schema.safeParse({}).success).toBe(false);
    });

    test('top_k above max (20) fails schema', () => {
      expect(documentRagTool.schema.safeParse({ query: 'test', top_k: 25 }).success).toBe(false);
    });

    test('top_k below min (1) fails schema', () => {
      expect(documentRagTool.schema.safeParse({ query: 'test', top_k: 0 }).success).toBe(false);
    });

    test('valid input passes schema', () => {
      expect(documentRagTool.schema.safeParse({ query: 'test question', top_k: 10 }).success).toBe(true);
    });
  });
});
