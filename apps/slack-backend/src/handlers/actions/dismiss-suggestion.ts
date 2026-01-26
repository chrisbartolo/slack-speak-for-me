import type { App } from '@slack/bolt';
import { logger } from '../../utils/logger.js';

/**
 * Handle "Dismiss" button click.
 *
 * Simply removes the ephemeral message by replacing with minimal content.
 */
export function registerDismissSuggestionAction(app: App): void {
  app.action('dismiss_suggestion', async ({ ack, body, respond }) => {
    await ack();

    // Extract suggestion ID from button value
    const actionBody = body as { actions: Array<{ value?: string }> };
    const suggestionId = actionBody.actions[0]?.value;

    logger.info({
      suggestionId,
      userId: 'user' in body ? body.user.id : 'unknown',
    }, 'Suggestion dismissed');

    // Replace with minimal message that confirms dismissal
    await respond({
      response_type: 'ephemeral',
      replace_original: true,
      delete_original: true,
      text: 'Suggestion dismissed.',
    });
  });
}
