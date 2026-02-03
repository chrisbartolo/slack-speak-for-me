import {
  db,
  workspaces,
  installations,
  users,
  watchedConversations,
  autoRespondLog,
  threadParticipants,
  userStylePreferences,
  messageEmbeddings,
  refinementFeedback,
  gdprConsent,
  personContext,
  conversationContext,
  reportSettings,
  googleIntegrations,
  workflowConfig,
  suggestionFeedback,
  actionableItems,
  clientContacts,
  escalationAlerts,
  guardrailViolations,
  auditLogs,
} from '@slack-speak/database';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

/**
 * Tables to delete from on workspace uninstall, in safe order.
 * audit_logs, organizations, and workspaces are intentionally excluded.
 */
const WORKSPACE_TABLES = [
  { name: 'installations', table: installations },
  { name: 'watchedConversations', table: watchedConversations },
  { name: 'autoRespondLog', table: autoRespondLog },
  { name: 'threadParticipants', table: threadParticipants },
  { name: 'userStylePreferences', table: userStylePreferences },
  { name: 'messageEmbeddings', table: messageEmbeddings },
  { name: 'refinementFeedback', table: refinementFeedback },
  { name: 'gdprConsent', table: gdprConsent },
  { name: 'personContext', table: personContext },
  { name: 'conversationContext', table: conversationContext },
  { name: 'reportSettings', table: reportSettings },
  { name: 'googleIntegrations', table: googleIntegrations },
  { name: 'workflowConfig', table: workflowConfig },
  { name: 'suggestionFeedback', table: suggestionFeedback },
  { name: 'actionableItems', table: actionableItems },
  { name: 'clientContacts', table: clientContacts },
  { name: 'escalationAlerts', table: escalationAlerts },
  { name: 'guardrailViolations', table: guardrailViolations },
  { name: 'users', table: users },
] as const;

/**
 * Full workspace data cleanup for app_uninstalled events.
 * Deletes all workspace-scoped data and marks workspace inactive.
 * Best-effort: logs errors per table but continues with remaining tables.
 */
export async function cleanupWorkspaceData(workspaceId: string): Promise<void> {
  logger.info({ workspaceId }, 'Starting workspace data cleanup');

  for (const { name, table } of WORKSPACE_TABLES) {
    try {
      await db.delete(table).where(eq(table.workspaceId, workspaceId));
      logger.debug({ workspaceId, table: name }, 'Deleted workspace data from table');
    } catch (error) {
      logger.error({ error, workspaceId, table: name }, 'Failed to delete workspace data from table, continuing');
    }
  }

  // Mark workspace as inactive (soft-delete)
  try {
    await db
      .update(workspaces)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
    logger.info({ workspaceId }, 'Workspace marked inactive');
  } catch (error) {
    logger.error({ error, workspaceId }, 'Failed to mark workspace inactive');
  }

  // Record audit log
  try {
    await db.insert(auditLogs).values({
      workspaceId,
      action: 'app_uninstalled',
      resource: 'workspace',
      resourceId: workspaceId,
      details: { cleanedTables: WORKSPACE_TABLES.map(t => t.name) },
    });
  } catch (error) {
    logger.error({ error, workspaceId }, 'Failed to insert uninstall audit log');
  }

  logger.info({ workspaceId }, 'Workspace data cleanup complete');
}

/**
 * Token-only cleanup for tokens_revoked events.
 * Deletes installation tokens and marks workspace inactive.
 */
export async function revokeWorkspaceTokens(workspaceId: string): Promise<void> {
  logger.info({ workspaceId }, 'Revoking workspace tokens');

  try {
    await db.delete(installations).where(eq(installations.workspaceId, workspaceId));
    logger.info({ workspaceId }, 'Installation tokens deleted');
  } catch (error) {
    logger.error({ error, workspaceId }, 'Failed to delete installation tokens');
  }

  try {
    await db
      .update(workspaces)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));
    logger.info({ workspaceId }, 'Workspace marked inactive after token revocation');
  } catch (error) {
    logger.error({ error, workspaceId }, 'Failed to mark workspace inactive');
  }
}
