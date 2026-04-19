import { apiTool } from "./api_call.js";
import { calculateTools } from "./calculate_math.js";
import { currentTool } from "./current_time.js";
import { documentTools } from "./document_rag.js";
import { searchTools } from "./web_search.js";
import { calendarTools } from "./calendar.js";
import * as emailTools from "./email.js";
import * as fileTools from "./file.js";
import * as chatTools from "./message_chat.js";
import * as taskTools from "./task_execute.js";
import * as utilityTools from "./utility.js";
import { financeTools } from "./finance.js";


export const tools = [
    ...apiTool,
    ...calculateTools,
    ...currentTool,
    ...documentTools,
    ...searchTools,
    ...calendarTools,
    // ...emailTools,
    // ...fileTools,
    // ...chatTools,
    // ...taskTools,
    // ...utilityTools,
    // ...financeTools,
]