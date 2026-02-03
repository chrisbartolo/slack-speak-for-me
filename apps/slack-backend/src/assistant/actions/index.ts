import type { App } from '@slack/bolt';
import { registerFeedbackAction } from './feedback-handler.js';
import { registerAssistantSendAction } from './send-from-assistant.js';
import { registerAssistantRefineAction } from './refine-from-assistant.js';
import { registerAssistantDismissAction } from './dismiss-from-assistant.js';

/**
 * Register all assistant panel action handlers.
 */
export function registerAssistantActions(app: App): void {
  registerFeedbackAction(app);
  registerAssistantSendAction(app);
  registerAssistantRefineAction(app);
  registerAssistantDismissAction(app);
}
