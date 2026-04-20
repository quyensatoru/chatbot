import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { config, logger, withRetry, ok, fail } from "../config/tool.config.js";

export const apiCallTool = new DynamicStructuredTool({
    name: "api_call",
    description:
        "Gửi HTTP request tới một API endpoint bất kỳ. Dùng khi cần tương tác với API ngoài mà không có tool chuyên dụng. Trả về response data từ API.",
    schema: z.object({
        url: z.string().url().describe("URL đầy đủ của API endpoint, bao gồm protocol (https://...)"),
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).describe("HTTP method"),
        headers: z.record(z.string()).optional().default({}).describe("HTTP headers tùy chỉnh (key-value string)"),
        body: z.record(z.unknown()).optional().describe("Request body (chỉ dùng với POST/PUT/PATCH)"),
        params: z.record(z.string()).optional().describe("Query parameters cho GET request"),
    }).strict(),
    func: async ({ url, method, headers, body, params }) => {
        logger.info("Tool: api_call", { url, method });
        try {
            const res = await withRetry(() =>
                axios({
                    url,
                    method,
                    headers,
                    data: body,
                    params,
                    timeout: config.defaults.toolTimeout,
                })
            );
            return ok(res.data);
        } catch (err) {
            logger.error("api_call error", { error: err.message, url, method });
            return fail(err.response?.data?.message || err.message);
        }
    },
});

export const apiTool = [apiCallTool];
