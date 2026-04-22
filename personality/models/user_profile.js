import { z } from "zod";

export const DataSummarySchema = z.object({
    totalMessages: z.number(),
    channelsActive: z.array(z.string()),
    dateRange: z.object({ from: z.string(), to: z.string() }),
    avgMessageLength: z.number(),
    mostActiveHour: z.number().nullable(),
    mostActiveDay: z.string().nullable(),
    replyRatio: z.number(),
    fileShareRatio: z.number(),
    emojiCount: z.number(),
    topChannels: z.array(z.string()),
});

export const CommunicationStyleSchema = z.object({
    tone: z.enum(["formal", "casual", "mixed"]),
    directness: z.enum(["direct", "indirect", "contextual"]),
    verbosity: z.enum(["concise", "moderate", "verbose"]),
    emojiUsage: z.enum(["none", "low", "medium", "high"]),
    humorLevel: z.enum(["none", "low", "medium", "high"]),
    languageFormality: z.number().min(0).max(1),
    preferredFormat: z.enum(["plain", "structured", "list-heavy", "mixed"]),
});

export const WorkBehaviorSchema = z.object({
    collaborationStyle: z.enum(["leader", "supporter", "independent", "mixed"]),
    problemSolving: z.enum(["analytical", "creative", "pragmatic", "mixed"]),
    responsePattern: z.enum(["proactive", "reactive", "mixed"]),
    activeTimeSlots: z.array(z.string()),
    topicsOfInterest: z.array(z.string()),
    expertiseSignals: z.array(z.string()),
    questionAskingFrequency: z.enum(["low", "medium", "high"]),
    initiativeLevel: z.enum(["low", "medium", "high"]),
});

export const BigFiveSchema = z.object({
    openness: z.number().min(0).max(1),
    conscientiousness: z.number().min(0).max(1),
    extraversion: z.number().min(0).max(1),
    agreeableness: z.number().min(0).max(1),
    neuroticism: z.number().min(0).max(1),
});

export const PersonalityTraitsSchema = z.object({
    bigFive: BigFiveSchema,
    mbtiTendency: z.string(),
    mbtiConfidence: z.enum(["low", "medium", "high"]),
    keyAdjectives: z.array(z.string()),
    strengths: z.array(z.string()),
    potentialFrictionPoints: z.array(z.string()),
});

export const LLMContextSchema = z.object({
    personaSummary: z.string(),      // 2-3 câu mô tả tổng quan
    interactionGuide: z.string(),    // hướng dẫn LLM cách tương tác
    keyPhrases: z.array(z.string()), // cụm từ đặc trưng
    avoidWithUser: z.array(z.string()),
    motivators: z.array(z.string()),
    communicationTips: z.array(z.string()),
});

export const PersonalitySchema = z.object({
    communicationStyle: CommunicationStyleSchema,
    workBehavior: WorkBehaviorSchema,
    personalityTraits: PersonalityTraitsSchema,
});

export const UserProfileSchema = z.object({
    schemaVersion: z.string().default("1.0"),
    userId: z.string(),
    username: z.string(),
    displayName: z.string(),
    email: z.string(),
    position: z.string().default(""),
    analyzedAt: z.string(),
    dataSummary: DataSummarySchema,
    personality: PersonalitySchema,
    llmContext: LLMContextSchema,
    rawStats: z.record(z.unknown()).default({}),
});

// ── Builder ────────────────────────────────────────────────────────────────

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number(v) || 0.5));
const pick = (obj, key, fallback) => obj?.[key] ?? fallback;

export function buildProfile(userInfo, stats, llm) {
    const cs = llm.communication_style ?? {};
    const wb = llm.work_behavior ?? {};
    const pt = llm.personality_traits ?? {};
    const bf = pt.big_five ?? {};
    const lc = llm.llm_context ?? {};

    const raw = {
        userId: userInfo.id,
        username: userInfo.username,
        displayName: userInfo.displayName,
        email: userInfo.email ?? "",
        position: userInfo.position ?? "",
        analyzedAt: new Date().toISOString(),
        dataSummary: {
            totalMessages: stats.totalMessages,
            channelsActive: stats.channelsActive,
            dateRange: stats.dateRange,
            avgMessageLength: stats.avgMessageLength,
            mostActiveHour: stats.mostActiveHour ?? null,
            mostActiveDay: stats.mostActiveDay ?? null,
            replyRatio: stats.replyRatio,
            fileShareRatio: stats.fileRatio,
            emojiCount: stats.emojiCount,
            topChannels: stats.topChannels,
        },
        personality: {
            communicationStyle: {
                tone: pick(cs, "tone", "mixed"),
                directness: pick(cs, "directness", "contextual"),
                verbosity: pick(cs, "verbosity", "moderate"),
                emojiUsage: pick(cs, "emoji_usage", "low"),
                humorLevel: pick(cs, "humor_level", "low"),
                languageFormality: clamp(pick(cs, "language_formality", 0.5)),
                preferredFormat: pick(cs, "preferred_format", "plain"),
            },
            workBehavior: {
                collaborationStyle: pick(wb, "collaboration_style", "mixed"),
                problemSolving: pick(wb, "problem_solving", "pragmatic"),
                responsePattern: pick(wb, "response_pattern", "mixed"),
                activeTimeSlots: pick(wb, "active_time_slots", stats.activeTimeSlots ?? []),
                topicsOfInterest: pick(wb, "topics_of_interest", []),
                expertiseSignals: pick(wb, "expertise_signals", []),
                questionAskingFrequency: pick(wb, "question_asking_frequency", "medium"),
                initiativeLevel: pick(wb, "initiative_level", "medium"),
            },
            personalityTraits: {
                bigFive: {
                    openness: clamp(pick(bf, "openness", 0.5)),
                    conscientiousness: clamp(pick(bf, "conscientiousness", 0.5)),
                    extraversion: clamp(pick(bf, "extraversion", 0.5)),
                    agreeableness: clamp(pick(bf, "agreeableness", 0.5)),
                    neuroticism: clamp(pick(bf, "neuroticism", 0.5)),
                },
                mbtiTendency: pick(pt, "mbti_tendency", "XXXX"),
                mbtiConfidence: pick(pt, "mbti_confidence", "low"),
                keyAdjectives: pick(pt, "key_adjectives", []),
                strengths: pick(pt, "strengths", []),
                potentialFrictionPoints: pick(pt, "potential_friction_points", []),
            },
        },
        llmContext: {
            personaSummary: pick(lc, "persona_summary", ""),
            interactionGuide: pick(lc, "interaction_guide", ""),
            keyPhrases: pick(lc, "key_phrases", []),
            avoidWithUser: pick(lc, "avoid_with_user", []),
            motivators: pick(lc, "motivators", []),
            communicationTips: pick(lc, "communication_tips", []),
        },
        rawStats: stats,
    };

    return UserProfileSchema.parse(raw);
}

// ── LLM-ready text block ───────────────────────────────────────────────────

export function toPromptBlock(profile) {
    const { personality: p, llmContext: c, dataSummary: d } = profile;
    const cs = p.communicationStyle;
    const wb = p.workBehavior;
    const t = p.personalityTraits;
    const b = t.bigFive;

    // ── Tín hiệu tone/humor đưa lên đầu để bot đọc nhanh ──────────────────
    const toneSignal = _toneSignal(cs.tone, cs.humorLevel, cs.languageFormality);

    return [
        `### @${profile.username} — ${profile.displayName}${profile.position ? ` (${profile.position})` : ""}`,

        // [1] Tín hiệu giao tiếp — BOT ĐỌC TRƯỚC TIÊN
        `**[Tone signal]** ${toneSignal}`,
        `**[Humor level]** ${cs.humorLevel} | **[Directness]** ${cs.directness} | **[Verbosity]** ${cs.verbosity}`,
        `**[Emoji usage]** ${cs.emojiUsage} | **[Formality]** ${cs.languageFormality.toFixed(1)}/1.0`,
        c.keyPhrases.length
            ? `**[Phrases họ hay dùng]** "${c.keyPhrases.slice(0, 5).join('", "')}"` : null,

        // [2] Hướng dẫn tương tác
        "",
        `**Cách tương tác:** ${c.interactionGuide}`,
        `**Tránh:** ${c.avoidWithUser.join(", ")}`,
        `**Động lực:** ${c.motivators.join(", ")}`,

        // [3] Persona tóm tắt
        "",
        `**Persona:** ${c.personaSummary}`,

        // [4] Traits bổ sung (ít critical hơn, đặt cuối)
        "",
        `**Traits:** ${t.keyAdjectives.join(", ")} | MBTI: ${t.mbtiTendency}`,
        `**Big Five:** O=${b.openness.toFixed(1)} C=${b.conscientiousness.toFixed(1)} E=${b.extraversion.toFixed(1)} A=${b.agreeableness.toFixed(1)} N=${b.neuroticism.toFixed(1)}`,
        wb.expertiseSignals.length
            ? `**Expertise:** ${wb.expertiseSignals.slice(0, 5).join(", ")}` : null,
        wb.topicsOfInterest.length
            ? `**Topics:** ${wb.topicsOfInterest.slice(0, 5).join(", ")}` : null,
    ].filter(l => l != null).join("\n");
}

/**
 * Render một câu hướng dẫn nhanh về tông giọng để bot áp dụng ngay.
 */
function _toneSignal(tone, humor, formality) {
    if (humor === "high" && tone === "casual") {
        return "Vui vẻ, hay đùa — được phép hài hước, bắt nhịp meme/slang của họ.";
    }
    if (humor === "medium" && tone !== "formal") {
        return "Thân thiện, thi thoảng hài hước nhẹ — không quá khô nhưng cũng không phải stand-up comedy.";
    }
    if (tone === "formal" || formality >= 0.7) {
        return "Formal, ưa chính xác — trả lời có cấu trúc, hạn chế emoji và humor.";
    }
    if (tone === "casual" && humor === "low") {
        return "Casual, nhẹ nhàng — ngắn gọn, không cần format báo cáo, tránh khô cứng.";
    }
    return "Mixed — theo dõi tín hiệu từng message để điều chỉnh.";
}
