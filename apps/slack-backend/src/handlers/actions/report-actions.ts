import type { App } from '@slack/bolt';
import { logger } from '../../utils/logger.js';

/**
 * Register action handlers for report buttons
 */
export function registerReportActionHandlers(app: App): void {
  // Copy Report button - shows copyable text
  app.action('report_copy', async ({ action, ack, client, body }) => {
    await ack();

    try {
      const actionValue = (action as any).value;
      const { report } = JSON.parse(actionValue);

      // Open modal with copyable report text
      await client.views.open({
        trigger_id: (body as any).trigger_id,
        view: {
          type: 'modal',
          title: {
            type: 'plain_text',
            text: 'Copy Report',
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
                text: 'Triple-click to select all text, then copy:',
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '```' + report + '```',
              },
            },
          ],
        },
      });
    } catch (error) {
      logger.error({ error, action: 'report_copy' }, 'Failed to open copy modal');
    }
  });

  // Refine Report button - opens refinement modal
  app.action('report_refine', async ({ action, ack, client, body }) => {
    await ack();

    try {
      const actionValue = (action as any).value;
      const { report } = JSON.parse(actionValue);
      const userId = (body as any).user?.id;

      // Store initial report in private_metadata
      const privateMetadata = JSON.stringify({
        currentReport: report,
        history: [],
      });

      await client.views.open({
        trigger_id: (body as any).trigger_id,
        view: {
          type: 'modal',
          callback_id: 'report_refinement_submit',
          private_metadata: privateMetadata,
          title: {
            type: 'plain_text',
            text: 'Refine Report',
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
                text: '*Current Report:*',
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: report.substring(0, 2900), // Slack limit
              },
            },
            {
              type: 'divider',
            },
            {
              type: 'input',
              block_id: 'feedback_block',
              element: {
                type: 'plain_text_input',
                action_id: 'feedback_input',
                multiline: true,
                placeholder: {
                  type: 'plain_text',
                  text: 'How would you like to change the report? (e.g., "Make it more concise", "Add more detail to blockers", "Reorganize for executive audience")',
                },
              },
              label: {
                type: 'plain_text',
                text: 'Your Feedback',
              },
            },
          ],
        },
      });

      logger.info({ userId }, 'Opened report refinement modal');
    } catch (error) {
      logger.error({ error, action: 'report_refine' }, 'Failed to open refinement modal');
    }
  });
}
