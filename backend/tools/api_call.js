import * as z from "zod";
import { tool } from "langchain";
import axios from "axios";

const ApiCallInput = z.object({
    url: z.string().url().describe("API endpoint to send the request to."),
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method to use for the request."),
    headers: z.record(z.string()).optional().default({}).describe("Optional headers to include in the request."),
    body: z.record(z.unknown()).optional().default({}).describe("Optional body to include in the request."),
});

export const api_call = tool(
    async (input) => {
        try {
            const response = await axios({
                url: input.url,
                method: input.method,
                headers: input.headers,
                data: input.body,
            });
            return response.data;
        } catch (error) {
            throw new Error(`API call failed: ${error.message}`);
        }
    },
    {
        name: "api_call",
        description: "Makes HTTP requests to specified API endpoints. Call this tool when you need to interact with external APIs. Returns the response data.",
        schema: ApiCallInput,
    }
);