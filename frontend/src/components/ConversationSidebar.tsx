import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../api/client';
import type { Conversation } from '../types';

interface ConversationSidebarProps {
  onConversationChange?: () => void;
}

export interface ConversationSidebarRef {
  updateConversation: (conversation: Conversation) => void;
}

export const ConversationSidebar = forwardRef<ConversationSidebarRef, ConversationSidebarProps>(
  ({ onConversationChange }, ref) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    
    // Extract conversation ID from URL path (e.g., /chat/abc-123 -> abc-123)
    const currentId = location.pathname.startsWith('/chat/') 
      ? location.pathname.split('/chat/')[1] 
      : undefined;

    const fetchConversations = async () => {
      try {
        setError(null);
        const data = await apiFetch<Conversation[]>('/chats');
        setConversations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchConversations();
    }, []);

    // Move current conversation to top when it changes (e.g., on page load or navigation)
    useEffect(() => {
      if (currentId && conversations.length > 0) {
        setConversations((prev) => {
          const selectedConv = prev.find((c) => c.id === currentId);
          if (!selectedConv || prev[0]?.id === currentId) return prev; // Already at top
          
          const others = prev.filter((c) => c.id !== currentId);
          return [selectedConv, ...others];
        });
      }
    }, [currentId, conversations.length]);

    // Expose updateConversation method to parent via ref
    useImperativeHandle(ref, () => ({
      updateConversation: (updatedConversation: Conversation) => {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === updatedConversation.id ? updatedConversation : conv
          )
        );
      },
    }), []);

  const handleNewChat = async () => {
    try {
      setCreating(true);
      setError(null);
      const newConversation = await apiFetch<Conversation>('/chats', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Chat' }),
      });
      setConversations((prev) => [newConversation, ...prev]);
      navigate(`/chat/${newConversation.id}`);
      onConversationChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setCreating(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    // Move selected conversation to the top
    setConversations((prev) => {
      const selectedConv = prev.find((c) => c.id === id);
      if (!selectedConv) return prev;
      
      const others = prev.filter((c) => c.id !== id);
      return [selectedConv, ...others];
    });
    
    navigate(`/chat/${id}`);
    onConversationChange?.();
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/chats/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentId === id) {
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <h2 style={styles.title}>Conversations</h2>
        <button
          onClick={handleNewChat}
          disabled={creating}
          style={{
            ...styles.newChatButton,
            opacity: creating ? 0.6 : 1,
            cursor: creating ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? '...' : '+ New Chat'}
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={fetchConversations} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      <div style={styles.listContainer}>
        {loading ? (
          <div style={styles.loading}>Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <div style={styles.empty}>
            No conversations yet.
            <br />
            Start a new chat!
          </div>
        ) : (
          <ul style={styles.list}>
            {conversations.map((conversation) => (
              <li
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                style={{
                  ...styles.listItem,
                  backgroundColor: currentId === conversation.id ? '#e3f2fd' : 'transparent',
                  borderLeft: currentId === conversation.id ? '3px solid #1976d2' : '3px solid transparent',
                }}
              >
                <div style={styles.conversationContent}>
                  <span style={styles.conversationTitle}>
                    {conversation.title || 'Untitled'}
                  </span>
                  <span style={styles.conversationDate}>
                    {formatDate(conversation.updated_at)}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(e, conversation.id)}
                  style={styles.deleteButton}
                  title="Delete conversation"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
});

ConversationSidebar.displayName = 'ConversationSidebar';

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 280,
    background: '#fff',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    padding: 16,
    borderBottom: '1px solid #e0e0e0',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a2e',
  },
  newChatButton: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  error: {
    margin: 12,
    padding: 12,
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: 6,
    fontSize: 13,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  retryButton: {
    padding: '6px 12px',
    backgroundColor: '#c62828',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
  },
  loading: {
    padding: 16,
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  empty: {
    padding: 16,
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    lineHeight: 1.6,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    borderBottom: '1px solid #f0f0f0',
  },
  conversationContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: '#1a1a2e',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  conversationDate: {
    fontSize: 12,
    color: '#888',
  },
  deleteButton: {
    background: 'transparent',
    border: 'none',
    fontSize: 20,
    color: '#999',
    cursor: 'pointer',
    padding: '4px 8px',
    marginLeft: 8,
    borderRadius: 4,
    lineHeight: 1,
  },
};

