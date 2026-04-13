import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import routers from './routers/index.js';
import errorMiddleware from './middleware/error.middleware.js';
import connectToMongoDB from './config/mongo.config.js';
import initBotMattermost from './config/mattermost.js';
config();

await connectToMongoDB();
await initBotMattermost();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(errorMiddleware);
app.use("/api/", routers);

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
});