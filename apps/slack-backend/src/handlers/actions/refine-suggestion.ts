import type { App } from '@slack/bolt';
import { getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';

/**
 * Register handler for 'refine_suggestion' button action
 * Opens modal to allow user to refine the suggestion
 */
export function registerRefineSuggestionAction(app: App): void {
  app.action(
    'refine_suggestion',
    async ({ ack, body, client }) => {
      await ack();

      try {
        // Extract suggestionId and suggestion from action value (JSON)
        const actionBody = body as { actions: Array<{ value?: string }> };
        const actionValue = actionBody.actions[0]?.value || '{}';

        let suggestionId = '';
        let currentSuggestion = '';

        try {
          const parsed = JSON.parse(actionValue);
          suggestionId = parsed.suggestionId || '';
          currentSuggestion = parsed.suggestion || '';
        } catch {
          logger.error({ actionValue }, 'Failed to parse refine action value');
          return;
        }

        if (!currentSuggestion) {
          logger.error('No suggestion in refine action value');
          return;
        }

        // Extract team ID, user ID, channel ID, and trigger_id from body
        const teamId = 'team' in body && body.team ? (body.team as { id: string }).id : '';
        const userId = 'user' in body && body.user ? (body.user as { id: string }).id : '';
        const triggerId = 'trigger_id' in body ? body.trigger_id : '';

        // Get channel ID and thread_ts from container (for ephemeral messages)
        const container = 'container' in body ? body.container as { channel_id?: string; message_ts?: string; thread_ts?: string } : null;
        const channelId = ('channel' in body && body.channel ? (body.channel as { id: string }).id : null) || container?.channel_id || '';
        const threadTs = container?.thread_ts;

        if (!triggerId) {
          logger.error('trigger_id not found in action body');
          return;
        }

        // Convert Slack team ID to internal workspace UUID
        const internalWorkspaceId = teamId ? await getWorkspaceId(teamId) : null;
        if (!internalWorkspaceId) {
          logger.error({ teamId }, 'Workspace not found for refine action');
          return;
        }

        // Truncate suggestion if too long for metadata (max 3000 chars total)
        const maxSuggestionLength = 2500;
        const truncatedSuggestion = currentSuggestion.length > maxSuggestionLength
          ? currentSuggestion.substring(0, maxSuggestionLength) + '...'
          : currentSuggestion;

        // Store state in private_metadata (JSON stringified, up to 3000 chars)
        const metadata = {
          workspaceId: internalWorkspaceId,
          userId,
          channelId,
          threadTs,
          suggestionId,
          currentSuggestion: truncatedSuggestion,
          history: [],
        };

        logger.info({ triggerId, suggestionId, metadataLength: JSON.stringify(metadata).length }, 'Opening refinement modal');

        // Open refinement modal
        await client.views.open({
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
      } catch (error: any) {
        logger.error({
          error: error?.message || error,
          code: error?.code,
          data: error?.data,
        }, 'Failed to open refinement modal');
      }
    }
  );
}
