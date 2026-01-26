import { App } from '@slack/bolt';
import { env } from './env.js';
import { installationStore } from './oauth/installation-store.js';
import { errorHandler } from './middleware/error-handler.js';

/**
 * Slack Bolt app with OAuth configuration
 */
export const app = new App({
  signingSecret: env.SLACK_SIGNING_SECRET,
  clientId: env.SLACK_CLIENT_ID,
  clientSecret: env.SLACK_CLIENT_SECRET,
  stateSecret: env.SLACK_STATE_SECRET,
  installationStore,
  scopes: [
    'channels:history',
    'channels:read',
    'chat:write',
    'users:read',
    'app_mentions:read',
  ],
  installerOptions: {
    directInstall: true,
  },
});

// Register global error handler
app.error(errorHandler);
