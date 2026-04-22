import OpenAI from "openai/index.mjs";
import { OPENAI_API_KEY, OPENAI_MODEL } from "../config.js";
import { SYSTEM_PROMPT, buildAnalysisPrompt } from "../prompts/analysis_prompt.js";
import { computeStats, pickSampleMessages } from "./stats.js";
import { buildProfile } from "../models/user_profile.js";

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function analyzeUser(userInfo, messages) {
    const stats = computeStats(messages);
    const samples = pickSampleMessages(messages, 100);
    const sampleText = formatSamples(samples);

    const prompt = buildAnalysisPrompt({ userInfo, stats, sampleText });

    const llmResult = await callLLM(prompt);
    return buildProfile(userInfo, stats, llmResult);
}

async function callLLM(prompt) {
    const resp = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
    });

    return JSON.parse(resp.choices[0].message.content);
}

function formatSamples(samples) {
    return samples.map((m, i) => {
        const date = m.ts.slice(0, 10);
        const text = m.text.replace(/\n/g, " ").trim().slice(0, 300);
        return `${i + 1}. [${date}][#${m.channel}] ${text}`;
    }).join("\n");
}
