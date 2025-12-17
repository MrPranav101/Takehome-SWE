# Implementation Notes

Please fill this in before submitting.

## What I Built

### Backend:
- **Complete REST API** for conversation management:
  - `GET /api/chats` - List all conversations
  - `POST /api/chats` - Create new conversation
  - `GET /api/chats/:id` - Get single conversation
  - `PATCH /api/chats/:id` - Update conversation title
  - `DELETE /api/chats/:id` - Delete conversation
  - `GET /api/chats/:id/messages` - Get all messages
  - `POST /api/chats/:id/messages` - Send message with SSE streaming
- **SSE (Server-Sent Events) streaming** using `better-sse` for real-time AI responses
- **OpenAI integration** with conversation history support
- **error handling** incase of network disconnects, etc.
- **Message status tracking** (sending, sent, failed)

### Frontend:
- **ChatView component** inclues error handling, retry functionality, auto-updating conversation list on title changes, streaming support, loading states
- **ConversationSidebar component** includes create new conversation button, display conversations ordered by most recent, delete conversation functionality, smart conversation reordering (selected moves to top), seleted conversation gets highlighted
- **MessageList component** includes user and assistant message differentiation, streaming content with animated cursor, failed message indicators with retry buttons, auto-scroll to bottom on new messages, empty state messaging
- **MessageInput component** disabled state during streaming, visual feedback for send button state

## Technical Decisions

### State Management:
- used local component state using React hooks, instead of a global state management solution like Redux/Zustand since the app is relatively small

### styling:
- mininal effort styling, using inline styles with TypeScript for type safety and co-location

### Dependencies Added:
- **better-sse** for SSE streaming, provides 95% of what's needed for production SSE streaming with a clean API, letting me focus on business logic (AI streaming, message handling) rather than SSE protocol details and edge cases.

### backend architecture:
- no orm/query builder used, instead using better-sqlite3 for database operations
- no service/lib abstraction, instead implementing the logic directly in the routes

## What I'd Do Differently

- **Performance**:
    - implement virtual scrolling for very long message lists
    - add more useMemo and useCallback optimizations
    - lazy load conversations with pagination
- **Features**:
    - add markdown rendering for AI responses (code blocks, formatting)
    - add message editing
    - add stop button for streaming responses
    - add conversation search and filtering
    - add file upload support for multi-modal chat
- **Testing**:
    - add unit/integration tests
- **backend**:
    - add rate limiting
    - add user authentication/authorization
    - add ORM/Migration system
    - add request validation middleware (e.g., Zod)
    - add comprehensive logging and observability
    - add docker setup for easier deployment

## Time Spent

Approximately 3 hours

## Questions or Feedback

Any questions you have, or feedback on the challenge itself][
