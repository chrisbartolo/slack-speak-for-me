import type { AssistantThreadStartedMiddleware } from '@slack/bolt';
import { generateSuggestedPrompts } from '../suggested-prompts.js';
import { logger } from '../../utils/logger.js';

/**
 * Handle assistant_thread_started event.
 * Sends a welcome message and context-aware suggested prompts.
 */
export const handleThreadStarted: AssistantThreadStartedMiddleware = async ({
  say,
  setSuggestedPrompts,
  event,
}) => {
  try {
    await say(
      "Hi! I'm Speak for Me. I'll help you craft professional responses to workplace messages. " +
      'Tell me what you need help with, or pick a suggestion below.',
    );

    const channelId = event.assistant_thread?.context?.channel_id;

    logger.debug({ channelId }, 'Assistant thread started');

    const prompts = generateSuggestedPrompts({ channel_id: channelId });
    await setSuggestedPrompts({ prompts });
  } catch (error) {
    logger.error({ error }, 'Error in assistant threadStarted handler');
  }
};
