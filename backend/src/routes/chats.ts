import { Router } from 'express';
import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { createAIStream, type Message } from '../openai-stream.js';
import { createSession } from 'better-sse';

const router = Router();

/**
 * GET /api/chats
 * List all conversations, ordered by most recent first
 */
router.get('/', (req, res) => {
  try {
    const conversations = db.prepare(
      'SELECT * FROM conversations ORDER BY updated_at DESC'
    ).all();
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * POST /api/chats
 * Create a new conversation
 * Body: { title?: string }
 */
router.post('/', (req, res) => {
  try {
    const { title } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(id, title || 'New Chat', now, now);
    
    const conversation = db.prepare(
      'SELECT * FROM conversations WHERE id = ?'
    ).get(id);
    
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/chats/:id
 * Get a single conversation by ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const conversation = db.prepare(
      'SELECT * FROM conversations WHERE id = ?'
    ).get(id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * PATCH /api/chats/:id
 * Update conversation (e.g., title)
 * Body: { title: string }
 */
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const now = new Date().toISOString();
    
    const result = db.prepare(
      'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?'
    ).run(title, now, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const conversation = db.prepare(
      'SELECT * FROM conversations WHERE id = ?'
    ).get(id);
    
    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * DELETE /api/chats/:id
 * Delete a conversation and all its messages
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare(
      'DELETE FROM conversations WHERE id = ?'
    ).run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * GET /api/chats/:id/messages
 * Get all messages for a conversation
 */
router.get('/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if conversation exists
    const conversation = db.prepare(
      'SELECT * FROM conversations WHERE id = ?'
    ).get(id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const messages = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(id);
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/chats/:id/messages
 * Send a user message and stream back AI response via SSE
 * Body: { content: string }
 *
 * This endpoint should:
 * 1. Save the user message to the database
 * 2. Create a placeholder assistant message (status: 'sending')
 * 3. Stream the AI response using SSE
 * 4. Update the assistant message when complete (or on error)
 *
 * SSE Format:
 *   event: chunk
 *   data: {"content": "word "}
 *
 *   event: done
 *   data: {"messageId": "xxx", "content": "full response"}
 *
 *   event: error
 *   data: {"error": "error message"}
 */
router.post('/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  // Validate input
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Message content is required' });
  }
  
  try {
    // 1. Check if conversation exists
    const conversation = db.prepare(
      'SELECT * FROM conversations WHERE id = ?'
    ).get(id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // 2. Get conversation history from database
    const dbMessages = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? AND status = ? ORDER BY created_at ASC'
    ).all(id, 'sent') as Array<{ role: string; content: string }>;
    
    // Convert to Message format for createAIStream
    const conversationHistory: Message[] = dbMessages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
    
    // 3. Save the user message to database
    const userMessageId = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userMessageId, id, 'user', content, 'sent', now);
    
    // 4. Create placeholder assistant message
    const assistantMessageId = uuidv4();
    
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(assistantMessageId, id, 'assistant', '', 'sending', now);
    
    // 5. Update conversation's updated_at timestamp
    db.prepare(
      'UPDATE conversations SET updated_at = ? WHERE id = ?'
    ).run(now, id);
    
    // 6. Create SSE session using better-sse
    const session = await createSession(req, res);
    
    // Accumulate the full response
    let fullResponse = '';
    
    // 7. Initialize the stream with conversation history
    const cancelStream = createAIStream(
      content,
      (chunk) => {
        // onChunk: Accumulate and push data to SSE session
        fullResponse += chunk;
        session.push({ content: chunk }, 'chunk');
      },
      (error) => {
        // onError: Update message status to failed and send error event
        console.error('Stream error:', error);
        
        db.prepare(
          'UPDATE messages SET status = ?, error_message = ? WHERE id = ?'
        ).run('failed', error.message, assistantMessageId);
        
        session.push({ error: error.message }, 'error');
        res.end();
      },
      (fullText) => {
        // onDone: Update assistant message with full response and mark as sent
        db.prepare(
          'UPDATE messages SET content = ?, status = ? WHERE id = ?'
        ).run(fullText, 'sent', assistantMessageId);
        
        // Signal the end of the stream with messageId and full content
        session.push({ messageId: assistantMessageId, content: fullText }, 'done');
        res.end();
      },
      {
        conversationHistory
      }
    );
    
    // Cleanup on client disconnect
    session.on('disconnected', () => {
      console.log('Client disconnected, cancelling stream...');
      if (cancelStream) cancelStream();
    });
    
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

export default router;
