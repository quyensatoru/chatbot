import { apiTool } from './api_call.js';
import { calculateTools } from './calculate_math.js';
import { currentTool } from './current_time.js';
import { documentTools } from './document_rag.js';
import { searchTools } from './web_search.js';
import { calendarTools } from './calendar.js';
import { emailTools } from './email.js';
import { fileTools } from './file.js';
import { messagingTools } from './message_chat.js';
import { taskTools } from './task_execute.js';
import { utilityTools } from './utility.js';
import { financeTools } from './finance.js';
import { automationTools } from './automation.js';

export const tools = [
    ...apiTool,
    ...calculateTools,
    ...currentTool,
    ...documentTools,
    ...searchTools,
    ...calendarTools,
    ...emailTools,
    ...fileTools,
    ...messagingTools,
    ...taskTools,
    ...utilityTools,
    ...financeTools,
    ...automationTools,
];
