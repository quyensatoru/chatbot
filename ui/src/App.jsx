import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/chat/ChatInterface';
import RAGManager from './components/rag/RAGManager';
import PersonalityViewer from './components/admin/PersonalityViewer';
import SystemPage from './components/admin/SystemPage';
import { healthAPI } from './services/api';
import './index.css';

const PAGE_TITLES = {
    chat: { title: 'Chat', sub: 'AI agent powered by RAG' },
    rag: { title: 'Documents', sub: 'Upload and manage knowledge base' },
    personality: { title: 'Personality Profiles', sub: 'User personality analytics' },
    system: { title: 'System', sub: 'Backend status and configuration' },
};

function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map((t) => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
                    {t.message}
                </div>
            ))}
        </div>
    );
}

const HamburgerIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
);

function App() {
    const [page, setPage] = useState('chat');
    const [docCount, setDocCount] = useState(0);
    const [online, setOnline] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        healthAPI.check().then((r) => setOnline(!!r?.success));
        const id = setInterval(() => healthAPI.check().then((r) => setOnline(!!r?.success)), 30000);
        return () => clearInterval(id);
    }, []);

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    }, []);

    const handleNav = useCallback((p) => {
        setPage(p);
        setSidebarOpen(false);
    }, []);

    const { title, sub } = PAGE_TITLES[page];

    return (
        <div className="app-layout">
            <div className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />
            <Sidebar active={page} onNav={handleNav} docCount={docCount} online={online} isOpen={sidebarOpen} />

            <div className="main-content">
                {page !== 'chat' && (
                    <div className="page-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                                <HamburgerIcon />
                            </button>
                            <div className="page-header-left">
                                <div className="page-title">{title}</div>
                                <div className="page-subtitle">{sub}</div>
                            </div>
                        </div>
                    </div>
                )}

                {page === 'chat' && <ChatInterface docCount={docCount} onOpenSidebar={() => setSidebarOpen(true)} />}

                {page === 'rag' && (
                    <div className="page-body">
                        <RAGManager onDocCountChange={setDocCount} onToast={showToast} />
                    </div>
                )}

                {page === 'personality' && (
                    <div className="page-body">
                        <PersonalityViewer />
                    </div>
                )}

                {page === 'system' && (
                    <div className="page-body">
                        <SystemPage />
                    </div>
                )}
            </div>

            <Toast toasts={toasts} />
        </div>
    );
}

export default App;
