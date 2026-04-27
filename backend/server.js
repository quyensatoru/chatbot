import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import routers from './routers/index.js';
import errorMiddleware from './middleware/error.middleware.js';
import connectToMongoDB from './config/mongo.config.js';
import initBotMattermost from './config/mattermost.js';
import AgentService from './services/agent.service.js';
import { initAutomations } from './tools/automation.js';
import { initScheduledMessages } from './tools/message_chat.js';
import createDiscordBot from './config/discord.config.js';
config();

await connectToMongoDB();
await initBotMattermost();
await createDiscordBot()

// Recover persistent scheduled messages and start saved automation jobs
initScheduledMessages();
initAutomations((messages) => AgentService.chat(messages));

const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(errorMiddleware);
app.use('/api/', routers);

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
});
