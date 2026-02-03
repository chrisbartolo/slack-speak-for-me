import { Assistant } from '@slack/bolt';
import { handleThreadStarted } from './handlers/thread-started.js';
import { handleThreadContextChanged } from './handlers/thread-context.js';
import { handleUserMessage } from './handlers/user-message.js';

/**
 * Slack AI Assistant instance.
 *
 * Handles three events:
 * - threadStarted: Welcome message + suggested prompts when user opens the assistant panel
 * - threadContextChanged: Persist context when user switches channels
 * - userMessage: Process user messages and generate AI suggestions
 */
export const assistant = new Assistant({
  threadStarted: handleThreadStarted,
  threadContextChanged: handleThreadContextChanged,
  userMessage: handleUserMessage,
});
