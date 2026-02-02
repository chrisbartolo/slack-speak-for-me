import type { App } from '@slack/bolt';
import { getWorkspaceId } from '../../services/watch.js';
import { getPendingActionables } from '../../services/actionables.js';
import { logger } from '../../utils/logger.js';
import { formatDistanceToNow, format } from 'date-fns';

const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || 'http://localhost:3001';

export function registerTasksCommand(app: App): void {
  app.command('/tasks', async ({ command, ack, respond }) => {
    try {
      // Acknowledge immediately (3-second requirement)
      await ack();

      const { team_id, user_id } = command;

      // Look up internal workspace ID
      const workspaceId = await getWorkspaceId(team_id);
      if (!workspaceId) {
        await respond({
          text: ':x: Workspace not found. Please reinstall the app.',
          response_type: 'ephemeral',
        });
        return;
      }

      // Get pending actionables
      const actionables = await getPendingActionables(workspaceId, user_id);

      if (actionables.length === 0) {
        await respond({
          text: ':white_check_mark: You have no pending tasks!',
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ':white_check_mark: *No pending tasks*\n\nWe\'re monitoring your watched conversations for actionable items. Tasks will appear here when detected.',
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `<${WEB_PORTAL_URL}/dashboard/tasks|View all tasks in dashboard>`,
                },
              ],
            },
          ],
        });
        return;
      }

      // Group by urgency
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const overdue = actionables.filter((a) => a.dueDate && a.dueDate < now);
      const dueToday = actionables.filter((a) => {
        if (!a.dueDate) return false;
        return a.dueDate >= today && a.dueDate < tomorrow;
      });
      const other = actionables.filter(
        (a) => !overdue.includes(a) && !dueToday.includes(a)
      );

      // Build blocks for task list
      const blocks: Array<{
        type: string;
        text?: { type: string; text: string; emoji?: boolean };
        accessory?: object;
        elements?: object[];
      }> = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `:clipboard: Your Tasks (${actionables.length})`,
            emoji: true,
          },
        },
      ];

      // Helper to get type emoji
      const getTypeEmoji = (type: string) => {
        switch (type) {
          case 'action_request':
            return ':pushpin:';
          case 'commitment':
            return ':handshake:';
          case 'deadline':
            return ':clock3:';
          default:
            return ':memo:';
        }
      };

      // Helper to format task block
      const formatTaskBlock = (
        task: (typeof actionables)[0],
        urgent = false
      ) => {
        const typeEmoji = getTypeEmoji(task.actionableType);

        const dueText = task.dueDate
          ? `Due: ${format(task.dueDate, 'MMM d')} (${formatDistanceToNow(task.dueDate, { addSuffix: true })})`
          : 'No due date';

        return {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${urgent ? ':warning: ' : ''}${typeEmoji} *${task.title}*\n${task.description || ''}\n_${dueText}_`,
          },
          accessory: {
            type: 'overflow',
            action_id: `task_actions_${task.id}`,
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: ':white_check_mark: Complete',
                  emoji: true,
                },
                value: `complete_${task.id}`,
              },
              {
                text: {
                  type: 'plain_text',
                  text: ':zzz: Snooze 1 day',
                  emoji: true,
                },
                value: `snooze_1d_${task.id}`,
              },
              {
                text: { type: 'plain_text', text: ':x: Dismiss', emoji: true },
                value: `dismiss_${task.id}`,
              },
              {
                text: {
                  type: 'plain_text',
                  text: ':link: View in Slack',
                  emoji: true,
                },
                value: `view_${task.channelId}_${task.messageTs}`,
              },
            ],
          },
        };
      };

      // Add overdue section
      if (overdue.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*:rotating_light: Overdue (${overdue.length})*`,
          },
        });
        overdue.slice(0, 3).forEach((task) => blocks.push(formatTaskBlock(task, true)));
        if (overdue.length > 3) {
          blocks.push({
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `_...and ${overdue.length - 3} more overdue_`,
              },
            ],
          });
        }
      }

      // Add due today section
      if (dueToday.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*:calendar: Due Today (${dueToday.length})*`,
          },
        });
        dueToday.slice(0, 3).forEach((task) => blocks.push(formatTaskBlock(task)));
        if (dueToday.length > 3) {
          blocks.push({
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `_...and ${dueToday.length - 3} more due today_`,
              },
            ],
          });
        }
      }

      // Add other tasks
      if (other.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*:inbox_tray: Other Tasks (${other.length})*`,
          },
        });
        other.slice(0, 5).forEach((task) => blocks.push(formatTaskBlock(task)));
        if (other.length > 5) {
          blocks.push({
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `_...and ${other.length - 5} more tasks_`,
              },
            ],
          });
        }
      }

      // Add footer
      blocks.push(
        { type: 'divider' } as { type: string },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `<${WEB_PORTAL_URL}/dashboard/tasks|:bar_chart: View all tasks in dashboard>`,
            },
          ],
        }
      );

      await respond({
        response_type: 'ephemeral',
        blocks,
      });

      logger.info(
        {
          workspaceId,
          userId: user_id,
          taskCount: actionables.length,
        },
        'Tasks command executed'
      );
    } catch (error) {
      logger.error({ error, command: '/tasks' }, 'Failed to process /tasks command');

      try {
        await respond({
          text: ':x: Failed to fetch tasks. Please try again.',
          response_type: 'ephemeral',
        });
      } catch (respondError) {
        logger.error({ error: respondError }, 'Failed to send error response');
      }
    }
  });
}
