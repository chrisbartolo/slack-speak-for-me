import type { AssistantUserMessageMiddleware } from '@slack/bolt';
import { streamSuggestionToAssistant } from '../streaming.js';
import { getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';
import { generateSuggestionId, recordEventReceived } from '../../services/suggestion-metrics.js';

/**
 * Handle user messages in the assistant panel.
 * Streams an AI-generated suggestion using the viewing channel's context.
 */
export const handleUserMessage: AssistantUserMessageMiddleware = async ({
  say,
  client,
  setTitle,
  setStatus,
  event,
  getThreadContext,
}) => {
  const messageText = (event as { text?: string }).text || '';

  try {
    await setTitle(messageText.slice(0, 50) || 'Response suggestion');
    await setStatus('thinking...');

    // Get the channel context the user is viewing
    const threadContext = await getThreadContext();
    const viewingChannelId = threadContext?.channel_id;
    // thread_ts may be present in context payload but not in Bolt's type definition
    const viewingThreadTs = (threadContext as Record<string, string | undefined>)?.thread_ts;

    // Get workspace ID from team context
    const authResult = await client.auth.test();
    const teamId = authResult.team_id;
    if (!teamId) {
      await setStatus('');
      await say('Sorry, I could not determine your workspace. Please try again.');
      return;
    }

    const workspaceId = await getWorkspaceId(teamId);
    if (!workspaceId) {
      await setStatus('');
      await say('Sorry, I could not find your workspace. Please reinstall the app.');
      return;
    }

    await setStatus('generating response...');

    const channelId = (event as { channel: string }).channel;
    const threadTs = (event as { thread_ts: string }).thread_ts;
    const userId = (event as { user: string }).user;

    // Generate suggestion ID and record event
    const suggestionId = generateSuggestionId();
    recordEventReceived({
      suggestionId,
      workspaceId,
      userId,
      channelId: viewingChannelId || channelId,
      triggerType: viewingChannelId?.startsWith('D') ? 'dm' : 'message_action',
    }).catch(() => {});

    await streamSuggestionToAssistant({
      client,
      channelId,
      threadTs,
      userText: messageText,
      viewingChannelId,
      viewingThreadTs,
      workspaceId,
      userId,
      suggestionId,
    });

    await setStatus('');
  } catch (error: any) {
    logger.error({ error }, 'Error in assistant userMessage handler');

    try {
      await setStatus('');

      if (error.name === 'UsageLimitExceededError') {
        await say(
          `You've reached your usage limit (${error.currentUsage}/${error.limit} suggestions). Upgrade your plan for more.`,
        );
      } else {
        await say('Sorry, I encountered an error generating that response. Please try again.');
      }
    } catch {
      // Ignore cleanup failure
    }
  }
};
