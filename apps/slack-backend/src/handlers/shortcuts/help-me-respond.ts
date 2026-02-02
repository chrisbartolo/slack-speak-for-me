import type { App, MessageShortcut } from '@slack/bolt';
import { queueAIResponse } from '../../jobs/queues.js';
import { getContextForMessage } from '../../services/context.js';
import { getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';

/**
 * Register "Help me respond" message shortcut.
 *
 * This shortcut appears when users right-click on any message.
 * It triggers AI suggestion generation for any message, regardless of watch status.
 *
 * The shortcut callback_id must match the one configured in the Slack App settings.
 */
export function registerHelpMeRespondShortcut(app: App): void {
  app.shortcut('help_me_respond', async ({ shortcut, ack, client, context }) => {
    await ack();

    const messageShortcut = shortcut as MessageShortcut;

    logger.info({
      user: messageShortcut.user.id,
      channel: messageShortcut.channel.id,
      messageTs: messageShortcut.message.ts,
    }, 'Help me respond shortcut triggered');

    const teamId = context.teamId;
    if (!teamId) {
      logger.warn({ shortcut }, 'No team ID in context');
      // Can't respond without team context
      return;
    }

    // Get message text from the shortcut payload
    const messageText = messageShortcut.message.text || '';
    const channelId = messageShortcut.channel.id;
    const messageTs = messageShortcut.message.ts;
    const userId = messageShortcut.user.id;

    // Determine thread context
    const threadTs = 'thread_ts' in messageShortcut.message
      ? (messageShortcut.message as { thread_ts?: string }).thread_ts
      : undefined;

    try {
      // Look up internal workspace ID from Slack team ID
      const workspaceId = await getWorkspaceId(teamId);
      if (!workspaceId) {
        logger.error({ teamId }, 'Workspace not found for team ID');
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: 'Workspace not found. Please reinstall the app.',
        });
        return;
      }

      // Fetch conversation context
      const contextMessages = await getContextForMessage(
        client,
        channelId,
        messageTs,
        threadTs
      );

      // Queue AI response job
      await queueAIResponse({
        workspaceId,
        userId,
        channelId,
        messageTs,
        threadTs, // Pass thread timestamp for YOLO mode
        triggerMessageText: messageText,
        contextMessages,
        triggeredBy: 'message_action',
      });

      logger.info({
        channel: channelId,
        user: userId,
        messageTs,
        jobQueued: true,
      }, 'AI response job queued for message shortcut');

      // Send immediate acknowledgment to user
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: 'Got it! Generating a suggested response for you...',
      });
    } catch (error) {
      logger.error({ error, userId, channelId }, 'Error processing help me respond shortcut');

      // Send error message to user
      try {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: 'Sorry, something went wrong. Please try again.',
        });
      } catch {
        // Ignore ephemeral send failure
      }
    }
  });
}
