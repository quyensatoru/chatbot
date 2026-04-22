import axios from "axios";
import { MATTERMOST_URL, MATTERMOST_COOKIE, MATTERMOST_CHANNELS, MAX_PAGES_PER_CHANNEL } from "../config.js";

export class MattermostScraper {
    constructor() {
        this.baseUrl = MATTERMOST_URL.replace(/\/$/, "");
        this.headers = {
            "accept": "*/*",
            "accept-language": "en",
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Linux\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-csrf-token": "ykbfj8rbyf8gfb66gr1fzjwrqa",
            "x-requested-with": "XMLHttpRequest",
            "cookie": "_gcl_au=1.1.809233954.1775447692; _ga_5YR0QNC2T7=GS2.1.s1775447692$o1$g1$t1775447692$j60$l0$h153941606; _ga_XCR0DPEDBM=GS2.1.s1775447692$o1$g0$t1775447692$j60$l0$h0; _hjSessionUser_2561851=eyJpZCI6Ijg0NGI2YTBhLThkZDYtNTI0YS1iNzFhLTk5YTNhM2M0MzRiMiIsImNyZWF0ZWQiOjE3NzU0NDc2OTIxMTUsImV4aXN0aW5nIjp0cnVlfQ==; _ga=GA1.2.483402437.1775447692; _fbp=fb.1.1775447692184.666467546267825928; _clck=14rd8bw%5E2%5Eg4z%5E0%5E2287; MMAUTHTOKEN=wi5ukcuqrffyu8fr5buxdfxe8o; MMUSERID=zdzxf356pib8ik846z9qnfzjfr; MMCSRF=ykbfj8rbyf8gfb66gr1fzjwrqa; _dd_s=logs=1&id=f82008dc-0a4d-4888-8b75-2fb12b84d47d&created=1776845099095&expire=1776846010807"
        };
        this._userCache = new Map();
        this._channelCache = new Map();
    }

    async _get(path, params = {}) {
        const resp = await axios.get(`${this.baseUrl}${path}`, {
            headers: this.headers,
            params,
        });
        return resp.data;
    }

    async getUser(userId) {
        if (this._userCache.has(userId)) return this._userCache.get(userId);
        try {
            const data = await this._get(`/users/${userId}`);
            this._userCache.set(userId, data);
            return data;
        } catch {
            const fallback = { id: userId, username: userId, first_name: "", last_name: "", email: "" };
            this._userCache.set(userId, fallback);
            return fallback;
        }
    }

    async getChannelInfo(channelId) {
        if (this._channelCache.has(channelId)) return this._channelCache.get(channelId);
        try {
            const data = await this._get(`/channels/${channelId}`);
            this._channelCache.set(channelId, data);
            return data;
        } catch {
            const fallback = { id: channelId, name: channelId, display_name: channelId };
            this._channelCache.set(channelId, fallback);
            return fallback;
        }
    }

    async fetchChannelPosts(channelId) {
        const allPosts = [];
        let page = 0;
        const perPage = 100;

        process.stdout.write(`  Fetching channel ${channelId}...`);

        while (page < MAX_PAGES_PER_CHANNEL) {
            try {
                const data = await this._get(`/channels/${channelId}/posts`, { page, per_page: perPage });
                const order = data.order ?? [];
                const posts = data.posts ?? {};

                if (!order.length) break;

                for (const postId of order) {
                    const post = posts[postId];
                    if (!post) continue;
                    // Skip system messages and empty messages
                    if (post.type !== "" || !post.message?.trim()) continue;
                    allPosts.push(post);
                }

                page++;
                await sleep(200);
            } catch (err) {
                process.stdout.write(`\n  Error on page ${page}: ${err.message}\n`);
                break;
            }
        }

        process.stdout.write(` ${allPosts.length} messages\n`);
        return allPosts;
    }

    async scrapeAll() {
        const channels = MATTERMOST_CHANNELS;
        const messagesByUser = new Map();
        const channelNames = {};

        // Fetch channel display names
        for (const chId of channels) {
            const info = await this.getChannelInfo(chId).catch(() => ({ display_name: chId }));
            channelNames[chId] = info.display_name ?? chId;
        }

        // Fetch posts per channel
        for (const chId of channels) {
            const posts = await this.fetchChannelPosts(chId);
            const chName = channelNames[chId];

            for (const post of posts) {
                const userId = post.user_id;
                if (!userId) continue;

                const tsMs = post.create_at ?? 0;
                const ts = new Date(tsMs).toISOString();

                if (!messagesByUser.has(userId)) messagesByUser.set(userId, []);
                messagesByUser.get(userId).push({
                    text: post.message.trim(),
                    ts,
                    channel: chName,
                    channelId: chId,
                    hasFiles: Boolean(post.file_ids?.length),
                    hasReactions: Boolean(post.metadata?.reactions?.length),
                    isReply: Boolean(post.root_id),
                });
            }
        }

        // Resolve user profiles
        const userIds = [...messagesByUser.keys()];
        console.log(`\nResolving ${userIds.length} users...`);
        const users = {};

        for (const uid of userIds) {
            const u = await this.getUser(uid);
            const display = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || uid;
            users[uid] = {
                id: uid,
                username: u.username ?? uid,
                displayName: display,
                email: u.email ?? "",
                nickname: u.nickname ?? "",
                position: u.position ?? "",
            };
        }

        return {
            users,
            messagesByUser: Object.fromEntries(messagesByUser),
            channelNames,
        };
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
