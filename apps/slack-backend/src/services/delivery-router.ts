import type { WebClient } from '@slack/web-api';
import { sendSuggestionEphemeral } from './suggestion-delivery.js';
import { logger } from '../utils/logger.js';

interface UsageInfo {
  used: number;
  limit: number;
  warningLevel: 'safe' | 'warning' | 'critical' | 'exceeded';
  planId: string;
}

interface DeliveryOptions {
  client: WebClient;
  workspaceId: string;
  userId: string;
  channelId: string;
  suggestionId: string;
  suggestion: string;
  triggerContext: 'mention' | 'reply' | 'thread' | 'message_action' | 'dm';
  threadTs?: string;
  usageInfo?: UsageInfo;
}

/**
 * Route suggestion delivery based on trigger context.
 *
 * - Channel-based triggers (mention, reply, thread): ephemeral delivery (existing behavior)
 * - DMs and message actions: ephemeral with fallback to bot DM (existing behavior)
 * - Assistant panel delivery happens automatically via the userMessage handler
 *   when a user has the assistant open — that path bypasses this router entirely.
 */
export async function routeDelivery(
  options: DeliveryOptions,
): Promise<'ephemeral' | 'dm_fallback'> {
  const { triggerContext, channelId } = options;

  logger.debug(
    { triggerContext, channelId, userId: options.userId },
    'Routing suggestion delivery',
  );

  // All worker-initiated deliveries use the existing ephemeral path.
  // The assistant panel handles its own delivery through the userMessage handler.
  await sendSuggestionEphemeral(options);

  return channelId.startsWith('D') ? 'dm_fallback' : 'ephemeral';
}
