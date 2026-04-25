export default function MessageBubble({ message, isLoading }) {
    const isUser = message.type === 'user';

    if (isUser) {
        return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', maxWidth: '600px' }}>
                    <div
                        style={{
                            backgroundColor: '#3b82f6',
                            color: '#fff',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                        }}
                    >
                        <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
                    </div>
                    <div
                        style={{
                            flexShrink: 0,
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#dbeafe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                        }}
                    >
                        👤
                    </div>
                </div>
            </div>
        );
    }

    // Assistant message
    const response = typeof message.content === 'object' ? message.content : { answer: message.content };

    return (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', maxWidth: '600px' }}>
                <div
                    style={{
                        flexShrink: 0,
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                    }}
                >
                    🤖
                </div>
                <div
                    style={{
                        backgroundColor: '#f3f4f6',
                        color: '#111827',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                    }}
                >
                    {isLoading ? (
                        <p style={{ fontSize: '14px', margin: 0 }} className="loading">
                            Thinking...
                        </p>
                    ) : (
                        <>
                            <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>
                                {response.answer || response}
                            </p>
                            {response.sources && response.sources.length > 0 && (
                                <div
                                    style={{
                                        marginTop: '12px',
                                        paddingTop: '12px',
                                        borderTop: '1px solid #d1d5db',
                                        fontSize: '12px',
                                        color: '#4b5563',
                                    }}
                                >
                                    <p style={{ fontWeight: '500', marginBottom: '8px', margin: 0 }}>Sources:</p>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {response.sources.map((source, idx) => (
                                            <li key={idx} style={{ marginBottom: '4px' }}>
                                                {source}
                                            </li>
                                        ))}
                                    </ul>
                                    {response.confidence !== undefined && (
                                        <p style={{ marginTop: '8px', margin: 0 }}>
                                            Confidence: {Math.round(response.confidence * 100)}%
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
