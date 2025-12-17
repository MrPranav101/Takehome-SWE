import { useEffect, useRef } from 'react';
import type { Message } from '../types';

interface MessageListProps {
  messages: Message[];
  streamingContent?: string;
  onRetry?: (message: Message) => void;
}

export function MessageList({ messages, streamingContent, onRetry }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !streamingContent) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>💬</div>
        <div style={styles.emptyText}>No messages yet</div>
        <div style={styles.emptySubtext}>Start a conversation by typing a message below</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onRetry={onRetry}
        />
      ))}
      {streamingContent && (
        <div style={{ ...styles.message, ...styles.assistantMessage }}>
          <div style={styles.messageRole}>Assistant</div>
          <div style={styles.messageContent}>
            {streamingContent}
            <span style={styles.cursor}>▋</span>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  onRetry?: (message: Message) => void;
}

function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isFailed = message.status === 'failed';
  const isSending = message.status === 'sending';

  return (
    <div
      style={{
        ...styles.message,
        ...(isUser ? styles.userMessage : styles.assistantMessage),
        ...(isFailed ? styles.failedMessage : {}),
      }}
    >
      <div style={styles.messageRole}>
        {isUser ? 'You' : 'Assistant'}
        {isSending && <span style={styles.sendingIndicator}> (typing...)</span>}
      </div>
      <div style={styles.messageContent}>
        {message.content || (isSending ? <span style={styles.typingDots}>...</span> : '')}
      </div>
      {isFailed && (
        <div style={styles.errorContainer}>
          <span style={styles.errorText}>
            {message.error_message || 'Failed to send'}
          </span>
          {onRetry && isUser && (
            <button
              onClick={() => onRetry(message)}
              style={styles.retryButton}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 500,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
  },
  message: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: 12,
    lineHeight: 1.5,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#1976d2',
    color: '#fff',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5f5f5',
    color: '#1a1a2e',
    borderBottomLeftRadius: 4,
  },
  failedMessage: {
    backgroundColor: '#ffebee',
    border: '1px solid #ffcdd2',
  },
  messageRole: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 4,
    opacity: 0.8,
  },
  messageContent: {
    fontSize: 15,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  sendingIndicator: {
    fontWeight: 400,
    fontStyle: 'italic',
  },
  typingDots: {
    animation: 'pulse 1.5s infinite',
    opacity: 0.6,
  },
  cursor: {
    animation: 'blink 1s infinite',
    opacity: 0.7,
  },
  errorContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid #ffcdd2',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#c62828',
    flex: 1,
  },
  retryButton: {
    padding: '6px 12px',
    backgroundColor: '#c62828',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
};

export default MessageList;

