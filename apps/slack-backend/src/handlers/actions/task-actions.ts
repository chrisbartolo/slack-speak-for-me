import type { App, BlockAction, OverflowAction } from '@slack/bolt';
import { getWorkspaceId } from '../../services/watch.js';
import { updateActionableStatus, getActionableById } from '../../services/actionables.js';
import { logger } from '../../utils/logger.js';

export function registerTaskActionHandlers(app: App): void {
  // Handle overflow menu actions from /tasks command
  app.action<BlockAction<OverflowAction>>(
    /^task_actions_/,
    async ({ action, ack, body, respond, client }) => {
      await ack();

      const selectedValue = action.selected_option?.value;
      if (!selectedValue) {
        return;
      }

      // Get workspace ID
      const teamId = body.team?.id;
      if (!teamId) {
        logger.error('No team ID in task action body');
        return;
      }

      const workspaceId = await getWorkspaceId(teamId);
      if (!workspaceId) {
        await respond({
          text: ':x: Workspace not found.',
          response_type: 'ephemeral',
          replace_original: false,
        });
        return;
      }

      const userId = body.user.id;

      try {
        // Parse action: complete_<id>, snooze_1d_<id>, dismiss_<id>, view_<channel>_<ts>
        if (selectedValue.startsWith('complete_')) {
          const taskId = selectedValue.replace('complete_', '');

          // Fetch task details to show in modal
          const task = await getActionableById(workspaceId, userId, taskId);
          if (!task) {
            await respond({
              text: ':x: Task not found.',
              response_type: 'ephemeral',
              replace_original: false,
            });
            return;
          }

          // Open completion modal with note field
          const triggerId = body.trigger_id;
          if (!triggerId) {
            // Fallback: complete without modal if no trigger_id
            await updateActionableStatus(workspaceId, userId, taskId, 'completed');
            await respond({
              text: ':white_check_mark: Task marked as complete!',
              response_type: 'ephemeral',
              replace_original: false,
            });
            return;
          }

          const privateMetadata = JSON.stringify({
            taskId: task.id,
            workspaceId,
            userId,
            channelId: task.channelId,
            messageTs: task.messageTs,
            threadTs: task.threadTs,
            messageText: (task.messageText || '').slice(0, 500),
            taskTitle: task.title,
            taskDescription: (task.description || '').slice(0, 500),
            actionableType: task.actionableType,
          });

          const truncatedMessage = task.messageText
            ? task.messageText.length > 200
              ? task.messageText.slice(0, 200) + '...'
              : task.messageText
            : 'No message text';

          await client.views.open({
            trigger_id: triggerId,
            view: {
              type: 'modal',
              callback_id: 'task_completion_modal',
              title: {
                type: 'plain_text',
                text: 'Complete Task',
              },
              submit: {
                type: 'plain_text',
                text: 'Complete',
              },
              close: {
                type: 'plain_text',
                text: 'Cancel',
              },
              private_metadata: privateMetadata,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*${task.title}*`,
                  },
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: `_Original message:_ ${truncatedMessage}`,
                    },
                  ],
                },
                {
                  type: 'divider',
                },
                {
                  type: 'input',
                  block_id: 'completion_note_block',
                  optional: true,
                  element: {
                    type: 'plain_text_input',
                    action_id: 'completion_note',
                    multiline: true,
                    placeholder: {
                      type: 'plain_text',
                      text: 'e.g., Deployed the fix to staging',
                    },
                  },
                  label: {
                    type: 'plain_text',
                    text: 'Add a note (optional)',
                  },
                  hint: {
                    type: 'plain_text',
                    text: 'This will be incorporated into the reply posted in the thread',
                  },
                },
                {
                  type: 'input',
                  block_id: 'reply_in_thread_block',
                  optional: true,
                  element: {
                    type: 'checkboxes',
                    action_id: 'reply_in_thread',
                    initial_options: [
                      {
                        text: {
                          type: 'plain_text',
                          text: 'Reply in the original Slack thread',
                        },
                        value: 'reply',
                      },
                    ],
                    options: [
                      {
                        text: {
                          type: 'plain_text',
                          text: 'Reply in the original Slack thread',
                        },
                        description: {
                          type: 'plain_text',
                          text: 'A message in your voice will be posted in the thread',
                        },
                        value: 'reply',
                      },
                    ],
                  },
                  label: {
                    type: 'plain_text',
                    text: 'Notification',
                  },
                },
              ],
            },
          });
        } else if (selectedValue.startsWith('snooze_1d_')) {
          const taskId = selectedValue.replace('snooze_1d_', '');
          const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const success = await updateActionableStatus(
            workspaceId,
            userId,
            taskId,
            'snoozed',
            snoozedUntil
          );

          if (success) {
            await respond({
              text: ':zzz: Task snoozed for 1 day.',
              response_type: 'ephemeral',
              replace_original: false,
            });
          } else {
            await respond({
              text: ':x: Task not found.',
              response_type: 'ephemeral',
              replace_original: false,
            });
          }
        } else if (selectedValue.startsWith('dismiss_')) {
          const taskId = selectedValue.replace('dismiss_', '');
          const success = await updateActionableStatus(
            workspaceId,
            userId,
            taskId,
            'dismissed'
          );

          if (success) {
            await respond({
              text: ':x: Task dismissed.',
              response_type: 'ephemeral',
              replace_original: false,
            });
          } else {
            await respond({
              text: ':x: Task not found.',
              response_type: 'ephemeral',
              replace_original: false,
            });
          }
        } else if (selectedValue.startsWith('view_')) {
          // Parse channel and message timestamp
          const parts = selectedValue.replace('view_', '').split('_');
          const channelId = parts[0];
          const messageTs = parts.slice(1).join('_'); // Handle ts with underscores

          await respond({
            text: `:link: <slack://channel?team=${teamId}&id=${channelId}&message=${messageTs}|View original message>`,
            response_type: 'ephemeral',
            replace_original: false,
          });
        }

        logger.info(
          {
            workspaceId,
            userId,
            action: selectedValue,
          },
          'Task action processed'
        );
      } catch (error) {
        logger.error({ error, action: selectedValue }, 'Failed to process task action');
        await respond({
          text: ':x: Failed to process action. Please try again.',
          response_type: 'ephemeral',
          replace_original: false,
        });
      }
    }
  );
}
