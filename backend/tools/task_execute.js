import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Client } from "@notionhq/client";
import { config, logger, withRetry, ok, fail } from "../config/tool.config.js";

function getNotion() {
    return new Client({ auth: config.notion.apiKey });
}

const PrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
const StatusSchema = z.enum(["todo", "in_progress", "done", "cancelled"]);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseTask(page) {
    const props = page.properties;
    return {
        id: page.id,
        title: props.Name?.title?.[0]?.plain_text || "",
        status: props.Status?.select?.name || "todo",
        priority: props.Priority?.select?.name || "medium",
        dueDate: props.DueDate?.date?.start || null,
        tags: props.Tags?.multi_select?.map((t) => t.name) || [],
        notes: props.Notes?.rich_text?.[0]?.plain_text || "",
        createdAt: page.created_time,
        updatedAt: page.last_edited_time,
        url: page.url,
    };
}

function parseNote(page) {
    const props = page.properties;
    return {
        id: page.id,
        title: props.Title?.title?.[0]?.plain_text || "",
        content: props.Content?.rich_text?.[0]?.plain_text || "",
        tags: props.Tags?.multi_select?.map((t) => t.name) || [],
        createdAt: page.created_time,
        url: page.url,
    };
}

// ─── Task Tools ───────────────────────────────────────────────────────────────

export const createTaskTool = new DynamicStructuredTool({
    name: "create_task",
    description:
        "Tạo task/công việc mới trong Notion. Dùng khi người dùng muốn ghi lại việc cần làm, đặt deadline.",
    schema: z.object({
        title: z.string().describe("Tên công việc"),
        status: StatusSchema.default("todo").describe("Trạng thái công việc"),
        priority: PrioritySchema.default("medium").describe("Độ ưu tiên"),
        dueDate: z.string().optional().describe("Hạn chót (ISO 8601 date, ví dụ: 2024-12-31)"),
        tags: z.array(z.string()).optional().describe("Danh sách tags"),
        notes: z.string().optional().describe("Ghi chú thêm"),
    }).strict(),
    func: async ({ title, status, priority, dueDate, tags, notes }) => {
        logger.info("Tool: create_task", { title });
        try {
            const notion = getNotion();
            const res = await withRetry(() =>
                notion.pages.create({
                    parent: { database_id: config.notion.tasksDatabaseId },
                    properties: {
                        Name: { title: [{ text: { content: title } }] },
                        Status: { select: { name: status } },
                        Priority: { select: { name: priority } },
                        ...(dueDate && { DueDate: { date: { start: dueDate } } }),
                        ...(tags?.length && {
                            Tags: { multi_select: tags.map((t) => ({ name: t })) },
                        }),
                        ...(notes && {
                            Notes: { rich_text: [{ text: { content: notes } }] },
                        }),
                    },
                })
            );
            return ok(parseTask(res));
        } catch (err) {
            logger.error("create_task error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const listTasksTool = new DynamicStructuredTool({
    name: "list_tasks",
    description:
        "Liệt kê danh sách công việc từ Notion. Có thể lọc theo trạng thái, độ ưu tiên, hoặc tag.",
    schema: z.object({
        status: StatusSchema.optional().describe("Lọc theo trạng thái"),
        priority: PrioritySchema.optional().describe("Lọc theo độ ưu tiên"),
        tag: z.string().optional().describe("Lọc theo tag"),
        maxResults: z.number().int().min(1).max(50).default(10),
    }).strict(),
    func: async ({ status, priority, tag, maxResults }) => {
        logger.info("Tool: list_tasks", { status, priority });
        try {
            const notion = getNotion();
            const filters = [];

            if (status) {
                filters.push({ property: "Status", select: { equals: status } });
            }
            if (priority) {
                filters.push({ property: "Priority", select: { equals: priority } });
            }
            if (tag) {
                filters.push({ property: "Tags", multi_select: { contains: tag } });
            }

            const filter =
                filters.length === 1
                    ? filters[0]
                    : filters.length > 1
                        ? { and: filters }
                        : undefined;

            const res = await withRetry(() =>
                notion.databases.query({
                    database_id: config.notion.tasksDatabaseId,
                    filter,
                    page_size: maxResults,
                    sorts: [{ property: "DueDate", direction: "ascending" }],
                })
            );

            return ok(res.results.map(parseTask));
        } catch (err) {
            logger.error("list_tasks error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const updateTaskTool = new DynamicStructuredTool({
    name: "update_task",
    description: "Cập nhật trạng thái hoặc thông tin của một task trong Notion.",
    schema: z.object({
        taskId: z.string().describe("ID của task cần cập nhật"),
        title: z.string().optional().describe("Tiêu đề mới"),
        status: StatusSchema.optional().describe("Trạng thái mới"),
        priority: PrioritySchema.optional().describe("Độ ưu tiên mới"),
        dueDate: z.string().optional().describe("Deadline mới (ISO 8601)"),
        notes: z.string().optional().describe("Ghi chú mới"),
    }).strict(),
    func: async ({ taskId, title, status, priority, dueDate, notes }) => {
        logger.info("Tool: update_task", { taskId });
        try {
            const notion = getNotion();
            const updates = {};

            if (title) updates.Name = { title: [{ text: { content: title } }] };
            if (status) updates.Status = { select: { name: status } };
            if (priority) updates.Priority = { select: { name: priority } };
            if (dueDate) updates.DueDate = { date: { start: dueDate } };
            if (notes) updates.Notes = { rich_text: [{ text: { content: notes } }] };

            const res = await withRetry(() =>
                notion.pages.update({ page_id: taskId, properties: updates })
            );
            return ok(parseTask(res));
        } catch (err) {
            logger.error("update_task error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const deleteTaskTool = new DynamicStructuredTool({
    name: "delete_task",
    description: "Xóa (archive) một task trong Notion.",
    schema: z.object({
        taskId: z.string().describe("ID của task cần xóa"),
    }).strict(),
    func: async ({ taskId }) => {
        logger.info("Tool: delete_task", { taskId });
        try {
            const notion = getNotion();
            await withRetry(() =>
                notion.pages.update({ page_id: taskId, archived: true })
            );
            return ok({ deleted: true, taskId });
        } catch (err) {
            logger.error("delete_task error", { error: err.message });
            return fail(err.message);
        }
    },
});

// ─── Note Tools ───────────────────────────────────────────────────────────────

export const createNoteTool = new DynamicStructuredTool({
    name: "create_note",
    description: "Tạo ghi chú mới trong Notion. Dùng khi người dùng muốn lưu thông tin, ý tưởng.",
    schema: z.object({
        title: z.string().describe("Tiêu đề ghi chú"),
        content: z.string().describe("Nội dung ghi chú"),
        tags: z.array(z.string()).optional().describe("Tags phân loại"),
    }).strict(),
    func: async ({ title, content, tags }) => {
        logger.info("Tool: create_note", { title });
        try {
            const notion = getNotion();
            const res = await withRetry(() =>
                notion.pages.create({
                    parent: { database_id: config.notion.notesDatabaseId },
                    properties: {
                        Title: { title: [{ text: { content: title } }] },
                        Content: { rich_text: [{ text: { content: content } }] },
                        ...(tags?.length && {
                            Tags: { multi_select: tags.map((t) => ({ name: t })) },
                        }),
                    },
                })
            );
            return ok(parseNote(res));
        } catch (err) {
            logger.error("create_note error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const searchNotesTool = new DynamicStructuredTool({
    name: "search_notes",
    description: "Tìm kiếm ghi chú trong Notion theo từ khóa hoặc tag.",
    schema: z.object({
        keyword: z.string().describe("Từ khóa tìm kiếm trong tiêu đề hoặc nội dung"),
        tag: z.string().optional().describe("Lọc theo tag"),
        maxResults: z.number().int().default(5),
    }).strict(),
    func: async ({ keyword, tag, maxResults }) => {
        logger.info("Tool: search_notes", { keyword });
        try {
            const notion = getNotion();
            const filters = [
                {
                    or: [
                        { property: "Title", rich_text: { contains: keyword } },
                        { property: "Content", rich_text: { contains: keyword } },
                    ],
                },
            ];

            if (tag) {
                filters.push({ property: "Tags", multi_select: { contains: tag } });
            }

            const res = await withRetry(() =>
                notion.databases.query({
                    database_id: config.notion.notesDatabaseId,
                    filter: filters.length > 1 ? { and: filters } : filters[0],
                    page_size: maxResults,
                })
            );

            return ok(res.results.map(parseNote));
        } catch (err) {
            logger.error("search_notes error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const taskTools = [
    createTaskTool,
    listTasksTool,
    updateTaskTool,
    deleteTaskTool,
    createNoteTool,
    searchNotesTool,
];