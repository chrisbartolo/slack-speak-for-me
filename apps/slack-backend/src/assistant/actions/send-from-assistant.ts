import type { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { db, installations, decrypt } from '@slack-speak/database';
import { eq } from 'drizzle-orm';
import { getEncryptionKey } from '../../env.js';
import { getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';

/**
 * Register the Send as Me action for assistant panel suggestions.
 * Posts the suggestion to the viewing channel using the user's token.
 */
export function registerAssistantSendAction(app: App): void {
  app.action('assistant_send_suggestion', async ({ ack, body, client }) => {
    await ack();

    const actionBody = body as {
      actions: Array<{ value?: string }>;
      user: { id: string };
      team?: { id: string };
      channel?: { id: string };
      container?: { channel_id: string; thread_ts?: string };
    };

    const value = actionBody.actions[0]?.value;
    if (!value) {
      logger.warn({ body }, 'Assistant send action missing value');
      return;
    }

    // Determine the assistant thread channel for reply messages
    const assistantChannelId = actionBody.channel?.id || actionBody.container?.channel_id;
    const assistantThreadTs = actionBody.container?.thread_ts;

    try {
      const { suggestion, channelId, threadTs } = JSON.parse(value);
      const userId = actionBody.user.id;
      const teamId = actionBody.team?.id;

      if (!teamId) {
        if (assistantChannelId && assistantThreadTs) {
          await client.chat.postMessage({
            channel: assistantChannelId,
            thread_ts: assistantThreadTs,
            text: 'Could not determine workspace.',
          });
        }
        return;
      }

      const workspaceId = await getWorkspaceId(teamId);
      if (!workspaceId) {
        if (assistantChannelId && assistantThreadTs) {
          await client.chat.postMessage({
            channel: assistantChannelId,
            thread_ts: assistantThreadTs,
            text: 'Workspace not found. Please reinstall the app.',
          });
        }
        return;
      }

      if (!channelId) {
        if (assistantChannelId && assistantThreadTs) {
          await client.chat.postMessage({
            channel: assistantChannelId,
            thread_ts: assistantThreadTs,
            text: 'Could not determine which channel to send to. Navigate to a channel first.',
          });
        }
        return;
      }

      // Get user token from installation
      const [installation] = await db
        .select({
          userToken: installations.userToken,
          userId: installations.userId,
        })
        .from(installations)
        .where(eq(installations.workspaceId, workspaceId))
        .limit(1);

      if (!installation?.userToken || installation.userId !== userId) {
        if (assistantChannelId && assistantThreadTs) {
          await client.chat.postMessage({
            channel: assistantChannelId,
            thread_ts: assistantThreadTs,
            text: 'Cannot send as you - please reinstall the app to grant the required permission.',
          });
        }
        return;
      }

      // Decrypt user token and post as user
      const userToken = decrypt(installation.userToken, getEncryptionKey());
      const userClient = new WebClient(userToken);

      await userClient.chat.postMessage({
        channel: channelId,
        text: suggestion,
        thread_ts: threadTs,
      });

      logger.info({ userId, channelId, threadTs }, 'Message sent as user from assistant panel');

      if (assistantChannelId && assistantThreadTs) {
        await client.chat.postMessage({
          channel: assistantChannelId,
          thread_ts: assistantThreadTs,
          text: 'Message sent!',
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error sending message from assistant panel');
      if (assistantChannelId && assistantThreadTs) {
        await client.chat.postMessage({
          channel: assistantChannelId,
          thread_ts: assistantThreadTs,
          text: 'Failed to send message. Please copy the text manually.',
        });
      }
    }
  });
}
