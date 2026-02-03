import { db, organizations, workspaces, suggestionFeedback, guardrailViolations, auditLogs } from '@slack-speak/database';
import { eq, lt, and, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// Minimal PLAN_FEATURES for data retention (duplicated to avoid circular deps)
const PLAN_RETENTION_DAYS: Record<string, number> = {
  free: 7,
  starter: 30,
  pro: 90,
  team: 90,
  business: 90,
};

function getDataRetentionDays(planId: string | null | undefined): number {
  return PLAN_RETENTION_DAYS[planId || 'free'] || 7;
}

export interface DataRetentionResult {
  organizationsProcessed: number;
  feedbackDeleted: number;
  violationsDeleted: number;
  auditLogsDeleted: number;
  errors: number;
}

/**
 * Process data retention cleanup for all organizations
 * Deletes expired audit data based on plan retention period
 */
export async function processDataRetention(): Promise<DataRetentionResult> {
  const startTime = Date.now();

  logger.info('Starting data retention cleanup job');

  let organizationsProcessed = 0;
  let totalFeedbackDeleted = 0;
  let totalViolationsDeleted = 0;
  let totalAuditLogsDeleted = 0;
  let totalErrors = 0;

  try {
    // Fetch all organizations with their planId
    const allOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        planId: organizations.planId,
      })
      .from(organizations);

    logger.info({ orgCount: allOrgs.length }, 'Processing data retention for organizations');

    // Process each organization
    for (const org of allOrgs) {
      try {
        // Get retention period for this org's plan
        const retentionDays = getDataRetentionDays(org.planId);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        logger.debug({
          orgId: org.id,
          orgName: org.name,
          planId: org.planId,
          retentionDays,
          cutoffDate: cutoffDate.toISOString(),
        }, 'Processing org data retention');

        // Get all workspace IDs for this organization
        const orgWorkspaces = await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.organizationId, org.id));

        const workspaceIds = orgWorkspaces.map(w => w.id);

        if (workspaceIds.length === 0) {
          logger.debug({ orgId: org.id }, 'No workspaces found for org, skipping');
          organizationsProcessed++;
          continue;
        }

        // Delete expired suggestion feedback
        let feedbackDeleted = 0;
        if (workspaceIds.length > 0) {
          const feedbackResult = await db
            .delete(suggestionFeedback)
            .where(
              and(
                inArray(suggestionFeedback.workspaceId, workspaceIds),
                lt(suggestionFeedback.createdAt, cutoffDate)
              )
            )
            .returning({ id: suggestionFeedback.id });

          feedbackDeleted = feedbackResult.length;
          totalFeedbackDeleted += feedbackDeleted;
        }

        // Delete expired guardrail violations
        const violationsResult = await db
          .delete(guardrailViolations)
          .where(
            and(
              eq(guardrailViolations.organizationId, org.id),
              lt(guardrailViolations.createdAt, cutoffDate)
            )
          )
          .returning({ id: guardrailViolations.id });

        const violationsDeleted = violationsResult.length;
        totalViolationsDeleted += violationsDeleted;

        // Delete expired audit logs
        let auditLogsDeleted = 0;
        if (workspaceIds.length > 0) {
          const auditResult = await db
            .delete(auditLogs)
            .where(
              and(
                inArray(auditLogs.workspaceId, workspaceIds),
                lt(auditLogs.createdAt, cutoffDate)
              )
            )
            .returning({ id: auditLogs.id });

          auditLogsDeleted = auditResult.length;
          totalAuditLogsDeleted += auditLogsDeleted;
        }

        if (feedbackDeleted > 0 || violationsDeleted > 0 || auditLogsDeleted > 0) {
          logger.info({
            orgId: org.id,
            orgName: org.name,
            planId: org.planId,
            retentionDays,
            feedbackDeleted,
            violationsDeleted,
            auditLogsDeleted,
          }, 'Cleaned expired data for organization');
        }

        organizationsProcessed++;
      } catch (orgError) {
        // Log error for this org but continue with others
        logger.error({
          error: orgError,
          orgId: org.id,
          orgName: org.name,
        }, 'Failed to process data retention for organization');
        totalErrors++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info({
      duration,
      organizationsProcessed,
      totalFeedbackDeleted,
      totalViolationsDeleted,
      totalAuditLogsDeleted,
      totalErrors,
    }, 'Data retention cleanup job completed');

    return {
      organizationsProcessed,
      feedbackDeleted: totalFeedbackDeleted,
      violationsDeleted: totalViolationsDeleted,
      auditLogsDeleted: totalAuditLogsDeleted,
      errors: totalErrors,
    };
  } catch (error) {
    logger.error({ error }, 'Data retention cleanup job failed');
    throw error;
  }
}
