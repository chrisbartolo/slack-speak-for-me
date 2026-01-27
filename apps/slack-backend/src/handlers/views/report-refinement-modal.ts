import type { App } from '@slack/bolt';
import { refineReport } from '../../services/report-generator.js';
import { logger } from '../../utils/logger.js';

interface ReportRefinementMetadata {
  currentReport: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Register view handler for report refinement modal
 */
export function registerReportRefinementViewHandler(app: App): void {
  app.view('report_refinement_submit', async ({ ack, view, client, body }) => {
    const userId = body.user.id;

    // Get feedback from input
    const feedback = view.state.values.feedback_block?.feedback_input?.value || '';

    if (!feedback.trim()) {
      await ack({
        response_action: 'errors',
        errors: {
          feedback_block: 'Please provide feedback on how to refine the report',
        },
      });
      return;
    }

    // Acknowledge and update to loading state
    await ack({
      response_action: 'update',
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'Refining Report...',
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'AI is refining your report based on your feedback...',
            },
          },
        ],
      },
    });

    try {
      // Parse metadata
      const metadata: ReportRefinementMetadata = JSON.parse(view.private_metadata || '{}');
      const { currentReport, history } = metadata;

      // Refine the report
      const result = await refineReport({
        currentReport,
        feedback,
        history,
      });

      // Update history for next refinement round
      const updatedHistory = [
        ...history,
        { role: 'user' as const, content: `Current report:\n${currentReport}\n\nFeedback: ${feedback}` },
        { role: 'assistant' as const, content: result.refinedReport },
      ];

      // Truncate history if too long
      const maxHistoryLength = 2000;
      let historyStr = JSON.stringify(updatedHistory);
      while (historyStr.length > maxHistoryLength && updatedHistory.length > 2) {
        updatedHistory.splice(0, 2); // Remove oldest exchange
        historyStr = JSON.stringify(updatedHistory);
      }

      const newMetadata: ReportRefinementMetadata = {
        currentReport: result.refinedReport,
        history: updatedHistory,
      };

      // Update modal with refined report
      await client.views.update({
        view_id: view.id,
        view: {
          type: 'modal',
          callback_id: 'report_refinement_submit',
          private_metadata: JSON.stringify(newMetadata),
          title: {
            type: 'plain_text',
            text: 'Refined Report',
          },
          submit: {
            type: 'plain_text',
            text: 'Refine More',
          },
          close: {
            type: 'plain_text',
            text: 'Done',
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Refined Report:*',
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: result.refinedReport.substring(0, 2900),
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Copy Report',
                  },
                  action_id: 'report_copy_from_modal',
                  value: JSON.stringify({ report: result.refinedReport.substring(0, 2000) }),
                },
              ],
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
                  text: 'Want more changes? Describe them here...',
                },
              },
              label: {
                type: 'plain_text',
                text: 'Additional Feedback (optional)',
              },
              optional: true,
            },
          ],
        },
      });

      logger.info({
        userId,
        processingTimeMs: result.processingTimeMs,
        historyLength: updatedHistory.length,
      }, 'Report refined successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to refine report');

      await client.views.update({
        view_id: view.id,
        view: {
          type: 'modal',
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
                text: 'Failed to refine report. Please try again.',
              },
            },
          ],
        },
      });
    }
  });

  // Handle copy button from within refinement modal
  app.action('report_copy_from_modal', async ({ action, ack, client, body }) => {
    await ack();

    try {
      const actionValue = (action as any).value;
      const { report } = JSON.parse(actionValue);

      // Update current modal to show copyable text
      await client.views.update({
        view_id: (body as any).view?.id,
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
      logger.error({ error }, 'Failed to show copy modal');
    }
  });
}
