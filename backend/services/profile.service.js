import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROFILES_DIR = path.resolve(__dirname, '../../personality/output/profiles');
const CACHE_FILE = path.resolve(__dirname, '../../personality/output/scrape_cache.json');

const MAX_PROFILES_PER_CHANNEL = 10;

let _channelUserMap = null;
let _profileTextCache = new Map();

function buildChannelUserMap() {
    if (_channelUserMap) return _channelUserMap;

    _channelUserMap = new Map();

    if (!fs.existsSync(CACHE_FILE)) {
        console.warn('[ProfileService] scrape_cache.json not found, profiles disabled');
        return _channelUserMap;
    }

    const { users, messagesByUser } = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));

    const channelActivity = {};

    for (const [uid, msgs] of Object.entries(messagesByUser)) {
        const username = users[uid]?.username;
        if (!username) continue;

        for (const msg of msgs) {
            const chId = msg.channelId;
            if (!chId) continue;
            channelActivity[chId] ??= {};
            channelActivity[chId][username] = (channelActivity[chId][username] ?? 0) + 1;
        }
    }

    for (const [chId, userCounts] of Object.entries(channelActivity)) {
        const sorted = Object.entries(userCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([username, msgCount]) => ({ username, msgCount }));
        _channelUserMap.set(chId, sorted);
    }

    console.log(`[ProfileService] Loaded activity map for ${_channelUserMap.size} channels`);
    return _channelUserMap;
}

function readProfileText(username) {
    if (_profileTextCache.has(username)) return _profileTextCache.get(username);

    const txtPath = path.join(PROFILES_DIR, `${username}.txt`);
    if (!fs.existsSync(txtPath)) return null;

    const content = fs.readFileSync(txtPath, 'utf-8').trim();
    _profileTextCache.set(username, content);
    return content;
}

const ProfileService = {
    getPromptBlockForChannel(channelId) {
        const map = buildChannelUserMap();
        const users = map.get(channelId) ?? [];

        const selected = users.slice(0, MAX_PROFILES_PER_CHANNEL);

        if (!selected.length) return null;

        const blocks = [];
        for (const { username } of selected) {
            const txt = readProfileText(username);
            if (txt) blocks.push(txt);
        }

        if (!blocks.length) return null;

        return [
            '---',
            `## Personality Profiles — ${blocks.length} thành viên trong channel này`,
            '(Dùng thông tin này để điều chỉnh cách trả lời phù hợp với từng người)\n',
            blocks.join('\n\n---\n\n'),
            '---',
        ].join('\n');
    },

    invalidate() {
        _channelUserMap = null;
        _profileTextCache.clear();
        console.log('[ProfileService] Cache invalidated');
    },
};

export default ProfileService;
