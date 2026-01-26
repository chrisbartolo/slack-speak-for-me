import type { App } from '@slack/bolt';
import { logger } from '../../utils/logger.js';

/**
 * Handle "Copy to Clipboard" button click.
 *
 * Since Slack doesn't support programmatic clipboard access,
 * we provide instructions for manual copying and show the text prominently.
 */
export function registerCopySuggestionAction(app: App): void {
  app.action('copy_suggestion', async ({ ack, body, respond }) => {
    await ack();

    // Extract suggestion from button value
    const actionBody = body as { actions: Array<{ value?: string }> };
    const value = actionBody.actions[0]?.value;

    if (!value) {
      logger.warn({ body }, 'Copy action missing value');
      return;
    }

    try {
      const { suggestionId, suggestion } = JSON.parse(value);

      logger.info({
        suggestionId,
        userId: 'user' in body ? body.user.id : 'unknown',
      }, 'Copy button clicked');

      // Respond with instructions and prominent text for copying
      await respond({
        response_type: 'ephemeral',
        replace_original: true,
        text: 'Copy the response below:',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Copy This Response',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Select and copy the text below:*',
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `\`\`\`${suggestion}\`\`\``,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '_Triple-click to select all, then Cmd+C (Mac) or Ctrl+C (Windows) to copy._',
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Done',
                  emoji: true,
                },
                action_id: 'dismiss_suggestion',
                value: suggestionId,
              },
            ],
          },
        ],
      });
    } catch (error) {
      logger.error({ error }, 'Error handling copy action');
    }
  });
}
