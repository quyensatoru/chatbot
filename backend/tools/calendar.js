import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import { config, logger, withRetry, ok, fail } from "../config/tool.config.js";

function getHeaders() {
    return {
        Authorization: `Bearer ${config.cal.apiKey}`,
        "Content-Type": "application/json",
    };
}

export const getEventTypesTool = new DynamicStructuredTool({
    name: "get_event_types",
    description:
        "Lấy danh sách các loại lịch hẹn (event types). Dùng khi cần chọn loại meeting phù hợp.",
    schema: z.object({}).strict(),
    func: async () => {
        logger.info("Tool: get_event_types");

        try {
            const res = await withRetry(() =>
                axios.get(`${config.cal.baseUrl}/event-types`, {
                    headers: {
                        ...getHeaders(),
                        "cal-api-version": "2024-06-14"
                    },
                })
            );

            const eventTypes = (res.data.data || []).map((e) => ({
                id: e.id,
                title: e.title,
                slug: e.slug,
                length: e.length,
                description: e.description || null,
            }));

            return ok(eventTypes);
        } catch (err) {
            console.log("error: ", err)
            logger.error("get_event_types error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const createEventTypeTool = new DynamicStructuredTool({
    name: "create_event_type",
    description:
        "Tạo loại lịch hẹn (event type template) — chỉ là mẫu cấu hình, KHÔNG đặt lịch hẹn cụ thể, KHÔNG nhận timestamp/ngày giờ. Dùng trước create_calendar_event khi chưa có loại phù hợp.",
    schema: z.object({
        lengthInMinutes: z.number().describe("Duration of the event in minutes (required)"),
        title: z.string().describe("Title of the event type (required)"),
        slug: z.string().describe("URL slug for the event type, e.g. 'intro-call' (required)"),
        description: z.string().optional().describe("Description shown to bookers"),
        lengthInMinutesOptions: z.array(z.number()).optional()
            .describe("Alternative lengths; must include lengthInMinutes"),
        locations: z.array(z.object({
            type: z.string(),
            integration: z.string().optional(),
        })).optional().describe("Supported integrations via API: cal-video, google-meet, office365-video, zoom"),
        disableGuests: z.boolean().optional(),
        slotInterval: z.number().optional(),
        minimumBookingNotice: z.number().optional().describe("Minutes before event a booking can be made"),
        beforeEventBuffer: z.number().optional(),
        afterEventBuffer: z.number().optional(),
        scheduleId: z.number().optional(),
        hidden: z.boolean().optional(),
        requiresBookerEmailVerification: z.boolean().optional(),
        successRedirectUrl: z.string().url().optional(),
        customName: z.string().optional(),
        hideOrganizerEmail: z.boolean().optional(),
    }).strict(),
    func: async (input) => {
        logger.info("Tool: create_event_type", input);
        const allowedKeys = [
            "lengthInMinutes",
            "title",
            "slug",
            "description",
            "lengthInMinutesOptions",
        ];

        try {
            const cleanInput = Object.fromEntries(
                Object.entries(input).filter(([k]) => allowedKeys.includes(k))
            );
            const res = await withRetry(() =>
                axios.post(
                    `${config.cal.baseUrl}/event-types`,
                    cleanInput,
                    {
                        headers: {
                            ...getHeaders(),
                            "cal-api-version": "2024-06-14"
                        },
                    }
                )
            );

            return ok({
                id: res.data.id,
                title: input.title,
                lengthInMinutes: input.lengthInMinutes,
                slug: res.data.slug,
            });
        } catch (err) {
            logger.error("create_event_type error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const getCalendarEventsTool = new DynamicStructuredTool({
    name: "get_calendar_events",
    description: "Lấy danh sách booking từ Cal.com",
    schema: z.object({
        timeMin: z.string().describe("Thời gian bắt đầu lọc booking (ISO 8601)"),
        timeMax: z.string().optional().describe("Thời gian kết thúc lọc (ISO 8601)"),
        maxResults: z.number().int().min(1).max(50).default(10).describe("Số booking tối đa trả về"),
    }).strict(),
    func: async ({ timeMin, timeMax, maxResults }) => {
        logger.info("Tool: get_calendar_events", { timeMin, timeMax });

        try {
            const res = await withRetry(() =>
                axios.get(`${config.cal.baseUrl}/bookings`, {
                    headers: getHeaders(),
                    params: {
                        startTime: timeMin,
                        endTime: timeMax,
                    },
                })
            );

            const events = (res.data.bookings || [])
                .slice(0, maxResults)
                .map((b) => ({
                    id: b.id,
                    title: b.title || b.metadata?.title,
                    start: b.startTime,
                    end: b.endTime,
                    attendees: [b.attendees?.[0]?.email],
                    location: b.location || null,
                    description: b.metadata?.description || null,
                }));

            return ok(events);
        } catch (err) {
            logger.error("get_calendar_events error", { error: err.message });
            return fail(err.message);
        }
    },
});

const AttendeeSchema = z.object({
    name: z.string().describe("Tên attendee"),
    timeZone: z.string().describe("Timezone, vd: America/New_York"),
    email: z.string().email().optional().describe("Email attendee"),
    phoneNumber: z.string().optional().describe("SĐT quốc tế, vd: +919876543210"),
    language: z.string().optional().default("en").describe("Ngôn ngữ: en, vi, it..."),
}).strict();

const CreateBookingSchema = z.object({
    // Required
    start: z
        .string()
        .describe("Thời gian bắt đầu ISO 8601 UTC, vd: 2026-04-20T09:00:00Z"),
    attendee: AttendeeSchema,

    // Event type (cần eventTypeId HOẶC eventTypeSlug + username/teamSlug)
    eventTypeId: z.number().int().optional().describe("ID event type"),
    eventTypeSlug: z.string().optional().describe("Slug event type"),
    username: z.string().optional().describe("Username chủ event type"),
    teamSlug: z.string().optional().describe("Team slug nếu thuộc team"),
    organizationSlug: z.string().optional().describe("Org slug (optional)"),

    // Optional
    guests: z.array(z.string().email()).optional().describe("Email khách mời"),
    location: z
        .record(z.any())
        .optional()
        .describe("Object location, vd: { type: 'integration', integration: 'office365-video' }"),
    bookingFieldsResponses: z
        .record(z.any())
        .optional()
        .describe("Giá trị cho custom booking fields"),
    metadata: z
        .record(z.string())
        .optional()
        .describe("Metadata tuỳ chỉnh (<=50 keys)"),
    lengthInMinutes: z
        .number()
        .int()
        .optional()
        .describe("Độ dài booking nếu event type có nhiều lựa chọn"),
    emailVerificationCode: z.string().optional(),
    routing: z
        .object({
            responseId: z.number().int(),
            teamMemberIds: z.array(z.number().int()).optional(),
            skipContactOwner: z.boolean().optional(),
            crmAppSlug: z.string().optional(),
            crmOwnerRecordType: z.string().optional(),
        })
        .optional(),
    allowConflicts: z.boolean().optional(),
    allowBookingOutOfBounds: z.boolean().optional(),
}).strict();


export const createCalendarEventTool = new DynamicStructuredTool({
    name: "create_calendar_event",
    description: `Tạo booking trên Cal.com, Nếu eventTypeId chưa có hãy gọi đến các tool như get_event_types, create_event_types để lấy
        Field Required: start, attendee.name, attendee.timeZone, và eventTypeId (hoặc eventTypeSlug + username/teamSlug)
    `,
    schema: CreateBookingSchema,
    func: async (input) => {
        logger.info("Tool: create_calendar_event", input);

        //remove file timestamp if exist
        const cleanInput = Object.fromEntries(
            Object.entries(input).filter(([k]) => k !== "timestamp")
        );

        try {
            const res = await withRetry(() =>
                axios.post(
                    `${config.cal.baseUrl}/bookings`,
                    cleanInput,
                    {
                        headers: {
                            ...getHeaders(),
                            "cal-api-version": "2026-02-25"
                        },
                    }
                )
            );

            return ok(res.data.data);
        } catch (err) {
            logger.error("create_calendar_event error", { error: err.response?.data?.error || err.message });
            return fail(err.message);
        }
    },
});

export const updateCalendarEventTool = new DynamicStructuredTool({
    name: "update_calendar_event",
    description: "Reschedule booking trên Cal.com",
    schema: z.object({
        eventId: z.string().describe("ID của booking cần reschedule"),
        startTime: z.string().optional().describe("Thời gian bắt đầu mới (ISO 8601)"),
        endTime: z.string().optional().describe("Thời gian kết thúc mới (ISO 8601)"),
    }).strict(),
    func: async ({ eventId, startTime, endTime }) => {
        logger.info("Tool: update_calendar_event", { eventId });

        try {
            await withRetry(() =>
                axios.post(
                    `${config.cal.baseUrl}/bookings/reschedule`,
                    {
                        bookingId: eventId,
                        start: startTime,
                        end: endTime,
                    },
                    { headers: getHeaders() }
                )
            );

            return ok({ id: eventId, updated: true });
        } catch (err) {
            logger.error("update_calendar_event error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const deleteCalendarEventTool = new DynamicStructuredTool({
    name: "delete_calendar_event",
    description: "Hủy booking trên Cal.com",
    schema: z.object({
        eventId: z.string().describe("ID của booking cần hủy"),
    }).strict(),
    func: async ({ eventId }) => {
        logger.info("Tool: delete_calendar_event", { eventId });

        try {
            await withRetry(() =>
                axios.post(
                    `${config.cal.baseUrl}/bookings/cancel`,
                    { bookingId: eventId },
                    { headers: getHeaders() }
                )
            );

            return ok({ deleted: true, eventId });
        } catch (err) {
            logger.error("delete_calendar_event error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const checkAvailabilityTool = new DynamicStructuredTool({
    name: "check_availability",
    description: "Kiểm tra slot trống từ Cal.com. Nếu eventTypeId chưa có hãy gọi đến các tool như get_event_types, create_event_types để lấy",
    schema: z.object({
        timeMin: z.string().describe("Thời gian bắt đầu kiểm tra (ISO 8601)"),
        timeMax: z.string().describe("Thời gian kết thúc kiểm tra (ISO 8601)"),
        eventTypeId: z.string().describe("ID của event type cần kiểm tra slot"),
    }).strict(),
    func: async ({ timeMin, timeMax, eventTypeId }) => {
        logger.info("Tool: check_availability", { timeMin, timeMax, eventTypeId });

        try {
            const res = await withRetry(() =>
                axios.get(`${config.cal.baseUrl}/slots`, {
                    headers: getHeaders(),
                    params: {
                        eventTypeId,
                        startTime: timeMin,
                        endTime: timeMax,
                    },
                })
            );

            return ok({
                slots: res.data.slots || [],
                isAvailable: (res.data.slots || []).length > 0,
            });
        } catch (err) {
            logger.error("check_availability error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const calendarTools = [
    getCalendarEventsTool,
    createCalendarEventTool,
    updateCalendarEventTool,
    deleteCalendarEventTool,
    checkAvailabilityTool,
    getEventTypesTool,
    createEventTypeTool
];