const NAV = [
    {
        section: 'Main',
        items: [
            {
                id: 'chat',
                label: 'Chat',
                icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                ),
            },
            {
                id: 'rag',
                label: 'Documents',
                icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                ),
            },
        ],
    },
    {
        section: 'Admin',
        items: [
            {
                id: 'personality',
                label: 'Personality',
                icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                ),
            },
            {
                id: 'system',
                label: 'System',
                icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                    </svg>
                ),
            },
        ],
    },
];

export default function Sidebar({ active, onNav, docCount, online, isOpen }) {
    return (
        <aside className={`sidebar${isOpen ? ' open' : ''}`}>
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">🤖</div>
                <div className="sidebar-logo-text">
                    <div className="sidebar-logo-title">RAG Admin</div>
                    <div className="sidebar-logo-sub">AI Chatbot Platform</div>
                </div>
            </div>

            <nav className="sidebar-nav">
                {NAV.map((group) => (
                    <div key={group.section}>
                        <div className="sidebar-section-label">{group.section}</div>
                        {group.items.map((item) => (
                            <button
                                key={item.id}
                                className={`nav-item${active === item.id ? ' active' : ''}`}
                                onClick={() => onNav(item.id)}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.label}
                                {item.id === 'rag' && docCount > 0 && (
                                    <span
                                        style={{
                                            marginLeft: 'auto',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            background: 'rgba(99,102,241,0.25)',
                                            color: '#818cf8',
                                            padding: '1px 7px',
                                            borderRadius: '20px',
                                        }}
                                    >
                                        {docCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-status">
                    <div className={`status-dot${online ? '' : ' offline'}`} />
                    <span className="sidebar-status-text">{online ? 'Backend connected' : 'Backend offline'}</span>
                </div>
            </div>
        </aside>
    );
}
