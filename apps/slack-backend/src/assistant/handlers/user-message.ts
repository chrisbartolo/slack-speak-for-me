import type { AssistantUserMessageMiddleware } from '@slack/bolt';
import { logger } from '../../utils/logger.js';

/**
 * Handle user messages in the assistant panel.
 * Placeholder implementation — streaming wired in plan 15-04.
 */
export const handleUserMessage: AssistantUserMessageMiddleware = async ({
  say,
  setTitle,
  setStatus,
  event,
  getThreadContext,
}) => {
  try {
    const messageText = (event as { text?: string }).text || '';

    await setTitle(messageText.slice(0, 50) || 'Response suggestion');
    await setStatus('thinking...');

    // Get the channel context the user is viewing
    const threadContext = await getThreadContext();
    const channelId = threadContext?.channel_id;

    logger.info({ channelId, messageText: messageText.slice(0, 100) }, 'Assistant user message received');

    // Placeholder — streaming AI response wired in plan 15-04
    await say(
      "I'm working on your suggestion... (streaming coming soon)",
    );

    await setStatus('');
  } catch (error) {
    logger.error({ error }, 'Error in assistant userMessage handler');

    try {
      await setStatus('');
      await say('Sorry, something went wrong. Please try again.');
    } catch {
      // Ignore cleanup failure
    }
  }
};
