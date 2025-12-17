import { useCallback, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ConversationSidebar } from './components/ConversationSidebar';
import { ChatView } from './components/ChatView';
import type { Conversation } from './types';

/**
 * Main App Component
 * 
 * A streaming chat interface with:
 * - Conversation list sidebar
 * - Message thread view
 * - Input for sending messages
 * - Streaming response display
 * - Error handling with retry
 */
function App() {
  const sidebarRef = useRef<{ updateConversation: (conversation: Conversation) => void }>(null);

  const handleConversationUpdate = useCallback((conversation: Conversation) => {
    sidebarRef.current?.updateConversation(conversation);
  }, []);

  return (
    <div style={styles.container}>
      <ConversationSidebar ref={sidebarRef} />
      
      <main style={styles.main}>
        <Routes>
          <Route
            path="/"
            element={
              <div style={styles.placeholder}>
                <div style={styles.placeholderIcon}>💬</div>
                <div style={styles.placeholderTitle}>Welcome to Muro Chat</div>
                <div style={styles.placeholderText}>
                  Select a conversation from the sidebar or start a new one
                </div>
              </div>
            }
          />
          <Route path="/chat/:id" element={<ChatView onConversationUpdate={handleConversationUpdate} />} />
        </Routes>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    padding: 40,
    backgroundColor: '#fff',
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 24,
    opacity: 0.6,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
};

export default App;
