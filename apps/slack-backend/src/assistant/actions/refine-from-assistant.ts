import type { App } from '@slack/bolt';
import { logger } from '../../utils/logger.js';

/**
 * Register the Refine action for assistant panel suggestions.
 * Prompts the user to describe their refinement request.
 */
export function registerAssistantRefineAction(app: App): void {
  app.action('assistant_refine_suggestion', async ({ ack, body, client }) => {
    await ack();

    try {
      const actionBody = body as {
        actions: Array<{ value?: string }>;
        user: { id: string };
        channel?: { id: string };
        container?: { channel_id: string; thread_ts?: string };
      };

      const value = actionBody.actions[0]?.value;
      if (!value) return;

      const { suggestionId } = JSON.parse(value);
      const userId = actionBody.user.id;

      logger.info({ suggestionId, userId }, 'Refine requested from assistant panel');

      const channelId = actionBody.channel?.id || actionBody.container?.channel_id;
      const threadTs = actionBody.container?.thread_ts;

      if (channelId && threadTs) {
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: 'What would you like me to change about this suggestion? Reply with your refinement request (e.g., "make it shorter", "more formal", "add a question at the end").',
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error handling assistant refine action');
    }
  });
}
