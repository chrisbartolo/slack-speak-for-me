import type { App } from '@slack/bolt';
import { trackFeedback } from '../../services/feedback-tracker.js';
import { getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';

/**
 * Register the Dismiss action for assistant panel suggestions.
 */
export function registerAssistantDismissAction(app: App): void {
  app.action('assistant_dismiss_suggestion', async ({ ack, body, client }) => {
    await ack();

    try {
      const actionBody = body as {
        actions: Array<{ value?: string }>;
        user: { id: string };
        team?: { id: string };
        channel?: { id: string };
        container?: { channel_id: string; thread_ts?: string };
      };

      const value = actionBody.actions[0]?.value;
      if (!value) return;

      const { suggestionId } = JSON.parse(value);
      const userId = actionBody.user.id;
      const teamId = actionBody.team?.id;

      logger.info({ suggestionId, userId }, 'Suggestion dismissed from assistant panel');

      // Track dismissal
      if (teamId) {
        const workspaceId = await getWorkspaceId(teamId);
        if (workspaceId) {
          await trackFeedback({
            workspaceId,
            userId,
            suggestionId,
            action: 'dismissed',
          });
        }
      }

      const channelId = actionBody.channel?.id || actionBody.container?.channel_id;
      const threadTs = actionBody.container?.thread_ts;

      if (channelId && threadTs) {
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: 'Suggestion dismissed. Send me another message if you need help.',
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error handling assistant dismiss action');
    }
  });
}
