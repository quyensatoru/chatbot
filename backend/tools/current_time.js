import * as z from "zod";
import { tool } from "langchain";

const CurrentTimeInput = z.object({})

export const current_time = tool(
    async () => {
        return { currentTime: new Date().toISOString() };
    },
    {
        name: "current_time",
        description: "Provides the current date and time in ISO format. Call this tool when you need the current system time.",
        schema: CurrentTimeInput,
    }
);