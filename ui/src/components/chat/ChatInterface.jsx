import { useState, useEffect, useRef, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import { chatAPI } from '../../services/api';

const SendIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const SUGGESTIONS = [
    'Tóm tắt tài liệu này',
    'Các điểm chính là gì?',
    'Giải thích khái niệm quan trọng nhất',
    'Liệt kê các bước thực hiện',
];

export default function ChatInterface({ docCount }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [lastQuery, setLastQuery] = useState(null);
    const endRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const autoGrow = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    const sendMessage = useCallback(async (text) => {
        if (!text?.trim() || isLoading) return;
        setLastQuery(text.trim());

        setMessages((prev) => [
            ...prev.filter((m) => !m.loading),
            { type: 'user', content: text.trim(), timestamp: new Date() },
            { type: 'assistant', content: '', timestamp: new Date(), loading: true },
        ]);
        setIsLoading(true);

        try {
            const res = await chatAPI.send(text.trim(), conversationId);
            if (res.success) {
                if (!conversationId) setConversationId(res.data?.response?.conversationId);
                setMessages((prev) => [
                    ...prev.slice(0, -1),
                    { type: 'assistant', content: res.data.response, timestamp: new Date() },
                ]);
            } else {
                setMessages((prev) => [
                    ...prev.slice(0, -1),
                    {
                        type: 'assistant',
                        content: res.error || 'Failed to get response',
                        isError: true,
                        timestamp: new Date(),
                    },
                ]);
            }
        } catch (err) {
            const isNetwork = err.message?.toLowerCase().includes('network') || err.code === 'ERR_NETWORK';
            setMessages((prev) => [
                ...prev.slice(0, -1),
                {
                    type: 'assistant',
                    content: isNetwork
                        ? 'Cannot reach the backend server. Make sure it is running on port 3000.'
                        : err.message || 'Something went wrong',
                    isError: true,
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [conversationId, isLoading]);

    const handleSend = () => {
        const text = input.trim();
        if (!text) return;
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        sendMessage(text);
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleRetry = () => {
        if (!lastQuery) return;
        setMessages((prev) => prev.slice(0, -1));
        sendMessage(lastQuery);
    };

    const handleClear = async () => {
        if (conversationId) await chatAPI.clearHistory(conversationId);
        setMessages([]);
        setConversationId(null);
        setLastQuery(null);
    };

    const hasError = messages.length > 0 && messages[messages.length - 1]?.isError;

    return (
        <div className="chat-view">
            <div className="chat-main">
                {/* Header */}
                <div className="chat-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: 'var(--accent-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 18,
                            }}
                        >
                            🤖
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>AI Assistant</div>
                            <div style={{ fontSize: 11.5, color: docCount > 0 ? 'var(--success)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {docCount > 0
                                    ? <><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} /> {docCount} doc{docCount !== 1 ? 's' : ''} loaded</>
                                    : 'No documents loaded'}
                            </div>
                        </div>
                    </div>
                    {messages.length > 0 && (
                        <button
                            className="btn btn-ghost"
                            onClick={handleClear}
                            style={{ fontSize: 12, padding: '5px 12px', gap: 5 }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            </svg>
                            New chat
                        </button>
                    )}
                </div>

                {/* Messages */}
                <div className="chat-messages">
                    {messages.length === 0 ? (
                        <div className="chat-empty">
                            <div style={{ fontSize: 40 }}>✨</div>
                            <div className="chat-empty-title">
                                {docCount === 0 ? 'Upload a document first' : 'How can I help you?'}
                            </div>
                            <div className="chat-empty-sub">
                                {docCount === 0
                                    ? 'Go to Documents tab and upload a PDF, DOCX, or TXT file'
                                    : 'Ask anything about your documents, or pick a suggestion below'}
                            </div>
                            {docCount > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => sendMessage(s)}
                                            style={{
                                                fontSize: 12.5,
                                                padding: '7px 14px',
                                                borderRadius: 20,
                                                border: '1.5px solid var(--border)',
                                                background: 'var(--card)',
                                                color: 'var(--text-2)',
                                                cursor: 'pointer',
                                                fontFamily: 'inherit',
                                                fontWeight: 500,
                                                transition: 'border-color 150ms, color 150ms',
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <MessageBubble
                                key={i}
                                message={msg}
                                isLoading={!!msg.loading}
                                onRetry={msg.isError && i === messages.length - 1 ? handleRetry : undefined}
                            />
                        ))
                    )}
                    <div ref={endRef} />
                </div>

                {/* Input */}
                <div className="chat-input-area">
                    {hasError && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: '#fff8f8',
                            border: '1px solid #fca5a5',
                            borderRadius: 8,
                            padding: '8px 14px',
                            marginBottom: 10,
                            fontSize: 12.5,
                            color: '#b91c1c',
                        }}>
                            <span>⚠</span>
                            <span>Last message failed.</span>
                            <button
                                onClick={handleRetry}
                                style={{ marginLeft: 'auto', fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
                            >
                                ↺ Retry
                            </button>
                        </div>
                    )}
                    <div className="chat-input-wrapper">
                        <textarea
                            ref={textareaRef}
                            className="chat-textarea"
                            value={input}
                            onChange={(e) => { setInput(e.target.value); autoGrow(); }}
                            onKeyDown={handleKey}
                            placeholder={docCount === 0 ? 'Upload documents first…' : 'Ask a question…'}
                            disabled={isLoading}
                            rows={1}
                        />
                        <button
                            className="chat-send-btn"
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            title="Send (Enter)"
                        >
                            {isLoading
                                ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                : <SendIcon />}
                        </button>
                    </div>
                    <div className="chat-hint">Enter to send · Shift+Enter for new line</div>
                </div>
            </div>
        </div>
    );
}
