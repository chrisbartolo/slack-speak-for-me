import type { App } from '@slack/bolt';
import { watchConversation, unwatchConversation, isWatching, getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';

/**
 * Register /watch and /unwatch slash commands
 *
 * /watch: Enable AI suggestions for the current conversation
 * /unwatch: Disable AI suggestions for the current conversation
 *
 * Both commands respond with ephemeral messages confirming the action
 */
export function registerWatchCommands(app: App): void {
  // /watch command - enable AI suggestions for this conversation
  app.command('/watch', async ({ command, ack, respond, client }) => {
    try {
      // Acknowledge command immediately (3-second requirement)
      await ack();

      const { team_id, user_id, channel_id } = command;

      // Look up internal workspace ID from Slack team ID
      const workspaceId = await getWorkspaceId(team_id);
      if (!workspaceId) {
        await respond({
          text: '❌ Workspace not found. Please reinstall the app.',
          response_type: 'ephemeral',
        });
        return;
      }

      // Check if already watching
      const alreadyWatching = await isWatching(workspaceId, user_id, channel_id);

      if (alreadyWatching) {
        await respond({
          text: '👀 You\'re already watching this conversation. You\'ll continue receiving AI suggestions here.',
          response_type: 'ephemeral',
        });
        return;
      }

      // Get channel info for display name and type
      let channelName: string | undefined;
      let channelType: string | undefined;
      try {
        const channelInfo = await client.conversations.info({ channel: channel_id });
        if (channelInfo.channel) {
          channelName = channelInfo.channel.name;
          channelType = channelInfo.channel.is_im ? 'im' :
                        channelInfo.channel.is_mpim ? 'mpim' :
                        channelInfo.channel.is_private ? 'group' : 'channel';
        }
      } catch (e) {
        // Proceed without name if API fails (e.g., bot not in channel)
        logger.warn({ error: e, channel: channel_id }, 'Failed to get channel info');
      }

      // Add watch with channel info
      await watchConversation(workspaceId, user_id, channel_id, channelName, channelType);

      await respond({
        text: '✅ Now watching this conversation. You\'ll receive AI suggestions when someone responds to your messages here.',
        response_type: 'ephemeral',
      });

      logger.info({
        workspaceId,
        teamId: team_id,
        userId: user_id,
        channelId: channel_id,
        channelName,
        channelType,
      }, 'User enabled watch for conversation');

    } catch (error) {
      logger.error({ error, command: '/watch' }, 'Failed to process /watch command');

      // Try to respond with error message
      try {
        await respond({
          text: '❌ Failed to watch this conversation. Please try again.',
          response_type: 'ephemeral',
        });
      } catch (respondError) {
        logger.error({ error: respondError }, 'Failed to send error response');
      }
    }
  });

  // /unwatch command - disable AI suggestions for this conversation
  app.command('/unwatch', async ({ command, ack, respond }) => {
    try {
      // Acknowledge command immediately (3-second requirement)
      await ack();

      const { team_id, user_id, channel_id } = command;

      // Look up internal workspace ID from Slack team ID
      const workspaceId = await getWorkspaceId(team_id);
      if (!workspaceId) {
        await respond({
          text: '❌ Workspace not found. Please reinstall the app.',
          response_type: 'ephemeral',
        });
        return;
      }

      // Check if currently watching
      const currentlyWatching = await isWatching(workspaceId, user_id, channel_id);

      if (!currentlyWatching) {
        await respond({
          text: '👁️ You\'re not watching this conversation. No changes made.',
          response_type: 'ephemeral',
        });
        return;
      }

      // Remove watch
      await unwatchConversation(workspaceId, user_id, channel_id);

      await respond({
        text: '🔕 Stopped watching this conversation. You won\'t receive AI suggestions here anymore.',
        response_type: 'ephemeral',
      });

      logger.info({
        workspaceId,
        teamId: team_id,
        userId: user_id,
        channelId: channel_id,
      }, 'User disabled watch for conversation');

    } catch (error) {
      logger.error({ error, command: '/unwatch' }, 'Failed to process /unwatch command');

      // Try to respond with error message
      try {
        await respond({
          text: '❌ Failed to unwatch this conversation. Please try again.',
          response_type: 'ephemeral',
        });
      } catch (respondError) {
        logger.error({ error: respondError }, 'Failed to send error response');
      }
    }
  });
}
