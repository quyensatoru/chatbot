import { describe, test, expect, beforeAll, vi } from 'vitest';

// Mock tool.config.js to bypass retry delays
vi.mock('../../../config/tool.config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    withRetry: (fn) => fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

vi.mock('axios', () => ({
  default: vi.fn(),
}));

let apiCallTool;
let axios;

beforeAll(async () => {
  axios = (await import('axios')).default;
  const mod = await import('../../../tools/api_call.js');
  apiCallTool = mod.apiCallTool;
});

describe('api_call tool', () => {
  describe('happy path', () => {
    test('GET request returns data', async () => {
      axios.mockResolvedValueOnce({ data: { users: [{ id: 1, name: 'Alice' }] } });
      const result = JSON.parse(await apiCallTool.func({
        url: 'https://api.example.com/users',
        method: 'GET',
      }));
      expect(result.success).toBe(true);
      expect(result.data.users).toHaveLength(1);
    });

    test('POST request with body', async () => {
      axios.mockResolvedValueOnce({ data: { id: 42, created: true } });
      const result = JSON.parse(await apiCallTool.func({
        url: 'https://api.example.com/items',
        method: 'POST',
        body: { name: 'Test Item', price: 100 },
      }));
      expect(result.success).toBe(true);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST', data: { name: 'Test Item', price: 100 } })
      );
    });

    test('GET with query params', async () => {
      axios.mockResolvedValueOnce({ data: { page: 1, results: [] } });
      await apiCallTool.func({
        url: 'https://api.example.com/search',
        method: 'GET',
        params: { q: 'nodejs', page: '1' },
      });
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({ params: { q: 'nodejs', page: '1' } })
      );
    });

    test('custom Authorization header is forwarded', async () => {
      axios.mockResolvedValueOnce({ data: { ok: true } });
      await apiCallTool.func({
        url: 'https://api.example.com/protected',
        method: 'GET',
        headers: { Authorization: 'Bearer token123' },
      });
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({ headers: { Authorization: 'Bearer token123' } })
      );
    });

    test.each(['PUT', 'PATCH', 'DELETE'])('method "%s" is passed through', async (method) => {
      axios.mockResolvedValueOnce({ data: {} });
      const result = JSON.parse(await apiCallTool.func({
        url: 'https://api.example.com/resource/1',
        method,
      }));
      expect(result.success).toBe(true);
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({ method }));
    });
  });

  describe('error handling', () => {
    test('network error returns fail', async () => {
      axios.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = JSON.parse(await apiCallTool.func({
        url: 'https://unreachable.example.com/api',
        method: 'GET',
      }));
      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });

    test('API returns error response with message', async () => {
      axios.mockRejectedValueOnce(
        Object.assign(new Error('Not Found'), {
          response: { data: { message: 'Resource not found' }, status: 404 },
        })
      );
      const result = JSON.parse(await apiCallTool.func({
        url: 'https://api.example.com/missing',
        method: 'GET',
      }));
      expect(result.success).toBe(false);
      expect(result.error).toBe('Resource not found');
    });

    test('timeout error returns fail', async () => {
      axios.mockRejectedValueOnce(new Error('timeout of 30000ms exceeded'));
      const result = JSON.parse(await apiCallTool.func({
        url: 'https://slow.example.com/api',
        method: 'GET',
      }));
      expect(result.success).toBe(false);
    });
  });

  describe('schema validation', () => {
    test('invalid URL fails schema', () => {
      expect(apiCallTool.schema.safeParse({ url: 'not-a-url', method: 'GET' }).success).toBe(false);
    });

    test('invalid method fails schema', () => {
      expect(apiCallTool.schema.safeParse({ url: 'https://x.com', method: 'CONNECT' }).success).toBe(false);
    });

    test('missing URL fails schema', () => {
      expect(apiCallTool.schema.safeParse({ method: 'GET' }).success).toBe(false);
    });

    test('valid minimal input passes schema', () => {
      expect(apiCallTool.schema.safeParse({ url: 'https://x.com/api', method: 'GET' }).success).toBe(true);
    });
  });
});
