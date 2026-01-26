import type { App } from '@slack/bolt';
import { logger } from '../../utils/logger.js';

/**
 * Register handler for 'refine_suggestion' button action
 * Opens modal to allow user to refine the suggestion
 */
export function registerRefineSuggestionAction(app: App): void {
  app.action(
    'refine_suggestion',
    async ({ ack, body, context }) => {
      await ack();

      try {
        // Extract suggestion from button value (suggestionId was passed)
        // We need to get the suggestion text from the message blocks
        const message = 'message' in body ? body.message : undefined;
        if (!message || !('blocks' in message)) {
          logger.error('Message blocks not found for refine action');
          return;
        }

        // Find the section block with the suggestion text
        const suggestionBlock = message.blocks?.find(
          (block: any) =>
            block.type === 'section' && 'text' in block
        );

        const currentSuggestion = suggestionBlock?.text?.text || '';

        // Extract suggestionId from action value
        const actionBody = body as { actions: Array<{ value?: string }> };
        const suggestionId = actionBody.actions[0]?.value || '';

        // Store state in private_metadata (JSON stringified, up to 3000 chars)
        const metadata = {
          suggestionId,
          currentSuggestion,
          history: [],
        };

        // Get trigger_id from body
        const triggerId = 'trigger_id' in body ? body.trigger_id : '';
        if (!triggerId) {
          logger.error('trigger_id not found in action body');
          return;
        }

        // Open refinement modal using context.client
        await context.client.views.open({
          trigger_id: triggerId,
          view: {
            type: 'modal',
            callback_id: 'refinement_modal',
            private_metadata: JSON.stringify(metadata),
            title: {
              type: 'plain_text',
              text: 'Refine Suggestion',
            },
            submit: {
              type: 'plain_text',
              text: 'Refine',
            },
            close: {
              type: 'plain_text',
              text: 'Cancel',
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '*Current suggestion:*',
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: currentSuggestion || '_No suggestion text available_',
                },
              },
              {
                type: 'divider',
              },
              {
                type: 'input',
                block_id: 'refinement_input',
                element: {
                  type: 'plain_text_input',
                  action_id: 'refinement_text',
                  multiline: true,
                  placeholder: {
                    type: 'plain_text',
                    text: 'e.g., "Make it shorter", "More formal", "Add a question"',
                  },
                },
                label: {
                  type: 'plain_text',
                  text: 'How would you like to refine this?',
                },
              },
            ],
          },
        });

        logger.info({ suggestionId }, 'Refinement modal opened');
      } catch (error) {
        logger.error({ error }, 'Failed to open refinement modal');
      }
    }
  );
}
