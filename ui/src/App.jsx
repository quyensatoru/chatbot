import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import DocumentUpload from './components/DocumentUpload';
import DocumentList from './components/DocumentList';
import './index.css';

function App() {
    const [documents, setDocuments] = useState([]);
    const [refreshDocuments, setRefreshDocuments] = useState(false);

    const handleDocumentUploaded = (doc) => {
        console.log(documents);
        console.log('doc: ', doc);
        setDocuments((prev) => [...prev, doc]);
        setRefreshDocuments(!refreshDocuments);
    };

    const handleDocumentDeleted = (docId) => {
        setDocuments((prev) => prev.filter((d) => d._id !== docId));
    };

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#fff' }}>
            <div
                style={{
                    width: '320px',
                    borderRight: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        padding: '24px',
                        borderBottom: '1px solid #e5e7eb',
                    }}
                >
                    <h1
                        style={{
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: '#111827',
                            margin: 0,
                        }}
                    >
                        RAG Personal
                    </h1>
                    <p
                        style={{
                            fontSize: '14px',
                            color: '#4b5563',
                            marginTop: '4px',
                            margin: 0,
                        }}
                    >
                        Document Chatbot
                    </p>
                </div>

                <div
                    style={{
                        padding: '16px',
                        borderBottom: '1px solid #e5e7eb',
                    }}
                >
                    <DocumentUpload onUploadSuccess={handleDocumentUploaded} />
                </div>

                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                    }}
                >
                    <DocumentList
                        refresh={refreshDocuments}
                        documents={documents}
                        setDocuments={setDocuments}
                        onDelete={handleDocumentDeleted}
                    />
                </div>
            </div>

            {/* Main Chat Area */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                <ChatInterface documents={documents} />
            </div>
        </div>
    );
}

export default App;
