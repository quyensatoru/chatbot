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

function App() {
    const [page, setPage] = useState('chat');
    const [docCount, setDocCount] = useState(0);
    const [online, setOnline] = useState(false);
    const [toasts, setToasts] = useState([]);

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

    const { title, sub } = PAGE_TITLES[page];

    return (
        <div className="app-layout">
            <Sidebar active={page} onNav={setPage} docCount={docCount} online={online} />

            <div className="main-content">
                {page !== 'chat' && (
                    <div className="page-header">
                        <div className="page-header-left">
                            <div className="page-title">{title}</div>
                            <div className="page-subtitle">{sub}</div>
                        </div>
                    </div>
                )}

                {page === 'chat' && <ChatInterface docCount={docCount} />}

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
