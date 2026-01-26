import { App } from '@slack/bolt';
import { env } from './env.js';
import { installationStore } from './oauth/installation-store.js';
import { errorHandler } from './middleware/error-handler.js';
import {
  healthRoutes,
  logHealthEndpointsRegistered,
  registerWatchCommands,
  registerAppMentionHandler,
  registerMessageReplyHandler,
  registerHelpMeRespondShortcut,
  registerCopySuggestionAction,
  registerDismissSuggestionAction,
  registerRefineSuggestionAction,
  registerCopyFinalSuggestionAction,
  registerRefinementModalHandler,
} from './handlers/index.js';

/**
 * Slack Bolt app with OAuth configuration and health endpoints.
 *
 * The customRoutes option registers health endpoints:
 * - GET /health/live: Liveness probe (is the app running?)
 * - GET /health/ready: Readiness probe (are all dependencies healthy?)
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
    'commands',
  ],
  installerOptions: {
    directInstall: true,
  },
  customRoutes: healthRoutes,
});

// Register global error handler
app.error(errorHandler);

// Register event handlers
registerAppMentionHandler(app);
registerMessageReplyHandler(app);

// Register slash commands
registerWatchCommands(app);

// Register message shortcuts
registerHelpMeRespondShortcut(app);

// Register action handlers
registerCopySuggestionAction(app);
registerDismissSuggestionAction(app);
registerRefineSuggestionAction(app);
registerCopyFinalSuggestionAction(app);

// Register view handlers
registerRefinementModalHandler(app);

// Log health endpoints registration
logHealthEndpointsRegistered();
