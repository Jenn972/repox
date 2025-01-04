import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Since we're using it in browser
});

import type { ChatCompletionMessageParam } from 'openai/resources/chat';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Keep track of chat history per user
const chatHistories = new Map<PeerId, ChatMessage[]>();

// Helper to get chat history
function getChatHistory(peerId: PeerId): ChatMessage[] {
  if (!chatHistories.has(peerId)) {
    chatHistories.set(peerId, []);
  }
  return chatHistories.get(peerId);
}

// Add message to chat history
export function addMessageToHistory(peerId: PeerId, message: ChatMessage) {
  const history = getChatHistory(peerId);
  history.push(message);
  
  // Keep only last 10 messages
  if (history.length > 10) {
    history.splice(0, history.length - 10);
  }
}

export async function generateAIReply(messageText: string, peerId: PeerId, agentType: 'professional' | 'friendly' | 'concise' | 'custom', customType?: string) {
  try {
    const history = getChatHistory(peerId);
    
    // Convert history to OpenAI message format
    // Add agent personality to system message
    const systemMessage: ChatCompletionMessageParam = {
      role: 'system',
      content: agentType === 'professional' ? 
        'You are a professional and formal assistant.' :
        agentType === 'friendly' ? 
        'You are a friendly and casual assistant.' :
        agentType === 'concise' ?
        'You are a concise assistant that gives brief, direct answers.' :
        `You are a ${customType || 'professional and helpful'} assistant.`
    };

    const messages: ChatCompletionMessageParam[] = [
      systemMessage,
      ...history.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    ];

    // Add current message
    messages.push({
      role: 'user',
      content: messageText
    });

    const completion = await openai.chat.completions.create({
      messages,
      model: 'gpt-3.5-turbo',
    });

    const reply = completion.choices[0]?.message?.content || '';

    // Add AI response to history
    if (reply) {
      addMessageToHistory(peerId, {
        role: 'assistant',
        content: reply,
        timestamp: Date.now()
      });
    }

    return reply;
  } catch(err) {
    console.error('OpenAI API error:', err);
    return '';
  }
}

// Add user message to history
export function addUserMessage(peerId: PeerId, messageText: string) {
  addMessageToHistory(peerId, {
    role: 'user', 
    content: messageText,
    timestamp: Date.now()
  });
}
