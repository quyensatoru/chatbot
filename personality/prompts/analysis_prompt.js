export const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích tâm lý hành vi và giao tiếp trong môi trường làm việc.
Nhiệm vụ: Phân tích tính cách của một thành viên dựa trên lịch sử tin nhắn Mattermost của họ.
Kết quả sẽ được dùng để giúp một AI chatbot hiểu và tương tác hiệu quả hơn với người dùng đó.

Nguyên tắc:
- Dựa hoàn toàn vào bằng chứng từ tin nhắn, KHÔNG phán xét cá nhân
- Phân tích hành vi giao tiếp, KHÔNG đánh giá năng lực chuyên môn
- Trả về JSON hợp lệ, đúng schema được yêu cầu
- Tất cả score Big Five phải trong khoảng [0.0, 1.0]
- Viết persona_summary và interaction_guide bằng tiếng Việt, ngắn gọn, thực tế`;

export function buildAnalysisPrompt({ userInfo, stats, sampleText }) {
    return `Phân tích tính cách của user sau dựa trên ${stats.totalMessages} tin nhắn từ Mattermost.

## Thông tin user
- Username: ${userInfo.username}
- Display name: ${userInfo.displayName}
- Email: ${userInfo.email}
- Position: ${userInfo.position || 'N/A'}

## Thống kê hành vi
- Tổng tin nhắn: ${stats.totalMessages}
- Kênh hoạt động: ${stats.channelsActive.slice(0, 6).join(', ')}
- Thời gian hoạt động chính: ${stats.activeTimeSlots.join(', ') || 'N/A'}
- Ngày hoạt động nhiều nhất: ${stats.mostActiveDay ?? 'N/A'}
- Độ dài tin nhắn trung bình: ${stats.avgMessageLength} ký tự
- Tỉ lệ reply (trong thread): ${stats.replyRatio}%
- Tỉ lệ chia sẻ file: ${stats.fileRatio}%
- Số emoji sử dụng: ${stats.emojiCount}
- Từ/cụm từ hay dùng nhất: ${stats.topWords.slice(0, 15).join(', ')}

## Mẫu tin nhắn đại diện (tối đa 100 tin, đa dạng kênh và thời gian)
${sampleText}

## Yêu cầu đầu ra
Trả về JSON với đúng cấu trúc sau (KHÔNG thêm text ngoài JSON):

{
  "communication_style": {
    "tone": "<formal|casual|mixed>",
    "directness": "<direct|indirect|contextual>",
    "verbosity": "<concise|moderate|verbose>",
    "emoji_usage": "<none|low|medium|high>",
    "humor_level": "<none|low|medium|high>",
    "language_formality": <0.0-1.0>,
    "preferred_format": "<plain|structured|list-heavy|mixed>"
  },
  "work_behavior": {
    "collaboration_style": "<leader|supporter|independent|mixed>",
    "problem_solving": "<analytical|creative|pragmatic|mixed>",
    "response_pattern": "<proactive|reactive|mixed>",
    "active_time_slots": ["<HH:MM-HH:MM>"],
    "topics_of_interest": ["<topic>"],
    "expertise_signals": ["<skill/domain>"],
    "question_asking_frequency": "<low|medium|high>",
    "initiative_level": "<low|medium|high>"
  },
  "personality_traits": {
    "big_five": {
      "openness": <0.0-1.0>,
      "conscientiousness": <0.0-1.0>,
      "extraversion": <0.0-1.0>,
      "agreeableness": <0.0-1.0>,
      "neuroticism": <0.0-1.0>
    },
    "mbti_tendency": "<4-letter MBTI>",
    "mbti_confidence": "<low|medium|high>",
    "key_adjectives": ["<adj>"],
    "strengths": ["<strength>"],
    "potential_friction_points": ["<friction>"]
  },
  "llm_context": {
    "persona_summary": "<2-3 câu mô tả tổng quan, tiếng Việt>",
    "interaction_guide": "<1-2 câu hướng dẫn LLM cách giao tiếp, tiếng Việt>",
    "key_phrases": ["<cụm từ đặc trưng>"],
    "avoid_with_user": ["<điều nên tránh>"],
    "motivators": ["<điều quan trọng với user>"],
    "communication_tips": ["<tip cụ thể>"]
  }
}`;
}
