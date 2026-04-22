import "dotenv/config";

export const MATTERMOST_URL = process.env.MATTERMOST_URL ?? "https://chat.bsscommerce.com/api/v4";
export const MATTERMOST_COOKIE = process.env.MATTERMOST_COOKIE ?? "";
export const MATTERMOST_CHANNELS = (process.env.MATTERMOST_CHANNELS ?? "").split(",").map(s => s.trim()).filter(Boolean);

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export const OUTPUT_DIR = process.env.OUTPUT_DIR ?? "./output/profiles";
export const MAX_PAGES_PER_CHANNEL = parseInt(process.env.MAX_PAGES_PER_CHANNEL ?? "50");
export const MIN_MESSAGES_THRESHOLD = parseInt(process.env.MIN_MESSAGES_THRESHOLD ?? "10");
