import type { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { db, installations, actionableItems, decrypt } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { getEncryptionKey } from '../../env.js';
import { updateActionableStatus } from '../../services/actionables.js';
import { generateTaskCompletionReply } from '../../services/task-completion-ai.js';
import { logger } from '../../utils/logger.js';

interface TaskCompletionMetadata {
  taskId: string;
  workspaceId: string;
  userId: string;
  channelId: string;
  messageTs: string;
  threadTs?: string;
  messageText: string;
  taskTitle: string;
  taskDescription?: string;
  actionableType: string;
}

/**
 * Register the task completion modal submission handler.
 * Handles the form submit from the "Complete Task" modal:
 * 1. Marks the task as complete
 * 2. Optionally generates an AI reply in the user's voice
 * 3. Posts the reply in the original Slack thread
 */
export function registerTaskCompletionModalHandler(app: App): void {
  app.view('task_completion_modal', async ({ ack, view, body }) => {
    const metadata: TaskCompletionMetadata = JSON.parse(view.private_metadata);

    // Extract form values
    const completionNote =
      view.state.values.completion_note_block?.completion_note?.value || undefined;
    const replyCheckbox =
      view.state.values.reply_in_thread_block?.reply_in_thread?.selected_options || [];
    const shouldReply = replyCheckbox.some(
      (opt: { value: string }) => opt.value === 'reply'
    );

    // Acknowledge immediately to prevent timeout
    await ack();

    try {
      // 1. Mark task as complete
      const success = await updateActionableStatus(
        metadata.workspaceId,
        metadata.userId,
        metadata.taskId,
        'completed',
        undefined,
        completionNote
      );

      if (!success) {
        logger.error(
          { taskId: metadata.taskId },
          'Task not found during completion modal submit'
        );
        return;
      }

      // 2. If user wants a thread reply, generate and post it
      if (shouldReply) {
        await postCompletionReply(metadata, completionNote, body.user.id);
      }

      logger.info(
        {
          taskId: metadata.taskId,
          completionNote: !!completionNote,
          replyPosted: shouldReply,
        },
        'Task completed via modal'
      );
    } catch (error) {
      logger.error(
        { error, taskId: metadata.taskId },
        'Error processing task completion modal'
      );
    }
  });
}

/**
 * Generate an AI reply in the user's voice and post it to the original thread.
 */
async function postCompletionReply(
  metadata: TaskCompletionMetadata,
  completionNote: string | undefined,
  actingUserId: string
): Promise<void> {
  try {
    // Get user token for posting as the user
    const [installation] = await db
      .select({
        userToken: installations.userToken,
        userId: installations.userId,
      })
      .from(installations)
      .where(eq(installations.workspaceId, metadata.workspaceId))
      .limit(1);

    if (!installation?.userToken) {
      logger.warn(
        { workspaceId: metadata.workspaceId },
        'No user token available for completion reply'
      );
      return;
    }

    // Verify the token belongs to the acting user
    if (installation.userId !== actingUserId) {
      logger.warn(
        {
          workspaceId: metadata.workspaceId,
          actingUser: actingUserId,
          tokenUser: installation.userId,
        },
        'User token belongs to different user — skipping completion reply'
      );
      return;
    }

    // Generate AI reply in user's voice
    const { reply, processingTimeMs } = await generateTaskCompletionReply({
      workspaceId: metadata.workspaceId,
      userId: metadata.userId,
      taskTitle: metadata.taskTitle,
      taskDescription: metadata.taskDescription,
      actionableType: metadata.actionableType,
      originalMessageText: metadata.messageText,
      completionNote,
    });

    // Decrypt user token and post
    const userToken = decrypt(installation.userToken, getEncryptionKey());
    const userClient = new WebClient(userToken);

    const threadTs = metadata.threadTs || metadata.messageTs;

    const result = await userClient.chat.postMessage({
      channel: metadata.channelId,
      text: reply,
      thread_ts: threadTs,
    });

    // Store the reply timestamp for potential undo
    if (result.ts) {
      await db
        .update(actionableItems)
        .set({ completionReplyTs: result.ts })
        .where(
          and(
            eq(actionableItems.id, metadata.taskId),
            eq(actionableItems.workspaceId, metadata.workspaceId)
          )
        );
    }

    logger.info(
      {
        taskId: metadata.taskId,
        channelId: metadata.channelId,
        threadTs,
        replyTs: result.ts,
        processingTimeMs,
      },
      'Completion reply posted in thread'
    );
  } catch (error) {
    // Log but don't throw — the task is already marked complete
    logger.error(
      {
        error,
        taskId: metadata.taskId,
        channelId: metadata.channelId,
      },
      'Failed to post completion reply — task still marked complete'
    );
  }
}
