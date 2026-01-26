import { WebClient } from '@slack/web-api';
import { subMinutes } from 'date-fns';
import { logger } from '../utils/logger.js';

// Context message format for AI consumption
export interface ContextMessage {
  userId: string;
  text: string;
  ts: string;
}

// Configuration
const MAX_MESSAGES = 20;
const CONTEXT_WINDOW_MINUTES = 60;

/**
 * Get conversation context from a channel (parent messages only, no thread replies).
 * Use this for channel-level context when a user is mentioned or receives a direct message.
 */
export async function getConversationContext(
  client: WebClient,
  channelId: string,
  options?: {
    maxMessages?: number;
    contextWindowMinutes?: number;
  }
): Promise<ContextMessage[]> {
  const maxMessages = options?.maxMessages ?? MAX_MESSAGES;
  const windowMinutes = options?.contextWindowMinutes ?? CONTEXT_WINDOW_MINUTES;
  const oldest = (subMinutes(new Date(), windowMinutes).getTime() / 1000).toString();

  try {
    const result = await client.conversations.history({
      channel: channelId,
      limit: maxMessages,
      oldest,
    });

    if (!result.ok || !result.messages) {
      logger.warn({ channelId, error: result.error }, 'Failed to fetch conversation history');
      return [];
    }

    // Filter out bot messages and format for AI
    const contextMessages: ContextMessage[] = result.messages
      .filter(m => m.type === 'message' && !m.bot_id && m.text)
      .map(m => ({
        userId: m.user || 'unknown',
        text: m.text || '',
        ts: m.ts || '',
      }))
      .reverse(); // Chronological order (oldest first)

    logger.info({
      channelId,
      messagesRetrieved: contextMessages.length,
      windowMinutes,
    }, 'Conversation context retrieved');

    return contextMessages;
  } catch (error) {
    logger.error({ channelId, error }, 'Error fetching conversation context');
    throw error;
  }
}

/**
 * Get thread context (parent message + all replies).
 * Use this when the trigger is a thread reply or thread mention.
 */
export async function getThreadContext(
  client: WebClient,
  channelId: string,
  threadTs: string,
  options?: {
    maxMessages?: number;
    contextWindowMinutes?: number;
  }
): Promise<ContextMessage[]> {
  const maxMessages = options?.maxMessages ?? MAX_MESSAGES;
  const windowMinutes = options?.contextWindowMinutes ?? CONTEXT_WINDOW_MINUTES;
  const oldest = (subMinutes(new Date(), windowMinutes).getTime() / 1000).toString();

  try {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: maxMessages,
      oldest,
    });

    if (!result.ok || !result.messages) {
      logger.warn({ channelId, threadTs, error: result.error }, 'Failed to fetch thread context');
      return [];
    }

    // Filter out bot messages and format for AI
    const contextMessages: ContextMessage[] = result.messages
      .filter(m => m.type === 'message' && !m.bot_id && m.text)
      .map(m => ({
        userId: m.user || 'unknown',
        text: m.text || '',
        ts: m.ts || '',
      }));

    // conversations.replies returns in chronological order already

    logger.info({
      channelId,
      threadTs,
      messagesRetrieved: contextMessages.length,
    }, 'Thread context retrieved');

    return contextMessages;
  } catch (error) {
    logger.error({ channelId, threadTs, error }, 'Error fetching thread context');
    throw error;
  }
}

/**
 * Get context for a specific message, determining whether to use channel or thread context.
 * If the message has a thread_ts different from its ts, it's a thread reply.
 */
export async function getContextForMessage(
  client: WebClient,
  channelId: string,
  messageTs: string,
  threadTs?: string
): Promise<ContextMessage[]> {
  // If there's a thread_ts and it's different from messageTs, get thread context
  if (threadTs && threadTs !== messageTs) {
    return getThreadContext(client, channelId, threadTs);
  }

  // Check if messageTs is itself a thread parent
  // by fetching replies and seeing if there are any
  try {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: messageTs,
      limit: 2, // Just check if there are replies
    });

    // If there are multiple messages, this is a thread
    if (result.ok && result.messages && result.messages.length > 1) {
      return getThreadContext(client, channelId, messageTs);
    }
  } catch {
    // If this fails, fall back to channel context
    logger.debug({ channelId, messageTs }, 'Could not determine thread status, using channel context');
  }

  // Default to channel context
  return getConversationContext(client, channelId);
}
