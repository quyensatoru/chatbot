const EMOJI_RE =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]+/gu;
const QUESTION_RE = /\?/;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STOPWORDS = new Set([
    'và',
    'của',
    'là',
    'có',
    'không',
    'được',
    'cho',
    'với',
    'các',
    'một',
    'trong',
    'này',
    'đã',
    'từ',
    'bạn',
    'tôi',
    'thì',
    'mình',
    'nha',
    'nhé',
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'to',
    'of',
    'in',
    'it',
    'i',
    'you',
    'we',
    'he',
    'she',
    'they',
    'that',
    'this',
    'for',
    'on',
    'at',
    'by',
    'or',
    'and',
    'but',
    'not',
    'with',
    'my',
    'ok',
    'okay',
    'yes',
    'no',
    'hi',
    'hello',
    'ạ',
    'ơi',
    'thôi',
    'rồi',
    'vậy',
    'ừ',
    'oke',
    'ok',
    'lol',
]);

export function computeStats(messages) {
    if (!messages.length) return {};

    const texts = messages.map((m) => m.text);
    const lengths = texts.map((t) => t.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    // Emoji count
    const emojiCount = texts.reduce((acc, t) => acc + (t.match(EMOJI_RE) ?? []).length, 0);

    // Hour & day distribution
    const hourDist = {};
    const dayDist = {};
    for (const m of messages) {
        const d = new Date(m.ts);
        if (isNaN(d)) continue;
        const h = d.getUTCHours();
        const day = DAYS[d.getUTCDay()];
        hourDist[h] = (hourDist[h] ?? 0) + 1;
        dayDist[day] = (dayDist[day] ?? 0) + 1;
    }

    const mostActiveHour = topKey(hourDist);
    const mostActiveDay = topKey(dayDist);
    const activeTimeSlots = hoursToSlots(hourDist);

    // Channel distribution
    const chDist = {};
    for (const m of messages) chDist[m.channel] = (chDist[m.channel] ?? 0) + 1;
    const channelsActive = Object.entries(chDist)
        .sort((a, b) => b[1] - a[1])
        .map(([ch]) => ch);

    // Ratios
    const total = messages.length;
    const replyCount = messages.filter((m) => m.isReply).length;
    const fileCount = messages.filter((m) => m.hasFiles).length;
    const replyRatio = +((replyCount / total) * 100).toFixed(1);
    const fileRatio = +((fileCount / total) * 100).toFixed(1);

    // Top words
    const wordFreq = {};
    for (const text of texts) {
        const words = text.toLowerCase().match(/\b[a-zA-ZÀ-ỹ]{3,}\b/g) ?? [];
        for (const w of words) {
            if (!STOPWORDS.has(w)) wordFreq[w] = (wordFreq[w] ?? 0) + 1;
        }
    }
    const topWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([w]) => w);

    // Date range
    const sorted = [...messages].sort((a, b) => a.ts.localeCompare(b.ts));
    const dateRange = { from: sorted[0].ts, to: sorted.at(-1).ts };

    return {
        totalMessages: total,
        avgMessageLength: +avgLength.toFixed(1),
        emojiCount,
        replyRatio,
        fileRatio,
        mostActiveHour,
        mostActiveDay,
        activeTimeSlots,
        hourDistribution: hourDist,
        dayDistribution: dayDist,
        channelsActive,
        topChannels: channelsActive.slice(0, 5),
        topWords,
        dateRange,
    };
}

export function pickSampleMessages(messages, n = 100) {
    if (messages.length <= n) return messages;

    // Group by channel, spread evenly
    const byChannel = {};
    for (const m of messages) {
        (byChannel[m.channel] ??= []).push(m);
    }

    const perChannel = Math.max(1, Math.floor(n / Object.keys(byChannel).length));
    const selected = [];

    for (const msgs of Object.values(byChannel)) {
        const step = Math.max(1, Math.floor(msgs.length / perChannel));
        for (let i = 0; i < msgs.length && selected.length < n; i += step) {
            selected.push(msgs[i]);
        }
    }

    return selected.slice(0, n);
}

function topKey(dist) {
    let best = null,
        bestVal = -1;
    for (const [k, v] of Object.entries(dist)) {
        if (v > bestVal) {
            best = k;
            bestVal = v;
        }
    }
    return best != null ? (isNaN(best) ? best : Number(best)) : null;
}

function hoursToSlots(hourDist) {
    if (!Object.keys(hourDist).length) return [];
    const max = Math.max(...Object.values(hourDist));
    const threshold = max * 0.3;
    const active = Object.entries(hourDist)
        .filter(([, v]) => v >= threshold)
        .map(([h]) => Number(h))
        .sort((a, b) => a - b);

    if (!active.length) return [];

    const slots = [];
    let start = active[0],
        prev = active[0];
    for (let i = 1; i < active.length; i++) {
        if (active[i] - prev <= 2) {
            prev = active[i];
        } else {
            slots.push(`${String(start).padStart(2, '0')}:00-${String(prev + 1).padStart(2, '0')}:00`);
            start = active[i];
            prev = active[i];
        }
    }
    slots.push(`${String(start).padStart(2, '0')}:00-${String(prev + 1).padStart(2, '0')}:00`);
    return slots;
}
