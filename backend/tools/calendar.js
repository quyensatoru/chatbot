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
    schema: z.object({}),
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

            const eventTypes = (res.data.event_types || []).map((e) => ({
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
        "Tạo loại lịch hẹn mới (event type). Dùng khi chưa có loại phù hợp.",
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
        })).optional().describe("Defaults to cal-video. Supported integrations via API: cal-video, google-meet, office365-video, zoom"),
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
    }),
    func: async (input) => {
        logger.info("Tool: create_event_type", input);

        try {
            const res = await withRetry(() =>
                axios.post(
                    `${config.cal.baseUrl}/event-types`,
                    input,
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
                title,
                length,
                slug: res.data.slug,
                status: "created",
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
        timeMin: z.string(),
        timeMax: z.string().optional(),
        maxResults: z.number().int().min(1).max(50).default(10),
    }),
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

export const createCalendarEventTool = new DynamicStructuredTool({
    name: "create_calendar_event",
    description: "Tạo booking trên Cal.com, Nếu eventTypeId chưa có hãy gọi đến các tool như get_event_types, create_event_types để lấy",
    schema: z.object({
        title: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        attendees: z.array(z.string().email()).optional(),
        eventTypeId: z.string()
    }),
    func: async ({ title, startTime, endTime, description, location, attendees, eventTypeId }) => {
        logger.info("Tool: create_calendar_event", { title, eventTypeId });

        try {
            const res = await withRetry(() =>
                axios.post(
                    `${config.cal.baseUrl}/bookings`,
                    {
                        eventTypeId,
                        start: startTime,
                        end: endTime,
                        responses: {
                            name: "AI User",
                            email: attendees?.[0] || "no-reply@example.com",
                        },
                        metadata: {
                            title,
                            description,
                            location,
                        },
                    },
                    { headers: getHeaders() }
                )
            );

            return ok({
                id: res.data.id,
                title,
                startTime,
                endTime,
                status: "created",
            });
        } catch (err) {
            logger.error("create_calendar_event error", { error: err.message });
            return fail(err.message);
        }
    },
});

export const updateCalendarEventTool = new DynamicStructuredTool({
    name: "update_calendar_event",
    description: "Reschedule booking trên Cal.com",
    schema: z.object({
        eventId: z.string(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
    }),
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
        eventId: z.string(),
    }),
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
        timeMin: z.string(),
        timeMax: z.string(),
        eventTypeId: z.string(),
    }),
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