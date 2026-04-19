import * as z from "zod";
import { tool } from "langchain";
import { evaluate } from "mathjs";

const CalculateMathInput = z.object({
    expression: z.string().min(1).describe("Mathematical expression to evaluate."),
});

const calculate_math = tool(
    async (input) => {
        try {
            const result = evaluate(input.expression);
            return { result };
        } catch (error) {
            throw new Error("Invalid mathematical expression.");
        }
    },
    {
        name: "calculate_math",
        description: "Evaluates mathematical expressions using the Math.js library. Call this tool when you need to perform calculations. Returns the result of the calculation.",
        schema: CalculateMathInput,
    }
);

export const calculateTools = [calculate_math]