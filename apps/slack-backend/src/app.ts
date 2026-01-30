import pkg from '@slack/bolt';
const { App } = pkg;
import { env } from './env.js';
import { installationStore } from './oauth/installation-store.js';
import { errorHandler } from './middleware/error-handler.js';
import {
  healthRoutes,
  logHealthEndpointsRegistered,
  registerWatchCommands,
  registerGenerateReportCommand,
  registerAppMentionHandler,
  registerMessageReplyHandler,
  registerWorkflowSubmissionHandler,
  registerHelpMeRespondShortcut,
  registerCopySuggestionAction,
  registerDismissSuggestionAction,
  registerRefineSuggestionAction,
  registerCopyFinalSuggestionAction,
  registerSendSuggestionAction,
  registerReportActionHandlers,
  registerRefinementModalHandler,
  registerReportRefinementViewHandler,
} from './handlers/index.js';
import {
  testRoutes,
  logTestEndpointsRegistered,
} from './routes/test.js';

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
    userScopes: ['chat:write'],
    callbackOptions: {
      success: (_installation, _options, req, res) => {
        // Redirect to web portal success page after installation
        const webPortalUrl = process.env.WEB_PORTAL_URL || 'http://localhost:3001';
        res.writeHead(302, { Location: `${webPortalUrl}/install/success` });
        res.end();
      },
      failure: (_error, _options, req, res) => {
        // Redirect to web portal with error
        const webPortalUrl = process.env.WEB_PORTAL_URL || 'http://localhost:3001';
        res.writeHead(302, { Location: `${webPortalUrl}/?error=install_failed` });
        res.end();
      },
    },
  },
  customRoutes: [...healthRoutes, ...testRoutes],
});

// Register global error handler
app.error(errorHandler);

// Register event handlers
registerAppMentionHandler(app);
registerMessageReplyHandler(app);
registerWorkflowSubmissionHandler(app);

// Register slash commands
registerWatchCommands(app);
registerGenerateReportCommand(app);

// Register message shortcuts
registerHelpMeRespondShortcut(app);

// Register action handlers
registerCopySuggestionAction(app);
registerDismissSuggestionAction(app);
registerRefineSuggestionAction(app);
registerCopyFinalSuggestionAction(app);
registerSendSuggestionAction(app);
registerReportActionHandlers(app);

// Register view handlers
registerRefinementModalHandler(app);
registerReportRefinementViewHandler(app);

// Log health endpoints registration
logHealthEndpointsRegistered();

// Log test endpoints registration (non-production only)
logTestEndpointsRegistered();
