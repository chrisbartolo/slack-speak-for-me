import type { App } from '@slack/bolt';
import { trackFeedback } from '../../services/feedback-tracker.js';
import { getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';

/**
 * Register the ai_feedback action handler for thumbs up/down on assistant suggestions.
 */
export function registerFeedbackAction(app: App): void {
  app.action('ai_feedback', async ({ ack, body }) => {
    await ack();

    try {
      const actionBody = body as {
        actions: Array<{ value?: string }>;
        user: { id: string };
        team?: { id: string };
      };

      const value = actionBody.actions[0]?.value;
      if (!value) return;

      const { suggestionId, feedback } = JSON.parse(value);
      const userId = actionBody.user.id;
      const teamId = actionBody.team?.id;

      if (!teamId) {
        logger.warn({ body }, 'No team ID in feedback action');
        return;
      }

      const workspaceId = await getWorkspaceId(teamId);
      if (!workspaceId) {
        logger.warn({ teamId }, 'Workspace not found for feedback');
        return;
      }

      await trackFeedback({
        workspaceId,
        userId,
        suggestionId,
        action: feedback === 'positive' ? 'liked' : 'disliked',
      });

      logger.info({ suggestionId, feedback, userId }, 'AI feedback tracked');
    } catch (error) {
      logger.error({ error }, 'Error handling ai_feedback action');
    }
  });
}
