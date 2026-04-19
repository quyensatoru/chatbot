import { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { chatAPI } from '../services/api';

export default function ChatInterface({ documents }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  console.log("conversationId: ", conversationId)
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages([...messages, { type: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const response = await chatAPI.send(userMessage, conversationId);

      if (response.success) {
        if (!conversationId) {
          setConversationId(response.data.response?.conversationId);
        }

        setMessages((prev) => [
          ...prev,
          {
            type: 'assistant',
            content: response.data.response,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            type: 'assistant',
            content: `Error: ${response.error || 'Failed to get response'}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid #e5e7eb',
        padding: '24px',
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          margin: 0
        }}>Chat</h2>
        <p style={{
          fontSize: '14px',
          color: '#4b5563',
          marginTop: '4px',
          margin: 0
        }}>
          {documents.length === 0
            ? 'Upload documents to start chatting'
            : `${documents.length} document${documents.length !== 1 ? 's' : ''} loaded`}
        </p>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {messages.length === 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#9ca3af',
            textAlign: 'center'
          }}>
            <div>
              <p style={{ fontSize: '16px', fontWeight: '500' }}>No messages yet</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>Start by asking a question about your documents</p>
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} isLoading={isLoading && index === messages.length - 1} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        borderTop: '1px solid #e5e7eb',
        padding: '24px',
        backgroundColor: '#fff'
      }}>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your documents..."
            disabled={documents.length === 0 || isLoading}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'none',
              maxHeight: '120px',
              minHeight: '44px',
              backgroundColor: documents.length === 0 ? '#f3f4f6' : '#fff',
              cursor: documents.length === 0 ? 'not-allowed' : 'text'
            }}
            rows={1}
          />
          <button
            type="submit"
            disabled={isLoading || documents.length === 0}
            style={{
              padding: '12px 16px',
              backgroundColor: isLoading || documents.length === 0 ? '#d1d5db' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || documents.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}