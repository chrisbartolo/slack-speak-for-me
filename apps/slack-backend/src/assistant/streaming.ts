import type { WebClient } from '@slack/web-api';
import { generateSuggestionStream } from '../services/ai.js';
import { createFeedbackBlock } from './feedback.js';
import { getContextForMessage } from '../services/context.js';
import { recordUsageEvent } from '../services/usage-enforcement.js';
import { logger } from '../utils/logger.js';

interface StreamOptions {
  client: WebClient;
  channelId: string;
  threadTs: string;
  userText: string;
  viewingChannelId?: string;
  viewingThreadTs?: string;
  workspaceId: string;
  userId: string;
}

/**
 * Stream an AI suggestion to the assistant panel via chatStream.
 * Connects the Anthropic streaming SDK to Slack's chatStream utility.
 */
export async function streamSuggestionToAssistant(options: StreamOptions): Promise<void> {
  const {
    client,
    channelId,
    threadTs,
    userText,
    viewingChannelId,
    viewingThreadTs,
    workspaceId,
    userId,
  } = options;

  const startTime = Date.now();

  // Fetch context messages from the channel the user is viewing
  let contextMessages: { userId: string; text: string; ts: string }[] = [];
  if (viewingChannelId) {
    try {
      contextMessages = await getContextForMessage(
        client,
        viewingChannelId,
        viewingThreadTs || '',
        viewingThreadTs,
      );
    } catch (contextError) {
      logger.warn(
        { contextError, viewingChannelId },
        'Could not fetch context from viewing channel, proceeding without',
      );
    }
  }

  // Get the streaming response from the AI service
  const { stream, usageCheck } = await generateSuggestionStream({
    workspaceId,
    userId,
    channelId: viewingChannelId,
    triggerMessage: userText,
    contextMessages,
    triggeredBy: viewingChannelId?.startsWith('D') ? 'dm' : 'message_action',
  });

  // Create a chatStream instance for progressive display
  const streamer = client.chatStream({
    channel: channelId,
    thread_ts: threadTs,
  });

  // Pipe Anthropic stream chunks to Slack chatStream
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta'
    ) {
      await streamer.append({ markdown_text: event.delta.text });
    }
  }

  // Generate suggestion ID for feedback tracking
  const suggestionId =
    'sug_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

  // Stop the stream with feedback buttons
  await streamer.stop({
    blocks: [createFeedbackBlock(suggestionId) as any],
  });

  const processingTimeMs = Date.now() - startTime;

  // Record usage event (fire-and-forget)
  recordUsageEvent({
    workspaceId,
    userId,
    eventType: 'suggestion',
    tokensUsed: 0, // Token count not available from streaming
    costEstimate: 0,
  }).catch(err => {
    logger.warn({ error: err }, 'Failed to record assistant usage event');
  });

  logger.info(
    { processingTimeMs, suggestionId, channelId, viewingChannelId },
    'Streamed AI suggestion to assistant panel',
  );
}
