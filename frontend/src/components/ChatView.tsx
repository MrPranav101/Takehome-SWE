import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, subscribeToSSE } from '../api/client';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import type { Message, Conversation } from '../types';

interface ChunkData {
  content: string;
}

interface DoneData {
  messageId: string;
  content: string;
}

interface ChatViewProps {
  onConversationUpdate?: (conversation: Conversation) => void;
}

export function ChatView({ onConversationUpdate }: ChatViewProps) {
  const { id } = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Fetch conversation and messages when id changes
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setStreamingContent('');
      setIsStreaming(false);

      try {
        const [conversationData, messagesData] = await Promise.all([
          apiFetch<Conversation>(`/chats/${id}`),
          apiFetch<Message[]>(`/chats/${id}/messages`),
        ]);
        setConversation(conversationData);
        setMessages(messagesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Cleanup any ongoing stream when conversation changes
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [id]);

  const sendMessage = useCallback(async (content: string) => {
    if (!id || isStreaming) return;

    // Clear any previous error
    setError(null);
    
    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: id,
      role: 'user',
      content,
      status: 'sending',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);
    setIsStreaming(true);
    setStreamingContent('');

    // Start SSE stream
    cleanupRef.current = subscribeToSSE(
      `/chats/${id}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      },
      {
        onChunk: (data) => {
          const { content: chunk } = data as ChunkData;
          setStreamingContent((prev) => prev + chunk);
        },
        onDone: (data) => {
          const { messageId, content: fullContent } = data as DoneData;
          
          // Update user message status and add assistant message
          setMessages((prev) => {
            // Update temporary user message
            const updated = prev.map((msg) =>
              msg.id === tempUserMessage.id
                ? { ...msg, status: 'sent' as const, id: msg.id.replace('temp-', 'user-') }
                : msg
            );
            
            // Add assistant message
            const assistantMessage: Message = {
              id: messageId,
              conversation_id: id,
              role: 'assistant',
              content: fullContent,
              status: 'sent',
              created_at: new Date().toISOString(),
            };
            
            return [...updated, assistantMessage];
          });
          
          setStreamingContent('');
          setIsStreaming(false);
          cleanupRef.current = null;
        },
        onError: (err) => {
          // Update user message to show as failed
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempUserMessage.id
                ? { ...msg, status: 'failed' as const, error_message: err.message }
                : msg
            )
          );
          
          setStreamingContent('');
          setIsStreaming(false);
          cleanupRef.current = null;
          setError(err.message);
        },
      }
    );
  }, [id, isStreaming]);

  const handleRetry = useCallback((message: Message) => {
    // Remove the failed message and resend
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    sendMessage(message.content);
  }, [sendMessage]);

  const handleTitleClick = () => {
    if (conversation) {
      setEditedTitle(conversation.title || '');
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = useCallback(async () => {
    if (!id || !editedTitle.trim() || editedTitle === conversation?.title) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const updatedConversation = await apiFetch<Conversation>(`/chats/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editedTitle.trim() }),
      });
      setConversation(updatedConversation);
      setIsEditingTitle(false);
      // Notify parent to update sidebar immediately
      onConversationUpdate?.(updatedConversation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update title');
      setIsEditingTitle(false);
    }
  }, [id, editedTitle, conversation?.title, onConversationUpdate]);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  if (!id) {
    return (
      <div style={styles.placeholder}>
        Select a conversation or start a new one
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}>Loading...</div>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>⚠️</div>
        <div style={styles.errorText}>{error}</div>
        <button
          onClick={() => window.location.reload()}
          style={styles.retryButton}
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            style={styles.titleInput}
          />
        ) : (
          <div
            style={styles.titleContainer}
            onClick={handleTitleClick}
            title="Click to edit title"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <h3 style={styles.title}>
              {conversation?.title || 'Chat'}
            </h3>
            <span style={styles.editIcon}>✏️</span>
          </div>
        )}
      </div>
      
      <MessageList
        messages={messages}
        streamingContent={streamingContent || undefined}
        onRetry={handleRetry}
      />
      
      {error && (
        <div style={styles.inlineError}>
          {error}
          <button onClick={() => setError(null)} style={styles.dismissButton}>
            ×
          </button>
        </div>
      )}
      
      <MessageInput
        onSend={sendMessage}
        disabled={isStreaming}
        placeholder={isStreaming ? 'Waiting for response...' : 'Type your message...'}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#fafafa',
  },
  titleContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
    transition: 'background-color 0.2s',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a2e',
  },
  editIcon: {
    fontSize: 14,
    opacity: 0.6,
  },
  titleInput: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a2e',
    border: '2px solid #1976d2',
    borderRadius: 4,
    padding: '4px 8px',
    outline: 'none',
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 400,
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    fontSize: 16,
    color: '#c62828',
    textAlign: 'center',
  },
  retryButton: {
    padding: '10px 20px',
    backgroundColor: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  inlineError: {
    margin: '0 20px 12px',
    padding: '10px 16px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: 6,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    color: '#c62828',
    cursor: 'pointer',
    padding: '0 4px',
  },
};

export default ChatView;

