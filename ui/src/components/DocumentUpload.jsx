import { useState, useRef } from 'react';
import { documentsAPI } from '../services/api';

export default function DocumentUpload({ onUploadSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsLoading(true);
    setError(null);

    try {
      const response = await documentsAPI.upload(file);

      if (response.success) {
        onUploadSuccess?.(response.data);
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setError(response.error || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          border: '2px dashed #d1d5db',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
          backgroundColor: '#fff'
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
      >
        <div style={{ fontSize: '14px', color: '#4b5563' }}>
          <p style={{ fontWeight: '500', margin: 0 }}>📄 Upload Document</p>
          <p style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280', margin: 0 }}>
            PDF, DOCX, TXT, or Markdown
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept=".pdf,.docx,.txt,.md"
        style={{ display: 'none' }}
      />

      {isLoading && <p style={{ fontSize: '14px', color: '#3b82f6', marginTop: '8px', margin: 0 }} className="loading">Uploading...</p>}
      {error && <p style={{ fontSize: '14px', color: '#dc2626', marginTop: '8px', margin: 0 }}>{error}</p>}
    </div>
  );
}