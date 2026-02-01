import type { App } from '@slack/bolt';
import { trackDismissal } from '../../services/feedback-tracker.js';
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
    const suggestionId = actionBody.actions[0]?.value || '';

    const userId = 'user' in body ? body.user.id : '';
    const workspaceId = 'team' in body && body.team ? (body.team as { id: string }).id : '';
    const channelId = 'channel' in body && body.channel ? (body.channel as { id: string }).id : undefined;

    logger.info({
      suggestionId,
      userId,
    }, 'Suggestion dismissed');

    // Track dismissal feedback
    await trackDismissal(
      workspaceId,
      userId,
      suggestionId,
      undefined, // Don't need to store text for dismissals
      channelId
    );

    // Replace with minimal message that confirms dismissal
    await respond({
      response_type: 'ephemeral',
      replace_original: true,
      delete_original: true,
      text: 'Suggestion dismissed.',
    });
  });
}
