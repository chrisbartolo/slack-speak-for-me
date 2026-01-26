import type { App, BlockAction, SlackActionMiddlewareArgs } from '@slack/bolt';
import { logger } from '../../utils/logger.js';

/**
 * Register handler for 'copy_final_suggestion' button action
 * Closes modal and logs completion
 */
export function registerCopyFinalSuggestionAction(app: App): void {
  app.action<BlockAction>(
    'copy_final_suggestion',
    async ({ ack, body }: SlackActionMiddlewareArgs<BlockAction>) => {
      await ack();

      try {
        // User will manually copy the text from the modal
        // This action just provides feedback that they're done refining
        logger.info({
          userId: body.user.id,
        }, 'User selected final refined suggestion');

        // Note: Modal will stay open so user can copy the text
        // They'll close it themselves when done
      } catch (error) {
        logger.error({ error }, 'Error handling copy final suggestion action');
      }
    }
  );
}
