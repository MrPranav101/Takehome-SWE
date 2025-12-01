/**
 * OpenAI Streaming Helper
 *
 * Uses the OpenAI API to generate AI responses and stream them
 * back to the client word-by-word via callbacks.
 *
 * Features:
 * - Real AI responses from gpt-4o-mini (fast and cheap)
 * - Streaming output for real-time UX
 * - Conversation context support
 * - Cleanup function to cancel mid-stream
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  /** System instructions for the AI */
  instructions?: string;
  /** Previous messages for context */
  conversationHistory?: Message[];
  /** Milliseconds between streaming chunks (default: 30) */
  streamDelay?: number;
}

const DEFAULT_INSTRUCTIONS = `You are a helpful AI assistant for a construction document management platform called Muro.
You help users analyze construction documents, compare bids, review specifications, and answer questions about their projects.
Keep responses concise but informative. Use markdown formatting when helpful (bullet points, bold for emphasis).
If you don't have enough context to answer a question, ask for clarification.`;

/**
 * Creates a streaming AI response using the OpenAI API.
 *
 * @param userMessage - The user's message to respond to
 * @param onChunk - Called for each chunk of text as it streams
 * @param onError - Called if an error occurs
 * @param onDone - Called when streaming is complete, with the full response
 * @param options - Optional configuration
 * @returns Cleanup function to cancel the stream
 */
export function createAIStream(
  userMessage: string,
  onChunk: (text: string) => void,
  onError: (error: Error) => void,
  onDone: (fullResponse: string) => void,
  options: StreamOptions = {}
): () => void {
  const {
    instructions = DEFAULT_INSTRUCTIONS,
    conversationHistory = [],
    streamDelay = 30,
  } = options;

  let cancelled = false;
  let timeoutId: NodeJS.Timeout | null = null;

  // Build messages array for chat completion
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: instructions },
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  (async () => {
    try {
      // Call OpenAI Chat Completions API
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fast and cost-effective
        messages,
        max_tokens: 1024,
      });

      if (cancelled) return;

      // Get the response text
      const fullText = response.choices[0]?.message?.content || '';

      if (!fullText) {
        throw new Error('No response from AI');
      }

      // Stream the response word by word for a natural typing effect
      const words = fullText.split(/(\s+)/); // Keep whitespace

      const streamWord = (index: number) => {
        if (cancelled || index >= words.length) {
          if (!cancelled) {
            onDone(fullText);
          }
          return;
        }

        const word = words[index];
        onChunk(word);

        timeoutId = setTimeout(() => streamWord(index + 1), streamDelay);
      };

      streamWord(0);
    } catch (error) {
      if (cancelled) return;

      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('OpenAI API error:', err.message);

      // Provide user-friendly error messages
      if (err.message.includes('API key')) {
        onError(
          new Error('AI service configuration error. Please contact support.')
        );
      } else if (err.message.includes('rate limit')) {
        onError(
          new Error('AI service is busy. Please try again in a moment.')
        );
      } else if (err.message.includes('insufficient_quota')) {
        onError(new Error('AI service quota exceeded. Please contact support.'));
      } else {
        onError(
          new Error('AI service temporarily unavailable. Please try again.')
        );
      }
    }
  })();

  // Return cleanup function
  return () => {
    cancelled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * Alternative: Get a complete response without streaming
 */
export async function getAIResponse(
  userMessage: string,
  options: StreamOptions = {}
): Promise<string> {
  const { instructions = DEFAULT_INSTRUCTIONS, conversationHistory = [] } =
    options;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: instructions },
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content || '';
}
