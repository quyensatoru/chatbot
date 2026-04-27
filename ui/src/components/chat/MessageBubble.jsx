import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';

function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function extractText(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
        return content.answer || content.message || content.text || JSON.stringify(content, null, 2);
    }
    return String(content);
}

function TypingDots() {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
            {[0, 1, 2].map((i) => (
                <span key={i} className="typing-dot" style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
        </span>
    );
}

function WarnIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    );
}

function CopyIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function CodeBlock({ language, children }) {
    const [copied, setCopied] = useState(false);
    const code = String(children).replace(/\n$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="md-code-block">
            <div className="md-code-header">
                <span className="md-code-lang">{language || 'code'}</span>
                <button className="md-copy-btn" onClick={handleCopy}>
                    {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                </button>
            </div>
            <pre className="md-pre"><code>{code}</code></pre>
        </div>
    );
}

const MD_COMPONENTS = {
    code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        if (!inline) {
            return <CodeBlock language={match?.[1]}>{children}</CodeBlock>;
        }
        return <code className="md-inline-code" {...props}>{children}</code>;
    },
    pre({ children }) {
        return <>{children}</>;
    },
    h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
    h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
    h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
    h4: ({ children }) => <h4 className="md-h4">{children}</h4>,
    p: ({ children }) => <p className="md-p">{children}</p>,
    ul: ({ children }) => <ul className="md-ul">{children}</ul>,
    ol: ({ children }) => <ol className="md-ol">{children}</ol>,
    li: ({ children }) => <li className="md-li">{children}</li>,
    blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
    a: ({ href, children }) => (
        <a href={href} className="md-link" target="_blank" rel="noopener noreferrer">{children}</a>
    ),
    table: ({ children }) => (
        <div className="md-table-wrap"><table className="md-table">{children}</table></div>
    ),
    thead: ({ children }) => <thead className="md-thead">{children}</thead>,
    th: ({ children }) => <th className="md-th">{children}</th>,
    td: ({ children }) => <td className="md-td">{children}</td>,
    hr: () => <hr className="md-hr" />,
    strong: ({ children }) => <strong className="md-strong">{children}</strong>,
    em: ({ children }) => <em className="md-em">{children}</em>,
    del: ({ children }) => <del className="md-del">{children}</del>,
};

function MarkdownBody({ text }) {
    return (
        <div className="md-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {text}
            </ReactMarkdown>
        </div>
    );
}

export default function MessageBubble({ message, isLoading, onRetry }) {
    const isUser = message.type === 'user';
    const isError = message.isError;
    const response = typeof message.content === 'object' ? message.content : null;
    const text = isUser ? String(message.content) : extractText(message.content);

    /* ── User message ── */
    if (isUser) {
        return (
            <div className="msg-row user">
                <div className="msg-avatar user">👤</div>
                <div>
                    <div className="msg-bubble user">
                        <div className="md-body md-user">{text}</div>
                    </div>
                    <div className="msg-time">{formatTime(message.timestamp)}</div>
                </div>
            </div>
        );
    }

    /* ── Loading ── */
    if (isLoading) {
        return (
            <div className="msg-row assistant">
                <div className="msg-avatar assistant">🤖</div>
                <div>
                    <div className="msg-bubble assistant" style={{ padding: '14px 18px' }}>
                        <TypingDots />
                    </div>
                </div>
            </div>
        );
    }

    /* ── Error ── */
    if (isError) {
        return (
            <div className="msg-row assistant">
                <div className="msg-avatar assistant" style={{ background: '#fee2e2' }}>⚠️</div>
                <div>
                    <div className="msg-bubble assistant" style={{ background: '#fff8f8', border: '1px solid #fca5a5', color: '#991b1b' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <WarnIcon />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Something went wrong</div>
                                <div style={{ fontSize: 12.5, color: '#b91c1c', lineHeight: 1.5 }}>
                                    {text.replace(/^Error:\s*/i, '')}
                                </div>
                                {onRetry && (
                                    <button onClick={onRetry} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        ↺ Retry
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="msg-time">{formatTime(message.timestamp)}</div>
                </div>
            </div>
        );
    }

    /* ── Normal assistant ── */
    return (
        <div className="msg-row assistant">
            <div className="msg-avatar assistant">🤖</div>
            <div style={{ maxWidth: '72%' }}>
                <div className="msg-bubble assistant">
                    <MarkdownBody text={text} />
                    {response?.sources?.length > 0 && (
                        <div className="msg-sources">
                            <div className="msg-sources-title">Sources</div>
                            <ul>
                                {response.sources.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                            {response.confidence !== undefined && (
                                <div className="msg-confidence">
                                    Confidence: {Math.round(response.confidence * 100)}%
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="msg-time">{formatTime(message.timestamp)}</div>
            </div>
        </div>
    );
}
