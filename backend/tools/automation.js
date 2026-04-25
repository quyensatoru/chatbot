import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config, logger, ok, fail } from '../config/tool.config.js';

const JOBS_FILE = path.resolve('./data/automations.json');
const activeJobs = new Map(); // id → CronTask
let _invoker = null;

// Inline Mattermost post — avoids circular dep with message_chat.js
async function postToMattermost(channelId, message) {
    const res = await fetch(config.mattermost.botUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, message }),
    });
    if (!res.ok) throw new Error(`Mattermost ${res.status}: ${await res.text().catch(() => '')}`);
}

// Extract the last AI text from LangChain message array returned by AgentService.chat
function extractLastAIText(messages) {
    if (!Array.isArray(messages)) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const type = msg._getType?.() || msg.type || msg.role;
        if (type !== 'ai' && type !== 'assistant') continue;
        const content = msg.content;
        if (typeof content === 'string' && content.trim()) return content.trim();
        if (Array.isArray(content)) {
            const text = content
                .filter((c) => c.type === 'text')
                .map((c) => c.text)
                .join('')
                .trim();
            if (text) return text;
        }
    }
    return null;
}

const MESSAGING_TOOLS = new Set(['send_message', 'send_notification', 'send_image']);

// Returns true if agent already called a messaging tool (to avoid double-posting)
function hasMessagingToolCall(messages) {
    if (!Array.isArray(messages)) return false;
    for (const msg of messages) {
        const type = msg._getType?.() || msg.type || msg.role;
        if (type === 'ai' || type === 'assistant') {
            const toolCalls = msg.tool_calls || msg.additional_kwargs?.tool_calls || [];
            for (const tc of toolCalls) {
                const name = tc.name || tc.function?.name;
                if (name && MESSAGING_TOOLS.has(name)) return true;
            }
        }
    }
    return false;
}

const PRESET_CRON = {
    every_5min: '*/5 * * * *',
    every_15min: '*/15 * * * *',
    every_30min: '*/30 * * * *',
    every_hour: '0 * * * *',
    every_2hours: '0 */2 * * *',
    every_6hours: '0 */6 * * *',
    every_12hours: '0 */12 * * *',
    daily_7am: '0 7 * * *',
    daily_8am: '0 8 * * *',
    daily_9am: '0 9 * * *',
    daily_noon: '0 12 * * *',
    daily_6pm: '0 18 * * *',
    daily_9pm: '0 21 * * *',
    weekdays_9am: '0 9 * * 1-5',
    monday_9am: '0 9 * * 1',
};

function resolveCron(schedule) {
    return PRESET_CRON[schedule] || schedule;
}

function loadJobs() {
    try {
        if (fs.existsSync(JOBS_FILE)) {
            return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
        }
    } catch (e) {
        logger.warn('[Automation] Failed to load jobs file', { error: e.message });
    }
    return [];
}

function saveJobs(jobs) {
    fs.mkdirSync(path.dirname(JOBS_FILE), { recursive: true });
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

function startJob(jobDef) {
    const cronExpr = resolveCron(jobDef.schedule);
    if (!cron.validate(cronExpr)) return false;

    if (activeJobs.has(jobDef.id)) {
        activeJobs.get(jobDef.id).stop();
    }

    const task = cron.schedule(
        cronExpr,
        async () => {
            logger.info(`[Automation] "${jobDef.name}" triggered`, { id: jobDef.id });
            if (!_invoker) {
                logger.warn('[Automation] No invoker, skipping', { id: jobDef.id });
                return;
            }
            try {
                const result = await _invoker([
                    {
                        role: 'user',
                        content: `[AUTOMATION - THỰC HIỆN NGAY]
Đây là tác vụ tự động được kích hoạt theo lịch. Hãy thực thi NGAY bằng cách dùng các tool phù hợp.
KHÔNG hỏi thêm thông tin, KHÔNG xác nhận, KHÔNG đặt câu hỏi ngược lại.
Nếu thiếu thông tin, hãy tự quyết định dựa trên ngữ cảnh hoặc dùng giá trị hợp lý nhất.
Chỉ cần đưa ra kết quả ko cần trả lời gì thêm, ko call t

Tên job: ${jobDef.name}
Tác vụ: ${jobDef.task}`,
                    },
                ]);

                // Post agent's final text response only if agent didn't already send via messaging tool
                if (!hasMessagingToolCall(result)) {
                    const aiText = extractLastAIText(result);
                    if (aiText) {
                        const channelId = jobDef.channelId || config.mattermost.channelId;
                        await postToMattermost(channelId, aiText).catch((e) =>
                            logger.error(`[Automation] Failed to post result`, { error: e.message }),
                        );
                    }
                }

                logger.info(`[Automation] "${jobDef.name}" completed`);

                const jobs = loadJobs();
                const idx = jobs.findIndex((j) => j.id === jobDef.id);
                if (idx !== -1) {
                    jobs[idx].lastRunAt = new Date().toISOString();
                    jobs[idx].runCount = (jobs[idx].runCount || 0) + 1;
                    saveJobs(jobs);
                }
            } catch (err) {
                logger.error(`[Automation] "${jobDef.name}" failed`, { error: err.message });
            }
        },
        { scheduled: true, timezone: jobDef.timezone || config.defaults.timezone },
    );

    activeJobs.set(jobDef.id, task);
    return true;
}

// Called from server.js after agent is ready — avoids circular dependency
export function initAutomations(invoker) {
    _invoker = invoker;
    const jobs = loadJobs();
    const enabled = jobs.filter((j) => j.enabled);
    let started = 0;
    for (const job of enabled) {
        if (startJob(job)) started++;
    }
    if (jobs.length > 0) {
        logger.info(`[Automation] Started ${started}/${enabled.length} enabled jobs (${jobs.length} total)`);
    }
}

export const createAutomationTool = new DynamicStructuredTool({
    name: 'create_automation',
    description: `Tạo automation job định kỳ: AI tự động thực hiện một tác vụ theo lịch lặp lại rồi post kết quả lên Mattermost.
Ví dụ: "mỗi ngày 9 giờ sáng kiểm tra email mới rồi tóm tắt", "mỗi 30 phút check thời tiết Hà Nội".
Presets cho schedule: every_5min, every_15min, every_30min, every_hour, every_2hours, every_6hours, every_12hours, daily_7am, daily_8am, daily_9am, daily_noon, daily_6pm, daily_9pm, weekdays_9am, monday_9am.
Hoặc dùng cron expression chuẩn (vd: "0 9 * * 1-5").`,
    schema: z
        .object({
            name: z.string().describe('Tên ngắn gọn mô tả automation (vd: daily-weather-report)'),
            task: z.string().describe('Câu lệnh chi tiết cho AI thực hiện mỗi lần kích hoạt'),
            schedule: z.string().describe('Preset hoặc cron expression (xem mô tả tool)'),
            channelId: z
                .string()
                .optional()
                .describe('Mattermost channel ID nhận kết quả. Mặc định: channel đã cấu hình'),
            timezone: z.string().optional().describe('Múi giờ, mặc định: Asia/Ho_Chi_Minh'),
            enabled: z.boolean().default(true).describe('Bật ngay sau khi tạo'),
        })
        .strict(),
    func: async ({ name, task, schedule, channelId, timezone, enabled }) => {
        logger.info('Tool: create_automation', { name, schedule });
        try {
            const cronExpr = resolveCron(schedule);
            if (!cron.validate(cronExpr)) {
                return fail(`Lịch không hợp lệ: "${schedule}". Dùng preset hoặc cron expression hợp lệ.`);
            }

            const jobDef = {
                id: uuidv4(),
                name,
                task,
                schedule,
                cronExpression: cronExpr,
                channelId: channelId || null,
                timezone: timezone || config.defaults.timezone,
                enabled,
                createdAt: new Date().toISOString(),
                lastRunAt: null,
                runCount: 0,
            };

            const jobs = loadJobs();
            jobs.push(jobDef);
            saveJobs(jobs);

            if (enabled) startJob(jobDef);

            return ok({
                id: jobDef.id,
                name,
                schedule,
                cronExpression: cronExpr,
                timezone: jobDef.timezone,
                enabled,
                status: enabled ? 'running' : 'paused',
            });
        } catch (err) {
            logger.error('create_automation error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const listAutomationsTool = new DynamicStructuredTool({
    name: 'list_automations',
    description: 'Xem danh sách tất cả automation jobs đã tạo, trạng thái và lần chạy cuối.',
    schema: z.object({}).strict(),
    func: async () => {
        logger.info('Tool: list_automations');
        try {
            const jobs = loadJobs();
            const result = jobs.map((j) => ({
                id: j.id,
                name: j.name,
                task: j.task.slice(0, 120),
                schedule: j.schedule,
                cronExpression: j.cronExpression,
                timezone: j.timezone,
                enabled: j.enabled,
                running: activeJobs.has(j.id),
                lastRunAt: j.lastRunAt,
                runCount: j.runCount || 0,
                createdAt: j.createdAt,
            }));
            return ok({ total: result.length, jobs: result });
        } catch (err) {
            logger.error('list_automations error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const toggleAutomationTool = new DynamicStructuredTool({
    name: 'toggle_automation',
    description: 'Bật hoặc tắt một automation job.',
    schema: z
        .object({
            id: z.string().describe('ID của automation job (lấy từ list_automations)'),
            enabled: z.boolean().describe('true để bật, false để tắt'),
        })
        .strict(),
    func: async ({ id, enabled }) => {
        logger.info('Tool: toggle_automation', { id, enabled });
        try {
            const jobs = loadJobs();
            const idx = jobs.findIndex((j) => j.id === id);
            if (idx === -1) return fail(`Không tìm thấy automation ID: ${id}`);

            jobs[idx].enabled = enabled;
            saveJobs(jobs);

            if (enabled) {
                startJob(jobs[idx]);
            } else if (activeJobs.has(id)) {
                activeJobs.get(id).stop();
                activeJobs.delete(id);
            }

            return ok({ id, name: jobs[idx].name, enabled, status: enabled ? 'running' : 'paused' });
        } catch (err) {
            logger.error('toggle_automation error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const deleteAutomationTool = new DynamicStructuredTool({
    name: 'delete_automation',
    description: 'Xóa hẳn một automation job.',
    schema: z
        .object({
            id: z.string().describe('ID của automation job cần xóa'),
        })
        .strict(),
    func: async ({ id }) => {
        logger.info('Tool: delete_automation', { id });
        try {
            const jobs = loadJobs();
            const idx = jobs.findIndex((j) => j.id === id);
            if (idx === -1) return fail(`Không tìm thấy automation ID: ${id}`);

            const name = jobs[idx].name;
            if (activeJobs.has(id)) {
                activeJobs.get(id).stop();
                activeJobs.delete(id);
            }
            jobs.splice(idx, 1);
            saveJobs(jobs);

            return ok({ deleted: true, id, name });
        } catch (err) {
            logger.error('delete_automation error', { error: err.message });
            return fail(err.message);
        }
    },
});

export const automationTools = [createAutomationTool, listAutomationsTool, toggleAutomationTool, deleteAutomationTool];
