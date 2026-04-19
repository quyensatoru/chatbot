import { tools } from "../tools/index.js";
import { createAgent } from "langchain";
import { openChatModel } from "./llm.config.js";
import { SYSTEM_SUMMARY_PROMPT } from "../helper/prompt.js";

/**
 * @typedef {import("langchain").ReactAgent<any>} Agent
 */

/** @type {Agent} */
let agent;

const InitAgent = () => {
    if(agent) return agent;
    
    agent = createAgent({
        model: openChatModel,
        tools: tools,
        name: "chatbot-agent",
        systemPrompt: SYSTEM_SUMMARY_PROMPT,
    })

    return agent;
}

export default InitAgent;