import type { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { db, installations, decrypt } from '@slack-speak/database';
import { eq } from 'drizzle-orm';
import { getEncryptionKey } from '../../env.js';
import { getWorkspaceId } from '../../services/watch.js';
import { trackRefinement } from '../../services/personalization/feedbackTracker.js';
import { logger } from '../../utils/logger.js';

/**
 * Handle "Send as Me" button click.
 * Posts the suggestion to the channel using the user's token.
 */
export function registerSendSuggestionAction(app: App): void {
  app.action('send_suggestion', async ({ ack, body, respond, client }) => {
    await ack();

    // Extract suggestion from button value
    const actionBody = body as {
      actions: Array<{ value?: string }>;
      user: { id: string };
      channel?: { id: string };
      container?: { channel_id: string; message_ts: string; thread_ts?: string };
    };
    const value = actionBody.actions[0]?.value;

    if (!value) {
      logger.warn({ body }, 'Send action missing value');
      return;
    }

    try {
      const parsed = JSON.parse(value);
      const { suggestionId, suggestion } = parsed;
      const userId = actionBody.user.id;

      // Get channelId from body (ephemeral message) or from value (modal button)
      const channelId = actionBody.channel?.id || actionBody.container?.channel_id || parsed.channelId;

      // Get thread_ts from body or from value
      const threadTs = actionBody.container?.thread_ts || parsed.threadTs;

      if (!channelId) {
        logger.error({ body }, 'Could not determine channel for send action');
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          text: '❌ Could not determine which channel to send to.',
        });
        return;
      }

      // Get team ID from body
      const teamId = 'team' in body && body.team ? (body.team as { id: string }).id : '';
      if (!teamId) {
        logger.error({ body }, 'Could not determine team ID');
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          text: '❌ Could not determine workspace.',
        });
        return;
      }

      // Look up workspace ID
      const workspaceId = await getWorkspaceId(teamId);
      if (!workspaceId) {
        logger.error({ teamId }, 'Workspace not found');
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          text: '❌ Workspace not found. Please reinstall the app.',
        });
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

      if (!installation?.userToken) {
        logger.warn({ workspaceId, userId }, 'No user token available');
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          text: '❌ Cannot send as you - please reinstall the app to grant the required permission.',
        });
        return;
      }

      // Check if the stored user token belongs to this user
      if (installation.userId !== userId) {
        logger.warn({
          workspaceId,
          requestingUser: userId,
          tokenUser: installation.userId
        }, 'User token belongs to different user');
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          text: '❌ Cannot send as you - only the user who installed the app can use this feature. Please copy the text manually.',
        });
        return;
      }

      // Decrypt user token
      const userToken = decrypt(installation.userToken, getEncryptionKey());

      // Create client with user token
      const userClient = new WebClient(userToken);

      // Post message as user
      await userClient.chat.postMessage({
        channel: channelId,
        text: suggestion,
        thread_ts: threadTs, // Reply in thread if applicable
      });

      logger.info({
        suggestionId,
        userId,
        channelId,
        threadTs,
      }, 'Message sent as user');

      // Track that this suggestion was used (for AI learning)
      try {
        await trackRefinement({
          workspaceId,
          userId,
          suggestionId,
          original: suggestion,
          modified: suggestion, // Same = accepted as-is or after refinement
          refinementType: 'word_choice', // Indicates acceptance
        });
        logger.info({ suggestionId, userId }, 'Tracked suggestion usage');
      } catch (trackError) {
        // Don't fail the send if tracking fails
        logger.warn({ trackError }, 'Failed to track suggestion usage');
      }

      // Check if triggered from a modal (has view property) or ephemeral message
      const viewId = 'view' in body && body.view ? (body.view as { id: string }).id : null;

      if (viewId) {
        // Close the modal
        await client.views.update({
          view_id: viewId,
          view: {
            type: 'modal',
            callback_id: 'send_complete',
            title: {
              type: 'plain_text',
              text: 'Sent!',
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
                  text: '✅ Message sent successfully!',
                },
              },
            ],
          },
        });
      } else {
        // Dismiss the ephemeral message
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          delete_original: true,
          text: '✅ Message sent!',
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error sending message as user');
      await respond({
        response_type: 'ephemeral',
        replace_original: true,
        text: '❌ Failed to send message. Please copy the text manually.',
      });
    }
  });
}
