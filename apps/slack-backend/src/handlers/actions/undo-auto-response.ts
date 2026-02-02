import type { App } from '@slack/bolt';
import { undoAutoResponse, getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';

interface UndoActionValue {
  logId: string;
  channelId: string;
  messageTs: string;
}

/**
 * Handle "Undo" button click for YOLO mode auto-responses.
 *
 * Deletes the auto-sent message and marks the log entry as undone.
 */
export function registerUndoAutoResponseAction(app: App): void {
  app.action('undo_auto_response', async ({ ack, body, respond, client }) => {
    await ack();

    // Extract undo data from button value
    const actionBody = body as { actions: Array<{ value?: string }> };
    const valueStr = actionBody.actions[0]?.value || '{}';

    let undoData: UndoActionValue;
    try {
      undoData = JSON.parse(valueStr);
    } catch {
      logger.error({ valueStr }, 'Failed to parse undo action value');
      await respond({
        response_type: 'ephemeral',
        replace_original: true,
        text: 'Failed to undo - invalid action data.',
      });
      return;
    }

    const userId = 'user' in body ? body.user.id : '';
    const teamId = 'team' in body && body.team ? (body.team as { id: string }).id : '';

    // Convert Slack team ID to internal workspace UUID
    const workspaceId = teamId ? await getWorkspaceId(teamId) : null;

    if (!workspaceId) {
      logger.error({ teamId }, 'Failed to find workspace for undo action');
      await respond({
        response_type: 'ephemeral',
        replace_original: true,
        text: 'Failed to undo - workspace not found.',
      });
      return;
    }

    try {
      // Delete the auto-sent message
      await client.chat.delete({
        channel: undoData.channelId,
        ts: undoData.messageTs,
      });

      // Mark the auto-response as undone in the database
      const success = await undoAutoResponse(undoData.logId, workspaceId, userId);

      if (success) {
        logger.info({
          logId: undoData.logId,
          userId,
          channelId: undoData.channelId,
        }, 'Auto-response undone successfully');

        // Replace ephemeral with confirmation
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          text: 'Auto-response undone. The message has been deleted.',
        });
      } else {
        logger.warn({
          logId: undoData.logId,
          userId,
        }, 'Failed to mark auto-response as undone in database');

        // Message was deleted but DB update failed - still consider success
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          text: 'Message deleted.',
        });
      }
    } catch (error) {
      logger.error({
        error,
        logId: undoData.logId,
        channelId: undoData.channelId,
        messageTs: undoData.messageTs,
      }, 'Failed to undo auto-response');

      // Check if it's a "message not found" error (already deleted)
      const slackError = error as { data?: { error?: string } };
      if (slackError.data?.error === 'message_not_found') {
        await respond({
          response_type: 'ephemeral',
          replace_original: true,
          text: 'Message was already deleted.',
        });
        return;
      }

      await respond({
        response_type: 'ephemeral',
        replace_original: true,
        text: 'Failed to undo - the message may have been edited or deleted.',
      });
    }
  });
}
