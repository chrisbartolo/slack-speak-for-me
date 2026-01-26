import type { App } from '@slack/bolt';
import { getContextForMessage } from '../../services/context.js';
import { queueAIResponse } from '../../jobs/queues.js';
import { logger } from '../../utils/logger.js';

/**
 * Register app_mention event handler
 *
 * Triggered when the bot is @mentioned in a channel.
 * Fetches conversation context and queues an AI response job.
 */
export function registerAppMentionHandler(app: App) {
  app.event('app_mention', async ({ event, client }) => {
    try {
      logger.info({
        channel: event.channel,
        user: event.user,
        ts: event.ts,
        threadTs: event.thread_ts,
      }, 'app_mention event received');

      // Get the workspace/team ID from the client's auth test
      const authResult = await client.auth.test();
      const workspaceId = authResult.team_id as string;

      if (!workspaceId) {
        logger.error('Could not determine workspace ID from auth.test');
        return;
      }

      // Fetch conversation context
      logger.debug({ channel: event.channel, ts: event.ts }, 'Fetching context for app mention');
      const contextMessages = await getContextForMessage(
        client,
        event.channel,
        event.ts,
        event.thread_ts
      );

      logger.debug({
        channel: event.channel,
        contextMessageCount: contextMessages.length,
      }, 'Context retrieved for app mention');

      // Ensure user ID exists
      if (!event.user) {
        logger.error('app_mention event missing user ID');
        return;
      }

      // Queue AI response job
      const job = await queueAIResponse({
        workspaceId,
        userId: event.user as string,
        channelId: event.channel,
        messageTs: event.ts,
        triggerMessageText: event.text,
        contextMessages,
        triggeredBy: 'mention',
      });

      logger.info({
        jobId: job.id,
        channel: event.channel,
        user: event.user,
      }, 'AI response job queued for app mention');

    } catch (error) {
      logger.error({ error, event }, 'Error handling app_mention event');
      // Don't rethrow - we don't want to crash the app for a single event
    }
  });

  logger.info('app_mention event handler registered');
}
