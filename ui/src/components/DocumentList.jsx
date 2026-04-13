import { useEffect, useState } from 'react';
import { documentsAPI } from '../services/api';

export default function DocumentList({ refresh, documents, setDocuments, onDelete }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, [refresh]);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await documentsAPI.list();
      if (response.success) {
        setDocuments(response.data || []);
      } else {
        setError('Failed to load documents');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Delete this document?')) return;

    try {
      const response = await documentsAPI.delete(documentId);
      if (response.success) {
        const newDocuments = documents.filter(d => d._id !== documentId);
        setDocuments(newDocuments);
        onDelete?.(documentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (isLoading && documents.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>
        <p className="loading">Loading documents...</p>
      </div>
    );
  }

  if (error && documents.length === 0) {
    return (
      <div style={{
        padding: '16px',
        textAlign: 'center',
        color: '#dc2626',
        fontSize: '14px'
      }}>
        <p>{error}</p>
        <button
          onClick={loadDocuments}
          style={{
            marginTop: '8px',
            padding: '6px 12px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div style={{
        padding: '16px',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: '14px'
      }}>
        <p>No documents yet</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151',
        marginTop: 0,
        marginBottom: '12px'
      }}>Documents ({documents.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {documents.map((doc) => (
          <div
            key={doc._id}
            style={{
              padding: '12px',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '14px',
              color: '#111827'
            }}
          >
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: '500'
              }} title={doc.fileName}>
                📄 {doc.fileName}
              </p>
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '12px',
                color: '#6b7280'
              }}>
                {doc.fileSize ? `${doc.fileSize} kb` : 'Uploaded'}
              </p>
            </div>
            <button
              onClick={() => handleDelete(doc._id)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                marginLeft: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#fecaca'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#fee2e2'}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}