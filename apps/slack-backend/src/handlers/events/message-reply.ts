import type { App } from '@slack/bolt';
import { isWatching, recordThreadParticipation, isParticipatingInThread, getWorkspaceId, getWatchersForChannel } from '../../services/watch.js';
import { getContextForMessage, getThreadContext } from '../../services/context.js';
import { queueAIResponse } from '../../jobs/queues.js';
import { logger } from '../../utils/logger.js';
import { processMessageForActionables } from '../../services/actionables.js';

/**
 * Register message event handler for reply detection
 *
 * Triggers when:
 * - Someone replies to user's message in a watched conversation
 * - Someone posts in a thread where user is participating
 *
 * Filters out:
 * - Bot messages (to prevent loops)
 * - User's own messages
 * - Messages in unwatched conversations
 */
export function registerMessageReplyHandler(app: App) {
  app.message(async ({ message, client }) => {
    try {
      // Filter bot messages to avoid loops
      if ('bot_id' in message || 'subtype' in message) {
        return;
      }

      // Type guard: ensure this is a GenericMessageEvent with required fields
      if (!('user' in message) || !('text' in message) || !('ts' in message) || !('channel' in message)) {
        return;
      }

      // Extract fields with explicit type assertion after guards
      const typedMessage = message as {
        user: string;
        text: string;
        ts: string;
        channel: string;
        thread_ts?: string;
        channel_type?: string;  // 'im' | 'mpim' | 'channel' | 'group'
      };

      if (!typedMessage.user || !typedMessage.text || !typedMessage.ts) {
        return;
      }

      const messageTs = typedMessage.ts;
      const channelId = typedMessage.channel;
      const userId = typedMessage.user;
      const threadTs = typedMessage.thread_ts;

      // Detect DM conversations - channel_type is 'im' or channel ID starts with 'D'
      const channelType = typedMessage.channel_type;
      const isDM = channelType === 'im' || channelId.startsWith('D');

      logger.debug({
        channel: channelId,
        user: userId,
        ts: messageTs,
        threadTs,
        channelType,
        isDM,
      }, 'message event received');

      // Get the Slack team ID from the client's auth test
      const authResult = await client.auth.test();
      const teamId = authResult.team_id as string;

      if (!teamId) {
        logger.error('Could not determine team ID from auth.test');
        return;
      }

      // Look up internal workspace ID from Slack team ID
      const workspaceId = await getWorkspaceId(teamId);
      if (!workspaceId) {
        logger.error({ teamId }, 'Workspace not found for team ID');
        return;
      }

      // Record participation in thread if this is a thread message
      if (threadTs) {
        await recordThreadParticipation(workspaceId, userId, channelId, threadTs);
        logger.debug({
          workspaceId,
          userId,
          channelId,
          threadTs,
        }, 'Recorded thread participation');
      }

      // Handle DM conversations - trigger for watchers when message is from other party
      if (isDM && !threadTs) {
        // Get all users watching this DM channel
        const watchers = await getWatchersForChannel(workspaceId, channelId);

        for (const watcherUserId of watchers) {
          // Skip if watcher is the message author (don't suggest for own messages)
          if (watcherUserId === userId) {
            logger.debug({ user: watcherUserId }, 'Skipping DM - user is message author');
            continue;
          }

          // Get context messages for the DM
          const contextMessages = await getContextForMessage(client, channelId, messageTs);

          // Queue AI suggestion for the watcher
          const job = await queueAIResponse({
            workspaceId,
            userId: watcherUserId,
            channelId,
            messageTs,
            threadTs: undefined, // DMs without threads
            triggerMessageText: typedMessage.text,
            contextMessages,
            triggeredBy: 'dm',
          });

          logger.info({
            jobId: job.id,
            watchingUser: watcherUserId,
            channelId,
          }, 'AI response job queued for DM message');

          // Detect actionable items for the watcher (async, non-blocking)
          processMessageForActionables({
            workspaceId,
            userId: watcherUserId,
            channelId,
            messageTs,
            messageText: typedMessage.text,
            messageAuthorId: userId,
            threadContext: contextMessages.map(m => `${m.userId}: ${m.text}`).join('\n'),
          }).catch(error => {
            logger.error({ error }, 'Failed to process message for actionables');
          });
        }
        return;
      }

      // Check if this message is a reply to someone we're watching
      // For thread messages, we need to check if any watched user is participating
      if (threadTs) {
        // Get thread context to see who's in the thread
        const threadMessages = await getThreadContext(client, channelId, threadTs);

        // Get unique user IDs from thread (excluding current message author)
        const participantUserIds = [...new Set(
          threadMessages
            .filter(m => m.userId !== userId)
            .map(m => m.userId)
        )];

        logger.debug({
          threadTs,
          participantUserIds,
        }, 'Thread participants identified');

        // Check if any participant is watching this conversation and actively participating
        for (const participantUserId of participantUserIds) {
          const isWatchingConversation = await isWatching(workspaceId, participantUserId, channelId);

          if (!isWatchingConversation) {
            continue;
          }

          const isActiveInThread = await isParticipatingInThread(
            workspaceId,
            participantUserId,
            channelId,
            threadTs
          );

          if (isActiveInThread) {
            logger.info({
              workspaceId,
              watchingUser: participantUserId,
              replyingUser: userId,
              channelId,
              threadTs,
            }, 'Detected reply in watched thread');

            // Queue AI response for the watching user
            const job = await queueAIResponse({
              workspaceId,
              userId: participantUserId,
              channelId,
              messageTs: threadTs, // Use thread root as message context
              threadTs, // Pass thread timestamp for YOLO mode
              triggerMessageText: typedMessage.text,
              contextMessages: threadMessages,
              triggeredBy: 'thread',
            });

            logger.info({
              jobId: job.id,
              watchingUser: participantUserId,
              channelId,
              threadTs,
            }, 'AI response job queued for thread reply');

            // Detect actionable items for the watching user (async, non-blocking)
            processMessageForActionables({
              workspaceId,
              userId: participantUserId,
              channelId,
              messageTs,
              threadTs,
              messageText: typedMessage.text,
              messageAuthorId: userId,
              threadContext: threadMessages.map(m => `${m.userId}: ${m.text}`).join('\n'),
            }).catch(error => {
              logger.error({ error }, 'Failed to process message for actionables');
            });
          }
        }
      } else {
        // For non-thread messages, check if this is a direct reply to any message
        // from a user who's watching this conversation
        // This scenario is less common but can happen with inline replies

        // For now, we'll skip this case and focus on thread replies
        // which is the primary use case for reply detection
        logger.debug({
          channelId,
          messageTs,
        }, 'Non-thread message - skipping reply detection');
      }

    } catch (error) {
      logger.error({ error, message }, 'Error handling message event');
      // Don't rethrow - we don't want to crash the app for a single event
    }
  });

  logger.info('message event handler registered');
}
