import type { App } from '@slack/bolt';
import { refineSuggestion } from '../../services/index.js';
import { logger } from '../../utils/logger.js';

interface RefinementMetadata {
  workspaceId: string;
  userId: string;
  suggestionId: string;
  currentSuggestion: string;
  history: Array<{
    suggestion: string;
    refinementRequest?: string;
  }>;
}

const MAX_METADATA_SIZE = 2800; // Leave buffer under 3000 char limit

/**
 * Truncate history if it approaches metadata size limit
 */
function truncateHistory(metadata: RefinementMetadata): RefinementMetadata {
  const metadataStr = JSON.stringify(metadata);

  if (metadataStr.length <= MAX_METADATA_SIZE) {
    return metadata;
  }

  // Remove oldest history entries until under limit
  const truncated = { ...metadata };
  while (JSON.stringify(truncated).length > MAX_METADATA_SIZE && truncated.history.length > 0) {
    truncated.history.shift(); // Remove oldest entry
  }

  logger.info({
    originalHistoryLength: metadata.history.length,
    truncatedHistoryLength: truncated.history.length,
  }, 'Truncated refinement history');

  return truncated;
}

/**
 * Register handler for refinement modal submission
 * Calls AI to refine suggestion and updates modal with result
 */
export function registerRefinementModalHandler(app: App): void {
  app.view(
    'refinement_modal',
    async ({ ack, body, view, context }) => {
      // Parse metadata
      const metadata: RefinementMetadata = JSON.parse(view.private_metadata || '{}');

      // Get refinement request from input
      const refinementText = view.state.values.refinement_input?.refinement_text?.value || '';

      if (!refinementText.trim()) {
        await ack({
          response_action: 'errors',
          errors: {
            refinement_input: 'Please enter a refinement request',
          },
        });
        return;
      }

      // Acknowledge immediately - we'll update the view
      await ack({
        response_action: 'update',
        view: {
          type: 'modal',
          callback_id: 'refinement_modal',
          private_metadata: view.private_metadata,
          title: {
            type: 'plain_text',
            text: 'Refining...',
          },
          close: {
            type: 'plain_text',
            text: 'Close',
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ':hourglass_flowing_sand: Generating refined suggestion...',
              },
            },
          ],
        },
      });

      try {
        // Call AI refinement service
        const result = await refineSuggestion({
          workspaceId: metadata.workspaceId,
          userId: metadata.userId,
          suggestionId: metadata.suggestionId,
          originalSuggestion: metadata.currentSuggestion,
          refinementRequest: refinementText,
          history: metadata.history,
        });

        logger.info({
          suggestionId: metadata.suggestionId,
          roundNumber: metadata.history.length + 1,
          processingTimeMs: result.processingTimeMs,
        }, 'Refinement generated');

        // Update history
        const updatedHistory = [
          ...metadata.history,
          {
            suggestion: metadata.currentSuggestion,
            refinementRequest: refinementText,
          },
        ];

        // Update metadata with new suggestion and history
        const updatedMetadata = truncateHistory({
          workspaceId: metadata.workspaceId,
          userId: metadata.userId,
          suggestionId: metadata.suggestionId,
          currentSuggestion: result.suggestion,
          history: updatedHistory,
        });

        // Update modal with refined suggestion
        await context.client.views.update({
          view_id: body.view.id,
          view: {
            type: 'modal',
            callback_id: 'refinement_modal',
            private_metadata: JSON.stringify(updatedMetadata),
            title: {
              type: 'plain_text',
              text: 'Refine Suggestion',
            },
            submit: {
              type: 'plain_text',
              text: 'Refine More',
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
                  text: '*Refined suggestion:*',
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: result.suggestion,
                },
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: '✅ Copy Final',
                      emoji: true,
                    },
                    action_id: 'copy_final_suggestion',
                    value: metadata.suggestionId,
                    style: 'primary',
                  },
                ],
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `_Round ${updatedHistory.length + 1} • Click "Refine More" to adjust further, or "Copy Final" to use this suggestion_`,
                  },
                ],
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
                  text: 'Further refinement (optional):',
                },
                optional: true,
              },
            ],
          },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to generate refinement');

        // Update modal with error
        await context.client.views.update({
          view_id: body.view.id,
          view: {
            type: 'modal',
            callback_id: 'refinement_modal',
            private_metadata: view.private_metadata,
            title: {
              type: 'plain_text',
              text: 'Error',
            },
            close: {
              type: 'plain_text',
              text: 'Close',
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: ':x: Failed to generate refinement. Please try again.',
                },
              },
            ],
          },
        });
      }
    }
  );
}
