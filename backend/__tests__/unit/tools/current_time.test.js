import { describe, test, expect, beforeAll } from 'vitest';

let currentTimeTool;
beforeAll(async () => {
  const mod = await import('../../../tools/current_time.js');
  currentTimeTool = mod.currentTimeTool;
});

describe('current_time tool', () => {
  describe('happy path', () => {
    test('returns time for Asia/Ho_Chi_Minh', async () => {
      const result = JSON.parse(await currentTimeTool.func({ timezone: 'Asia/Ho_Chi_Minh' }));
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        timezone: 'Asia/Ho_Chi_Minh',
        iso: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        timestamp: expect.any(Number),
        formatted: expect.any(String),
        date: expect.any(String),
        time: expect.any(String),
        dayOfWeek: expect.any(String),
      });
    });

    test('returns time for America/New_York', async () => {
      const result = JSON.parse(await currentTimeTool.func({ timezone: 'America/New_York' }));
      expect(result.success).toBe(true);
      expect(result.data.timezone).toBe('America/New_York');
    });

    test('returns time for UTC', async () => {
      const result = JSON.parse(await currentTimeTool.func({ timezone: 'UTC' }));
      expect(result.success).toBe(true);
      expect(result.data.timezone).toBe('UTC');
    });

    test('uses default timezone when none provided', async () => {
      const result = JSON.parse(await currentTimeTool.func({}));
      expect(result.success).toBe(true);
      // Default is Asia/Ho_Chi_Minh per config
      expect(result.data.timezone).toBe('Asia/Ho_Chi_Minh');
    });

    test('timestamp is recent (within last 5 seconds)', async () => {
      const before = Date.now();
      const result = JSON.parse(await currentTimeTool.func({ timezone: 'UTC' }));
      const after = Date.now();
      expect(result.data.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.data.timestamp).toBeLessThanOrEqual(after);
    });

    test('iso format is valid ISO 8601', async () => {
      const result = JSON.parse(await currentTimeTool.func({ timezone: 'UTC' }));
      expect(new Date(result.data.iso).toISOString()).toBe(result.data.iso);
    });
  });

  describe('different timezones produce different formatted times', () => {
    test('Tokyo is UTC+9, London is UTC+0/+1', async () => {
      const tokyo  = JSON.parse(await currentTimeTool.func({ timezone: 'Asia/Tokyo' }));
      const london = JSON.parse(await currentTimeTool.func({ timezone: 'Europe/London' }));
      // Both succeed
      expect(tokyo.success).toBe(true);
      expect(london.success).toBe(true);
      // Formatted strings differ between timezones
      expect(tokyo.data.formatted).not.toBe(london.data.formatted);
    });
  });

  describe('error cases', () => {
    test('invalid timezone string returns fail', async () => {
      const result = JSON.parse(await currentTimeTool.func({ timezone: 'Invalid/Zone_XYZ' }));
      expect(result.success).toBe(false);
    });
  });
});
