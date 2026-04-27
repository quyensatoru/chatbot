import { useState, useEffect } from 'react';
import { healthAPI } from '../../services/api';

export default function SystemPage() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    const check = async () => {
        setLoading(true);
        const r = await healthAPI.check();
        setHealth(r);
        setLoading(false);
    };

    useEffect(() => { check(); }, []);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    return (
        <div>
            <div className="system-grid">
                <div className="stat-card">
                    <div className="stat-label">Backend Status</div>
                    <div className="stat-value" style={{ fontSize: 22, color: health?.success ? 'var(--success)' : 'var(--danger)' }}>
                        {loading ? '…' : health?.success ? 'Online' : 'Offline'}
                    </div>
                    <div className="stat-sub">{apiUrl}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">API Version</div>
                    <div className="stat-value" style={{ fontSize: 22 }}>v1</div>
                    <div className="stat-sub">REST + Agent</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Chat Mode</div>
                    <div className="stat-value" style={{ fontSize: 22 }}>Agent</div>
                    <div className="stat-sub">RAG-enhanced</div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                    <div className="card-title">API Endpoints</div>
                    <button className="btn btn-ghost" onClick={check} style={{ fontSize: 12 }}>
                        {loading ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : 'Re-check'}
                    </button>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                    {[
                        ['GET', '/api/health', 'Health check', true],
                        ['POST', '/api/chat/agent', 'AI agent chat', null],
                        ['POST', '/api/upload', 'Upload document', null],
                        ['GET', '/api/documents', 'List documents', null],
                        ['DELETE', '/api/documents/:id', 'Delete document', null],
                        ['GET', '/api/personality', 'List personality profiles', null],
                        ['GET', '/api/personality/:username', 'Get profile detail', null],
                    ].map(([method, path, desc, tested]) => (
                        <div key={path} className="kv-row" style={{ padding: '11px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span className={`badge ${method === 'GET' ? 'badge-green' : method === 'DELETE' ? 'badge-red' : 'badge-indigo'}`}>
                                    {method}
                                </span>
                                <code style={{ fontSize: 12.5, color: 'var(--text-1)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4 }}>
                                    {path}
                                </code>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</span>
                                {tested && (
                                    <span style={{ fontSize: 11, color: health?.success ? 'var(--success)' : 'var(--danger)' }}>
                                        {health?.success ? '✓' : '✗'}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card">
                <div className="card-header"><div className="card-title">Environment</div></div>
                <div className="card-body">
                    <div className="kv-row">
                        <span className="kv-key">API Base URL</span>
                        <code style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 8px', borderRadius: 4 }}>{apiUrl}</code>
                    </div>
                    <div className="kv-row">
                        <span className="kv-key">UI Framework</span>
                        <span className="kv-val">React 19 + Vite</span>
                    </div>
                    <div className="kv-row">
                        <span className="kv-key">Mode</span>
                        <span className="kv-val">{import.meta.env.MODE}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
