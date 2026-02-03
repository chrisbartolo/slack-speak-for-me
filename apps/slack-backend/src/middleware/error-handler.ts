import type { AllMiddlewareArgs } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';
import { postToUser } from '../services/suggestion-delivery.js';
import { logger } from '../utils/logger.js';

/**
 * Custom error class for Slack-specific errors
 */
export class SlackError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SlackError';
  }
}

/**
 * Map internal errors to user-friendly messages
 */
const errorMessages: Record<string, string> = {
  VALIDATION_ERROR: "I couldn't understand that message. Please try again.",
  AI_GENERATION_FAILED: "I'm having trouble generating a response right now. Please try again in a moment.",
  RATE_LIMITED: "You're sending requests too quickly. Please wait a moment and try again.",
  DATABASE_ERROR: "Something went wrong on our end. Please try again.",
  INSTALLATION_NOT_FOUND: "This app needs to be reinstalled. Please contact your workspace admin.",
  PROMPT_INJECTION_DETECTED: "Your message contains patterns that could be harmful. Please rephrase and try again.",
  UNKNOWN_ERROR: "Something unexpected happened. Please try again.",
};

/**
 * Get user-friendly message for error code
 */
export function getUserMessage(code: string): string {
  return errorMessages[code] || errorMessages.UNKNOWN_ERROR;
}

/**
 * Global error handler for Bolt app
 * Logs error with context and returns user-friendly message
 */
export async function errorHandler(error: Error & { code?: string }): Promise<void> {
  // Extract error details
  const errorCode = error instanceof SlackError
    ? error.code
    : error.code || 'UNKNOWN_ERROR';

  const context = error instanceof SlackError
    ? error.context
    : undefined;

  // Log the full error for debugging
  logger.error({
    err: {
      message: error.message,
      name: error.name,
      code: errorCode,
      stack: error.stack,
    },
    context,
  }, 'Error in Slack handler');

  // Note: User-friendly message is handled by event handlers
  // This global handler is for logging and cleanup
}

/**
 * Wrap async handler with error handling
 * Returns user-friendly ephemeral message on error
 */
export function withErrorHandling<T extends AllMiddlewareArgs>(
  handler: (args: T) => Promise<void>
) {
  return async (args: T): Promise<void> => {
    try {
      await handler(args);
    } catch (error) {
      const err = error as Error & { code?: string };

      // Log the error
      await errorHandler(err);

      // Try to send user-friendly message if we have client and user context
      const { client, body } = args as unknown as {
        client?: WebClient;
        body?: { event?: { channel?: string; user?: string } };
      };

      if (client && body?.event?.channel && body?.event?.user) {
        try {
          const errorCode = err instanceof SlackError
            ? err.code
            : err.code || 'UNKNOWN_ERROR';

          await postToUser(client, body.event.channel, body.event.user, {
            text: `:warning: ${getUserMessage(errorCode)}`,
          });
        } catch (notifyError) {
          // If we can't notify user, just log it
          logger.error({ err: notifyError }, 'Failed to send error notification to user');
        }
      }
    }
  };
}
