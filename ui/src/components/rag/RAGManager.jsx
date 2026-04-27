import { useState, useEffect, useRef } from 'react';
import { documentsAPI } from '../../services/api';

const UploadIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
        <polyline points="16 16 12 12 8 16" />
        <line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
);

const DocIcon = ({ mime }) => {
    if (mime?.includes('pdf')) return '📕';
    if (mime?.includes('word') || mime?.includes('docx')) return '📘';
    if (mime?.includes('markdown') || mime?.includes('md')) return '📝';
    return '📄';
};

const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
);

function formatBytes(b) {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RAGManager({ onDocCountChange, onToast }) {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    const fileRef = useRef(null);

    useEffect(() => {
        loadDocs();
    }, []);

    useEffect(() => {
        onDocCountChange?.(docs.length);
    }, [docs.length]);

    const loadDocs = async () => {
        setLoading(true);
        setError(null);
        const res = await documentsAPI.list();
        if (res.success) setDocs(res.data || []);
        else setError(res.error || 'Failed to load documents');
        setLoading(false);
    };

    const handleUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        const res = await documentsAPI.upload(file);
        setUploading(false);
        if (res.success) {
            onToast?.('Document uploaded successfully', 'success');
            loadDocs();
        } else {
            onToast?.(res.error || 'Upload failed', 'error');
        }
    };

    const handleFileInput = (e) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    };

    const handleDelete = async (doc) => {
        if (!window.confirm(`Delete "${doc.fileName}"?`)) return;
        setDeletingId(doc._id);
        const res = await documentsAPI.delete(doc._id);
        if (res.success) {
            setDocs((prev) => prev.filter((d) => d._id !== doc._id));
            onToast?.('Document deleted', 'success');
        } else {
            onToast?.(res.error || 'Delete failed', 'error');
        }
        setDeletingId(null);
    };

    return (
        <div className="rag-layout">
            {/* Left: upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Upload Document</div>
                            <div className="card-subtitle">PDF, DOCX, TXT, Markdown</div>
                        </div>
                    </div>
                    <div className="card-body">
                        <div
                            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                        >
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                                <UploadIcon />
                            </div>
                            <div className="drop-zone-title">
                                {uploading ? 'Uploading…' : 'Drop file here'}
                            </div>
                            <div className="drop-zone-sub">or click to browse</div>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.docx,.txt,.md"
                            style={{ display: 'none' }}
                            onChange={handleFileInput}
                        />
                        {uploading && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--accent)' }}>
                                <span className="spinner" />
                                Processing document…
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Supported formats</div>
                    </div>
                    <div className="card-body" style={{ padding: '14px 18px' }}>
                        {[['📕', 'PDF', 'Portable Document Format'], ['📘', 'DOCX', 'Word Document'], ['📝', 'TXT', 'Plain Text'], ['📋', 'MD', 'Markdown']].map(([icon, ext, desc]) => (
                            <div key={ext} className="kv-row">
                                <span className="kv-key">{icon} {ext}</span>
                                <span className="kv-val" style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>{desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right: document list */}
            <div className="card">
                <div className="card-header">
                    <div>
                        <div className="card-title">Documents</div>
                        <div className="card-subtitle">{docs.length} file{docs.length !== 1 ? 's' : ''} indexed</div>
                    </div>
                    <button className="btn btn-ghost" onClick={loadDocs} style={{ fontSize: 12 }}>
                        Refresh
                    </button>
                </div>
                <div className="card-body">
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius)' }} />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="alert alert-error">
                            <span>⚠</span>
                            <div>
                                <div style={{ fontWeight: 600 }}>{error}</div>
                                <button className="btn btn-ghost" onClick={loadDocs} style={{ marginTop: 8, fontSize: 12 }}>
                                    Retry
                                </button>
                            </div>
                        </div>
                    ) : docs.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📂</div>
                            <div className="empty-state-title">No documents yet</div>
                            <div className="empty-state-sub">Upload your first document to get started</div>
                        </div>
                    ) : (
                        <div className="doc-list">
                            {docs.map((doc) => (
                                <div key={doc._id} className="doc-item">
                                    <div className="doc-icon">
                                        <DocIcon mime={doc.mimeType} />
                                    </div>
                                    <div className="doc-info">
                                        <div className="doc-name" title={doc.fileName}>{doc.fileName}</div>
                                        <div className="doc-meta">
                                            {formatBytes(doc.fileSize)}
                                            {doc.createdAt && ` · ${formatDate(doc.createdAt)}`}
                                            {doc.chunks && <span className="doc-chunks">{doc.chunks} chunks</span>}
                                        </div>
                                    </div>
                                    <button
                                        className="btn-icon"
                                        onClick={() => handleDelete(doc)}
                                        disabled={deletingId === doc._id}
                                        title="Delete document"
                                    >
                                        {deletingId === doc._id
                                            ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                                            : <TrashIcon />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
