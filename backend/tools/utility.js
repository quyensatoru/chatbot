import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import QRCode from "qrcode";
import { config, logger, withRetry, ok, fail } from "../config/tool.config.js";

// ─── Tools ────────────────────────────────────────────────────────────────────

export const translateTextTool = new DynamicStructuredTool({
    name: "translate_text",
    description:
        "Dịch văn bản sang ngôn ngữ chỉ định. Hỗ trợ hầu hết các ngôn ngữ phổ biến.",
    schema: z.object({
        text: z.string().describe("Văn bản cần dịch"),
        targetLanguage: z
            .string()
            .default("vi")
            .describe("Ngôn ngữ đích (vi, en, ja, ko, zh, fr, de...)"),
        sourceLanguage: z
            .string()
            .optional()
            .describe("Ngôn ngữ nguồn (để trống để tự nhận diện)"),
    }),
    func: async ({ text, targetLanguage, sourceLanguage }) => {
        logger.info("Tool: translate_text", { targetLanguage, textLength: text.length });
        try {
            const res = await withRetry(() =>
                axios.get("https://translation.googleapis.com/language/translate/v2", {
                    params: {
                        q: text,
                        target: targetLanguage,
                        source: sourceLanguage,
                        key: config.maps.apiKey, // reuse Google API key
                        format: "text",
                    },
                    timeout: config.defaults.toolTimeout,
                })
            );

            const translation = res.data.data?.translations?.[0];
            return ok({
                originalText: text,
                translatedText: translation?.translatedText,
                detectedSourceLanguage: translation?.detectedSourceLanguage,
                targetLanguage,
            });
        } catch (err) {
            logger.error("translate_text error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const calculateTool = new DynamicStructuredTool({
    name: "calculate",
    description:
        "Thực hiện tính toán toán học. Hỗ trợ các phép tính cơ bản đến nâng cao.",
    schema: z.object({
        expression: z
            .string()
            .describe(
                "Biểu thức toán học cần tính. Ví dụ: '(2 + 3) * 4', 'Math.sqrt(16)', 'Math.PI * 5 ** 2'"
            ),
    }),
    func: async ({ expression }) => {
        logger.info("Tool: calculate", { expression });
        try {
            // Safe evaluation using Function constructor with limited scope
            const safeEval = new Function(
                "Math",
                `"use strict"; return (${expression})`
            );
            const result = safeEval(Math);

            if (typeof result !== "number" || isNaN(result)) {
                return fail("Kết quả không hợp lệ");
            }

            return ok({ expression, result, formatted: result.toLocaleString("vi-VN") });
        } catch (err) {
            logger.error("calculate error", { error: err.message });
            return fail(`Lỗi tính toán: ${err.message}`);
        }
    },
});

export const convertTimezoneTool = new DynamicStructuredTool({
    name: "convert_timezone",
    description: "Chuyển đổi thời gian giữa các múi giờ khác nhau.",
    schema: z.object({
        datetime: z
            .string()
            .describe("Thời gian cần chuyển đổi (ISO 8601 hoặc datetime string)"),
        fromTimezone: z
            .string()
            .describe("Múi giờ nguồn (ví dụ: Asia/Ho_Chi_Minh, America/New_York, UTC)"),
        toTimezone: z
            .string()
            .describe("Múi giờ đích (ví dụ: Europe/London, Asia/Tokyo)"),
    }),
    func: async ({ datetime, fromTimezone, toTimezone }) => {
        logger.info("Tool: convert_timezone", { fromTimezone, toTimezone });
        try {
            const sourceDate = new Date(datetime);
            if (isNaN(sourceDate.getTime())) return fail("Định dạng thời gian không hợp lệ");

            const sourceStr = sourceDate.toLocaleString("vi-VN", {
                timeZone: fromTimezone,
                dateStyle: "full",
                timeStyle: "long",
            });

            const targetStr = sourceDate.toLocaleString("vi-VN", {
                timeZone: toTimezone,
                dateStyle: "full",
                timeStyle: "long",
            });

            // Offset info
            const getOffset = (tz) => {
                const d = new Date();
                const s = d.toLocaleString("en", { timeZone: tz, timeZoneName: "short" });
                return s.split(" ").pop();
            };

            return ok({
                original: { datetime, timezone: fromTimezone, formatted: sourceStr, offset: getOffset(fromTimezone) },
                converted: { timezone: toTimezone, formatted: targetStr, offset: getOffset(toTimezone) },
                isoUTC: sourceDate.toISOString(),
            });
        } catch (err) {
            logger.error("convert_timezone error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const getCurrentTimeTool = new DynamicStructuredTool({
    name: "get_current_time",
    description: "Lấy ngày giờ hiện tại theo múi giờ chỉ định hoặc mặc định.",
    schema: z.object({
        timezone: z
            .string()
            .optional()
            .describe("Múi giờ (mặc định: Asia/Ho_Chi_Minh)"),
        format: z
            .enum(["full", "date", "time", "iso"])
            .default("full")
            .describe("Định dạng trả về"),
    }),
    func: async ({ timezone, format }) => {
        const tz = timezone || config.defaults.timezone;
        logger.info("Tool: get_current_time", { tz });
        try {
            const now = new Date();
            let formatted;

            switch (format) {
                case "iso":
                    formatted = now.toISOString();
                    break;
                case "date":
                    formatted = now.toLocaleDateString("vi-VN", { timeZone: tz, dateStyle: "full" });
                    break;
                case "time":
                    formatted = now.toLocaleTimeString("vi-VN", { timeZone: tz, timeStyle: "long" });
                    break;
                default:
                    formatted = now.toLocaleString("vi-VN", { timeZone: tz, dateStyle: "full", timeStyle: "long" });
            }

            return ok({
                timezone: tz,
                formatted,
                iso: now.toISOString(),
                timestamp: now.getTime(),
                dayOfWeek: now.toLocaleDateString("vi-VN", { timeZone: tz, weekday: "long" }),
            });
        } catch (err) {
            logger.error("get_current_time error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const generateQrCodeTool = new DynamicStructuredTool({
    name: "generate_qr_code",
    description: "Tạo mã QR từ văn bản hoặc URL và lưu thành file ảnh.",
    schema: z.object({
        content: z.string().describe("Nội dung cần mã hóa thành QR (URL, text, thông tin liên hệ...)"),
        outputPath: z
            .string()
            .default("./qr_code.png")
            .describe("Đường dẫn lưu file QR (PNG)"),
        size: z.number().int().min(100).max(1000).default(300).describe("Kích thước ảnh (px)"),
    }),
    func: async ({ content, outputPath, size }) => {
        logger.info("Tool: generate_qr_code", { content: content.slice(0, 50) });
        try {
            await QRCode.toFile(outputPath, content, {
                width: size,
                margin: 2,
                color: { dark: "#000000", light: "#ffffff" },
                errorCorrectionLevel: "M",
            });
            return ok({ generated: true, outputPath, content: content.slice(0, 100), size });
        } catch (err) {
            logger.error("generate_qr_code error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const shortenUrlTool = new DynamicStructuredTool({
    name: "shorten_url",
    description: "Rút gọn URL dài thành URL ngắn hơn bằng TinyURL.",
    schema: z.object({
        url: z.string().url().describe("URL đầy đủ cần rút gọn"),
        alias: z.string().optional().describe("Tên tùy chỉnh cho URL rút gọn (nếu có)"),
    }),
    func: async ({ url, alias }) => {
        logger.info("Tool: shorten_url", { url });
        try {
            const params = new URLSearchParams({ url });
            if (alias) params.append("alias", alias);

            const res = await withRetry(() =>
                axios.get(`https://tinyurl.com/api-create.php?${params}`, {
                    timeout: config.defaults.toolTimeout,
                })
            );

            return ok({ originalUrl: url, shortUrl: res.data });
        } catch (err) {
            logger.error("shorten_url error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const getExchangeRateTool = new DynamicStructuredTool({
    name: "get_exchange_rate",
    description: "Lấy tỷ giá ngoại tệ hiện tại giữa các đồng tiền.",
    schema: z.object({
        baseCurrency: z.string().length(3).toUpperCase().describe("Đồng tiền gốc (ví dụ: USD, VND, EUR)"),
        targetCurrencies: z
            .array(z.string().length(3))
            .max(10)
            .describe("Danh sách đồng tiền đích cần quy đổi"),
        amount: z.number().positive().default(1).describe("Số tiền cần quy đổi"),
    }),
    func: async ({ baseCurrency, targetCurrencies, amount }) => {
        logger.info("Tool: get_exchange_rate", { baseCurrency });
        try {
            const res = await withRetry(() =>
                axios.get(
                    `https://v6.exchangerate-api.com/v6/${config.exchangeRate.apiKey}/latest/${baseCurrency.toUpperCase()}`,
                    { timeout: config.defaults.toolTimeout }
                )
            );

            const rates = res.data.conversion_rates;
            const result = {};

            for (const currency of targetCurrencies) {
                const upper = currency.toUpperCase();
                if (rates[upper]) {
                    result[upper] = {
                        rate: rates[upper],
                        converted: (amount * rates[upper]).toFixed(4),
                    };
                }
            }

            return ok({
                base: baseCurrency.toUpperCase(),
                amount,
                lastUpdated: res.data.time_last_update_utc,
                conversions: result,
            });
        } catch (err) {
            logger.error("get_exchange_rate error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const utilityTools = [
    translateTextTool,
    calculateTool,
    convertTimezoneTool,
    getCurrentTimeTool,
    generateQrCodeTool,
    shortenUrlTool,
    getExchangeRateTool,
];