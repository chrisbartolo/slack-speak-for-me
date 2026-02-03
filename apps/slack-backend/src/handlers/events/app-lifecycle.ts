import type { App } from '@slack/bolt';
import { getWorkspaceId } from '../../services/watch.js';
import { cleanupWorkspaceData, revokeWorkspaceTokens } from '../../services/workspace-cleanup.js';
import { logger } from '../../utils/logger.js';

/**
 * Register handlers for app lifecycle events:
 * - app_uninstalled: Clean up all workspace data when app is removed
 * - tokens_revoked: Delete tokens when they are revoked
 */
export function registerAppLifecycleHandlers(app: App): void {
  app.event('app_uninstalled', async ({ context }) => {
    const teamId = context.teamId;

    try {
      logger.info({ teamId }, 'app_uninstalled event received');

      if (!teamId) {
        logger.error('app_uninstalled event missing team ID');
        return;
      }

      const workspaceId = await getWorkspaceId(teamId);
      if (!workspaceId) {
        logger.warn({ teamId }, 'Workspace not found for uninstall event');
        return;
      }

      await cleanupWorkspaceData(workspaceId);
      logger.info({ teamId, workspaceId }, 'Workspace data cleaned up after uninstall');
    } catch (error) {
      logger.error({ error, teamId }, 'Error handling app_uninstalled event');
    }
  });

  app.event('tokens_revoked', async ({ context }) => {
    const teamId = context.teamId;

    try {
      logger.info({ teamId }, 'tokens_revoked event received');

      if (!teamId) {
        logger.error('tokens_revoked event missing team ID');
        return;
      }

      const workspaceId = await getWorkspaceId(teamId);
      if (!workspaceId) {
        logger.warn({ teamId }, 'Workspace not found for tokens_revoked event');
        return;
      }

      await revokeWorkspaceTokens(workspaceId);
      logger.info({ teamId, workspaceId }, 'Tokens revoked and workspace marked inactive');
    } catch (error) {
      logger.error({ error, teamId }, 'Error handling tokens_revoked event');
    }
  });
}
