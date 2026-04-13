import { api_call } from "./api_call.js";
import { calculate_math } from "./calculate_math.js";
import { current_time } from "./current_time.js";
import { document_rag } from "./document_rag.js";
import { web_search } from "./web_search.js";

export const tools = [
    api_call,
    document_rag,
    calculate_math,
    current_time,
    web_search,
]