import pino from 'pino';
import { env } from '../env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: {
    service: 'slack-speak-for-me',
    env: env.NODE_ENV,
  },
  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'token',
      'botToken',
      'userToken',
      'apiKey',
      'SLACK_CLIENT_SECRET',
      'SLACK_SIGNING_SECRET',
      'SLACK_STATE_SECRET',
      'ENCRYPTION_KEY',
      'ANTHROPIC_API_KEY',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
