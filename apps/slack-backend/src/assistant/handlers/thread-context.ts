import type { AssistantThreadContextChangedMiddleware } from '@slack/bolt';
import { logger } from '../../utils/logger.js';

/**
 * Handle assistant_thread_context_changed event.
 * Persists the updated channel context via Bolt's ThreadContextStore.
 */
export const handleThreadContextChanged: AssistantThreadContextChangedMiddleware = async ({
  saveThreadContext,
  event,
}) => {
  try {
    await saveThreadContext();

    const channelId = event.assistant_thread?.context?.channel_id;
    logger.debug({ channelId }, 'Assistant thread context changed');
  } catch (error) {
    logger.error({ error }, 'Error in assistant threadContextChanged handler');
  }
};
