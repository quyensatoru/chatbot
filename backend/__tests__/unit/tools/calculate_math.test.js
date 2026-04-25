import { describe, test, expect, beforeAll } from 'vitest';

// calculateMathTool is pure (mathjs) — no external mocks needed
let calculateMathTool;
beforeAll(async () => {
    const mod = await import('../../../tools/calculate_math.js');
    calculateMathTool = mod.calculateMathTool;
});

describe('calculate_math tool', () => {
    describe('basic arithmetic', () => {
        test.each([
            ['2 + 2', '4'],
            ['10 - 3', '7'],
            ['6 * 7', '42'],
            ['100 / 4', '25'],
            ['2 ^ 10', '1024'],
            ['(3 + 4) * 2', '14'],
        ])('expression "%s" → %s', async (expression, expected) => {
            const raw = await calculateMathTool.func({ expression });
            const result = JSON.parse(raw);
            expect(result.success).toBe(true);
            expect(result.data.result).toBe(expected);
        });
    });

    describe('advanced math', () => {
        test('sqrt(144) = 12', async () => {
            const result = JSON.parse(await calculateMathTool.func({ expression: 'sqrt(144)' }));
            expect(result.success).toBe(true);
            expect(result.data.result).toBe('12');
        });

        test('sin(pi / 2) ≈ 1', async () => {
            const result = JSON.parse(await calculateMathTool.func({ expression: 'sin(pi / 2)' }));
            expect(result.success).toBe(true);
            expect(parseFloat(result.data.result)).toBeCloseTo(1, 5);
        });

        test('log(1000, 10) = 3', async () => {
            const result = JSON.parse(await calculateMathTool.func({ expression: 'log(1000, 10)' }));
            expect(result.success).toBe(true);
            expect(parseFloat(result.data.result)).toBeCloseTo(3, 5);
        });

        test('10! = 3628800', async () => {
            const result = JSON.parse(await calculateMathTool.func({ expression: '10!' }));
            expect(result.success).toBe(true);
            expect(result.data.result).toBe('3628800');
        });

        test('matrix multiplication [[1,2],[3,4]] * [[5],[6]]', async () => {
            const result = JSON.parse(await calculateMathTool.func({ expression: '[[1,2],[3,4]] * [[5],[6]]' }));
            expect(result.success).toBe(true);
            expect(result.data.result).toContain('17');
            expect(result.data.result).toContain('39');
        });
    });

    describe('response shape', () => {
        test('returns expression and numeric value', async () => {
            const result = JSON.parse(await calculateMathTool.func({ expression: '5 + 5' }));
            expect(result.success).toBe(true);
            expect(result.data).toMatchObject({
                expression: '5 + 5',
                result: '10',
                numeric: 10,
            });
        });
    });

    describe('error cases', () => {
        test('invalid expression returns fail', async () => {
            const result = JSON.parse(await calculateMathTool.func({ expression: 'not_a_function(x)' }));
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Biểu thức không hợp lệ/);
        });

        test('garbled input returns fail', async () => {
            const result = JSON.parse(await calculateMathTool.func({ expression: 'abc + xyz' }));
            expect(result.success).toBe(false);
        });

        test('empty expression fails Zod schema (min:1)', () => {
            const { success } = calculateMathTool.schema.safeParse({ expression: '' });
            expect(success).toBe(false);
        });

        test('non-string expression fails Zod schema', () => {
            const { success } = calculateMathTool.schema.safeParse({ expression: 123 });
            expect(success).toBe(false);
        });

        test('missing expression field fails Zod schema', () => {
            const { success } = calculateMathTool.schema.safeParse({});
            expect(success).toBe(false);
        });
    });
});
