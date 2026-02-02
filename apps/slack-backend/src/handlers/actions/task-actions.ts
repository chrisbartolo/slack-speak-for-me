import type { App, BlockAction, OverflowAction } from '@slack/bolt';
import { getWorkspaceId } from '../../services/watch.js';
import { updateActionableStatus, getActionableById } from '../../services/actionables.js';
import { logger } from '../../utils/logger.js';

export function registerTaskActionHandlers(app: App): void {
  // Handle overflow menu actions from /tasks command
  app.action<BlockAction<OverflowAction>>(
    /^task_actions_/,
    async ({ action, ack, body, respond }) => {
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
          const success = await updateActionableStatus(
            workspaceId,
            userId,
            taskId,
            'completed'
          );

          if (success) {
            await respond({
              text: ':white_check_mark: Task marked as complete!',
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

          // Get the permalink
          // Note: We need to use the app's client, which isn't directly available here
          // For now, construct the URL manually
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
