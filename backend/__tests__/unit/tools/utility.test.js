import { describe, test, expect, beforeAll, vi } from 'vitest';

// Mock axios before importing utility tools
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

// Mock qrcode to avoid real file I/O
vi.mock('qrcode', () => ({
    default: {
        toFile: vi.fn().mockResolvedValue(undefined),
    },
}));

let translateTextTool,
    convertTimezoneTool,
    getCurrentTimeTool,
    generateQrCodeTool,
    shortenUrlTool,
    getExchangeRateTool,
    calculateTool;
let axiosMock;

beforeAll(async () => {
    axiosMock = (await import('axios')).default;
    const mod = await import('../../../tools/utility.js');
    translateTextTool = mod.translateTextTool;
    convertTimezoneTool = mod.convertTimezoneTool;
    getCurrentTimeTool = mod.getCurrentTimeTool;
    generateQrCodeTool = mod.generateQrCodeTool;
    shortenUrlTool = mod.shortenUrlTool;
    getExchangeRateTool = mod.getExchangeRateTool;
    calculateTool = mod.calculateTool;
});

// ─── translate_text ───────────────────────────────────────────────────────────
describe('translate_text tool', () => {
    test('translates successfully', async () => {
        axiosMock.get.mockResolvedValueOnce({
            data: {
                responseStatus: 200,
                responseData: { translatedText: 'Hello World' },
            },
        });
        const result = JSON.parse(
            await translateTextTool.func({
                text: 'Xin chào thế giới',
                targetLanguage: 'en',
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data.translatedText).toBe('Hello World');
        expect(result.data.targetLanguage).toBe('en');
    });

    test('returns fail when API returns non-200 status', async () => {
        axiosMock.get.mockResolvedValueOnce({
            data: { responseStatus: 429, responseDetails: 'Quota exceeded' },
        });
        const result = JSON.parse(await translateTextTool.func({ text: 'test', targetLanguage: 'en' }));
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Quota exceeded/);
    });

    test('returns fail on network error', async () => {
        axiosMock.get.mockRejectedValueOnce(new Error('Network Error'));
        const result = JSON.parse(await translateTextTool.func({ text: 'test', targetLanguage: 'fr' }));
        expect(result.success).toBe(false);
    });

    test('supports sourceLanguage override', async () => {
        axiosMock.get.mockResolvedValueOnce({
            data: { responseStatus: 200, responseData: { translatedText: 'Bonjour' } },
        });
        const result = JSON.parse(
            await translateTextTool.func({
                text: 'Hello',
                targetLanguage: 'fr',
                sourceLanguage: 'en',
            }),
        );
        expect(result.success).toBe(true);
        // Verify langpair was built correctly
        const callArgs = axiosMock.get.mock.calls.at(-1);
        expect(callArgs[1].params.langpair).toBe('en|fr');
    });
});

// ─── convert_timezone ─────────────────────────────────────────────────────────
describe('convert_timezone tool', () => {
    test('converts Ho Chi Minh to UTC correctly', async () => {
        const result = JSON.parse(
            await convertTimezoneTool.func({
                datetime: '2026-04-20T09:00:00.000Z',
                fromTimezone: 'Asia/Ho_Chi_Minh',
                toTimezone: 'UTC',
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            original: expect.objectContaining({ timezone: 'Asia/Ho_Chi_Minh' }),
            converted: expect.objectContaining({ timezone: 'UTC' }),
            isoUTC: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        });
    });

    test('converts UTC to Asia/Tokyo', async () => {
        const result = JSON.parse(
            await convertTimezoneTool.func({
                datetime: '2026-04-20T00:00:00.000Z',
                fromTimezone: 'UTC',
                toTimezone: 'Asia/Tokyo',
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data.converted.timezone).toBe('Asia/Tokyo');
    });

    test('invalid datetime string returns fail', async () => {
        const result = JSON.parse(
            await convertTimezoneTool.func({
                datetime: 'not-a-date',
                fromTimezone: 'UTC',
                toTimezone: 'Asia/Tokyo',
            }),
        );
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/không hợp lệ/);
    });

    test('invalid timezone returns fail', async () => {
        const result = JSON.parse(
            await convertTimezoneTool.func({
                datetime: '2026-04-20T09:00:00.000Z',
                fromTimezone: 'Invalid/Zone',
                toTimezone: 'UTC',
            }),
        );
        expect(result.success).toBe(false);
    });
});

// ─── get_current_time ────────────────────────────────────────────────────────
describe('get_current_time tool', () => {
    test('returns full format by default', async () => {
        const result = JSON.parse(await getCurrentTimeTool.func({}));
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            timezone: 'Asia/Ho_Chi_Minh',
            formatted: expect.any(String),
            iso: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
            timestamp: expect.any(Number),
        });
    });

    test.each(['full', 'date', 'time', 'iso'])('format="%s" returns success', async (format) => {
        const result = JSON.parse(await getCurrentTimeTool.func({ format }));
        expect(result.success).toBe(true);
        expect(result.data.formatted).toBeDefined();
    });
});

// ─── generate_qr_code ────────────────────────────────────────────────────────
describe('generate_qr_code tool', () => {
    test('generates QR for URL', async () => {
        const result = JSON.parse(
            await generateQrCodeTool.func({
                content: 'https://example.com',
                outputPath: '/tmp/test_qr.png',
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            generated: true,
            outputPath: '/tmp/test_qr.png',
            content: 'https://example.com',
        });
    });

    test('generates QR for plain text', async () => {
        const result = JSON.parse(
            await generateQrCodeTool.func({
                content: 'Hello World',
                outputPath: '/tmp/test_qr2.png',
            }),
        );
        expect(result.success).toBe(true);
    });

    test('toFile was called with correct params', async () => {
        const QRCode = (await import('qrcode')).default;
        await generateQrCodeTool.func({ content: 'test', outputPath: '/tmp/qr.png', size: 400 });
        expect(QRCode.toFile).toHaveBeenCalledWith('/tmp/qr.png', 'test', expect.objectContaining({ width: 400 }));
    });

    test('long content is truncated in response (max 100 chars)', async () => {
        const longContent = 'x'.repeat(200);
        const result = JSON.parse(
            await generateQrCodeTool.func({
                content: longContent,
                outputPath: '/tmp/test_qr3.png',
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data.content.length).toBeLessThanOrEqual(100);
    });
});

// ─── shorten_url ─────────────────────────────────────────────────────────────
describe('shorten_url tool', () => {
    test('returns shortened URL', async () => {
        axiosMock.get.mockResolvedValueOnce({ data: 'https://tinyurl.com/abc123' });
        const result = JSON.parse(await shortenUrlTool.func({ url: 'https://example.com/very/long/path' }));
        expect(result.success).toBe(true);
        expect(result.data.shortUrl).toBe('https://tinyurl.com/abc123');
        expect(result.data.originalUrl).toBe('https://example.com/very/long/path');
    });

    test('network error returns fail', async () => {
        axiosMock.get.mockRejectedValueOnce(new Error('Timeout'));
        const result = JSON.parse(await shortenUrlTool.func({ url: 'https://example.com' }));
        expect(result.success).toBe(false);
    });

    test('invalid URL fails Zod schema validation', () => {
        const { success } = shortenUrlTool.schema.safeParse({ url: 'not-a-url' });
        expect(success).toBe(false);
    });
});

// ─── get_exchange_rate ────────────────────────────────────────────────────────
describe('get_exchange_rate tool', () => {
    test('returns conversion rates', async () => {
        axiosMock.get.mockResolvedValueOnce({
            data: {
                base: 'USD',
                date: '2026-04-20',
                rates: { VND: 25000, EUR: 0.92, JPY: 154.5 },
            },
        });
        const result = JSON.parse(
            await getExchangeRateTool.func({
                baseCurrency: 'USD',
                targetCurrencies: ['VND', 'EUR', 'JPY'],
                amount: 1,
            }),
        );
        expect(result.success).toBe(true);
        expect(result.data.conversions.VND.rate).toBe(25000);
        expect(result.data.conversions.EUR.rate).toBe(0.92);
    });

    test('converts amount correctly', async () => {
        axiosMock.get.mockResolvedValueOnce({
            data: { base: 'USD', date: '2026-04-20', rates: { VND: 25000 } },
        });
        const result = JSON.parse(
            await getExchangeRateTool.func({
                baseCurrency: 'USD',
                targetCurrencies: ['VND'],
                amount: 100,
            }),
        );
        expect(result.success).toBe(true);
        expect(parseFloat(result.data.conversions.VND.converted)).toBeCloseTo(2500000, 0);
    });

    test('API error returns fail', async () => {
        axiosMock.get.mockRejectedValueOnce(new Error('API unavailable'));
        const result = JSON.parse(
            await getExchangeRateTool.func({
                baseCurrency: 'USD',
                targetCurrencies: ['VND'],
                amount: 1,
            }),
        );
        expect(result.success).toBe(false);
    });
});

// ─── calculate (simple eval-based) ───────────────────────────────────────────
describe('calculate tool (utility)', () => {
    test.each([
        ['2 + 2', 4],
        ['Math.sqrt(16)', 4],
        ['Math.PI * 1', Math.PI],
    ])('expression "%s" returns correct result', async (expression, expected) => {
        const result = JSON.parse(await calculateTool.func({ expression }));
        expect(result.success).toBe(true);
        expect(result.data.result).toBeCloseTo(expected, 5);
    });

    test('non-numeric result returns fail', async () => {
        const result = JSON.parse(await calculateTool.func({ expression: '"string"' }));
        expect(result.success).toBe(false);
    });

    test('syntax error returns fail', async () => {
        const result = JSON.parse(await calculateTool.func({ expression: 'invalid syntax !!!' }));
        expect(result.success).toBe(false);
    });
});
