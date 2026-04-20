
import "dotenv/config";
import winston from "winston";
import path from "path";

export const config = {
    llm: {
        provider: process.env.LLM_PROVIDER || "anthropic",
        openaiApiKey: process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        model: {
            openai: "gpt-4o",
            anthropic: "claude-opus-4-5",
        },
        temperature: 0,
        maxTokens: 1024,
    },
    cal: {
        apiKey: process.env.CAL_API,
        baseUrl: "https://api.cal.com/v2",
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    },
    notion: {
        apiKey: process.env.NOTION_API_KEY,
        tasksDatabaseId: process.env.NOTION_TASKS_DATABASE_ID,
        notesDatabaseId: process.env.NOTION_NOTES_DATABASE_ID,
    },
    mattermost: {
        botUrl: process.env.MATTERMOST_BOT_URL || "https://mattermost-bot.bsscommerce.com/send",
        channelId: process.env.MATTERMOST_CHANNEL_ID,
    },
    maps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
    exchangeRate: {
        apiKey: process.env.EXCHANGE_RATE_API_KEY,
    },
    email: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
        smtpPort: parseInt(process.env.SMTP_PORT || "587"),
        smtpSecure: process.env.SMTP_SECURE === "true",
        imapHost: process.env.IMAP_HOST || "imap.gmail.com",
        imapPort: parseInt(process.env.IMAP_PORT || "993"),
        draftsFolder: process.env.EMAIL_DRAFTS_FOLDER || "Drafts",
    },
    file: {
        baseDir: process.env.FILE_BASE_DIR || "./workspace",
    },
    defaults: {
        timezone: process.env.DEFAULT_TIMEZONE || "Asia/Ho_Chi_Minh",
        language: process.env.DEFAULT_LANGUAGE || "vi",
        toolTimeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
    },
};


export const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
            return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaStr}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        }),
        new winston.transports.File({
            filename: path.join("logs", `agent-${new Date().toISOString().split("T")[0]}.log`),
        }),
    ],
});

export async function withRetry(fn, attempts = config.defaults.retryAttempts, delay = config.defaults.retryDelay) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === attempts - 1) throw err;
            logger.warn(`Retry ${i + 1}/${attempts} after error: ${err.response?.data?.error?.message || err.message}`);
            await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
        }
    }
}

export const ok = (data) => JSON.stringify({ success: true, data });
export const fail = (message) => JSON.stringify({ success: false, error: message });