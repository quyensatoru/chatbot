import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { google } from 'googleapis';
import { config, logger, withRetry, ok, fail } from '../config/tool.config.js';

// Lưu chi tiêu vào Google Sheets (sheet tên "Expenses")
// Cấu trúc cột: Date | Category | Description | Amount | Currency | Notes

const SPREADSHEET_ID = process.env.FINANCE_SPREADSHEET_ID;
const SHEET_NAME = 'Expenses';

function getAuth() {
    const auth = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, config.google.redirectUri);
    auth.setCredentials({ refresh_token: config.google.refreshToken });
    return auth;
}

function getSheets() {
    return google.sheets({ version: 'v4', auth: getAuth() });
}

const CategorySchema = z.enum([
    'food',
    'transport',
    'shopping',
    'entertainment',
    'health',
    'education',
    'utilities',
    'housing',
    'travel',
    'other',
]);

// ─── Tools ────────────────────────────────────────────────────────────────────

export const addExpenseTool = new DynamicStructuredTool({
    name: 'add_expense',
    description: 'Ghi lại chi tiêu mới vào sổ tài chính. Dùng khi người dùng muốn theo dõi chi tiêu.',
    schema: z
        .object({
            amount: z.number().positive().describe('Số tiền chi tiêu'),
            currency: z.string().length(3).default('VND').describe('Đơn vị tiền tệ (VND, USD...)'),
            category: CategorySchema.describe('Danh mục chi tiêu'),
            description: z.string().describe('Mô tả khoản chi tiêu'),
            date: z.string().optional().describe('Ngày chi tiêu (YYYY-MM-DD). Mặc định: hôm nay'),
            notes: z.string().optional().describe('Ghi chú thêm'),
        })
        .strict(),
    func: async ({ amount, currency, category, description, date, notes }) => {
        logger.info('Tool: add_expense', { amount, category });
        try {
            const sheets = getSheets();
            const today = date || new Date().toISOString().split('T')[0];
            const row = [today, category, description, amount, currency.toUpperCase(), notes || ''];

            await withRetry(() =>
                sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAME}!A:F`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [row] },
                }),
            );

            return ok({ recorded: true, date: today, amount, currency, category, description });
        } catch (err) {
            logger.error('add_expense error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const checkExpenseTool = new DynamicStructuredTool({
    name: 'check_expense',
    description: 'Xem thống kê chi tiêu theo khoảng thời gian hoặc danh mục.',
    schema: z
        .object({
            startDate: z.string().describe('Ngày bắt đầu (YYYY-MM-DD)'),
            endDate: z.string().optional().describe('Ngày kết thúc (YYYY-MM-DD). Mặc định: hôm nay'),
            category: CategorySchema.optional().describe('Lọc theo danh mục (để trống để xem tất cả)'),
            currency: z.string().default('VND').describe('Đơn vị tiền tệ cần tổng hợp'),
        })
        .strict(),
    func: async ({ startDate, endDate, category, currency }) => {
        logger.info('Tool: check_expense', { startDate, endDate });
        try {
            const sheets = getSheets();
            const end = endDate || new Date().toISOString().split('T')[0];

            const res = await withRetry(() =>
                sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAME}!A:F`,
                }),
            );

            const rows = (res.data.values || []).slice(1); // skip header
            const curr = currency.toUpperCase();

            const filtered = rows.filter((row) => {
                const [date, cat, , , rowCurr] = row;
                const inRange = date >= startDate && date <= end;
                const matchCat = !category || cat === category;
                const matchCurr = rowCurr === curr;
                return inRange && matchCat && matchCurr;
            });

            const total = filtered.reduce((sum, row) => sum + parseFloat(row[3] || 0), 0);

            const byCategory = {};
            for (const row of filtered) {
                const cat = row[1];
                if (!byCategory[cat]) byCategory[cat] = 0;
                byCategory[cat] += parseFloat(row[3] || 0);
            }

            const recent = filtered.slice(-10).map(([date, cat, desc, amount, cur, notes]) => ({
                date,
                category: cat,
                description: desc,
                amount: parseFloat(amount),
                currency: cur,
                notes,
            }));

            return ok({
                period: { from: startDate, to: end },
                currency: curr,
                totalExpense: total,
                formattedTotal: total.toLocaleString('vi-VN'),
                transactionCount: filtered.length,
                byCategory,
                recentTransactions: recent,
            });
        } catch (err) {
            logger.error('check_expense error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const financeTools = [addExpenseTool, checkExpenseTool];
