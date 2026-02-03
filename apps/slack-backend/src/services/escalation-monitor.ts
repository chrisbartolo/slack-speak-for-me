import { db, escalationAlerts, users, workspaces, installations, decrypt } from '@slack-speak/database';
import { eq, and, gt, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { getEncryptionKey } from '../env.js';
import { WebClient } from '@slack/web-api';
import type { SentimentAnalysis } from './sentiment-detector.js';

interface TriggerEscalationAlertParams {
  organizationId: string;
  workspaceId: string;
  clientProfileId?: string;
  channelId: string;
  messageTs: string;
  sentiment: SentimentAnalysis;
}

/**
 * Trigger an escalation alert when client message shows high/critical risk
 *
 * - Creates alert record in database
 * - Sends Slack DM notifications to org admins
 * - 4-hour cooldown prevents re-alerting on same channel
 * - Fire-and-forget pattern - never blocks suggestion generation
 */
export async function triggerEscalationAlert(
  params: TriggerEscalationAlertParams
): Promise<string | null> {
  try {
    const { organizationId, workspaceId, clientProfileId, channelId, messageTs, sentiment } = params;

    // Check for existing open alert on same channel within last 4 hours (cooldown)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const [existingAlert] = await db
      .select({ id: escalationAlerts.id })
      .from(escalationAlerts)
      .where(
        and(
          eq(escalationAlerts.channelId, channelId),
          eq(escalationAlerts.status, 'open'),
          gt(escalationAlerts.createdAt, fourHoursAgo)
        )
      )
      .limit(1);

    if (existingAlert) {
      logger.info(
        { channelId, existingAlertId: existingAlert.id },
        'Skipping escalation alert - 4-hour cooldown active'
      );
      return existingAlert.id;
    }

    // Map risk level to severity
    const severity = sentiment.riskLevel === 'critical'
      ? 'critical'
      : sentiment.riskLevel === 'high'
      ? 'high'
      : 'medium';

    // Generate summary
    const summary = `Client message shows ${sentiment.tone} tone (confidence: ${(sentiment.confidence * 100).toFixed(0)}%)`;

    // Generate suggested action based on severity
    let suggestedAction = '';
    if (severity === 'critical') {
      suggestedAction = 'URGENT: Escalate to account manager immediately. Consider calling client directly.';
    } else if (severity === 'high') {
      suggestedAction = 'Review conversation immediately. Respond within 1 hour with empathetic acknowledgment.';
    } else {
      suggestedAction = 'Monitor conversation closely. Ensure next response addresses concerns directly.';
    }

    // Insert escalation alert
    const [newAlert] = await db
      .insert(escalationAlerts)
      .values({
        organizationId,
        workspaceId,
        clientProfileId,
        channelId,
        messageTs,
        alertType: 'tension_detected',
        severity,
        summary,
        suggestedAction,
        sentiment: sentiment as any, // Store full sentiment object as jsonb
        status: 'open',
      })
      .returning({ id: escalationAlerts.id });

    const alertId = newAlert.id;

    logger.info(
      { alertId, channelId, severity, tone: sentiment.tone },
      'Escalation alert created'
    );

    // Get org admins
    const admins = await db
      .select({
        slackUserId: users.slackUserId,
      })
      .from(users)
      .where(
        and(
          eq(users.workspaceId, workspaceId),
          eq(users.role, 'admin')
        )
      );

    if (admins.length === 0) {
      logger.warn({ organizationId, workspaceId }, 'No admins found for escalation notification');
      return alertId;
    }

    // Get bot token for sending notifications
    const [inst] = await db
      .select({ installation: installations, workspace: workspaces })
      .from(installations)
      .innerJoin(workspaces, eq(installations.workspaceId, workspaces.id))
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!inst) {
      logger.warn({ workspaceId }, 'Installation not found for escalation notification');
      return alertId;
    }

    const encKey = getEncryptionKey();
    const botToken = decrypt(inst.installation.botToken, encKey);
    const client = new WebClient(botToken);

    // Send DM notification to each admin
    const alertMessage = `:rotating_light: *Escalation Alert*
*Severity:* ${severity.toUpperCase()}
*Channel:* <#${channelId}>
*Risk:* ${sentiment.tone} (confidence: ${(sentiment.confidence * 100).toFixed(0)}%)
*Indicators:* ${sentiment.indicators.join(', ')}
*Suggested Action:* ${suggestedAction}

<${process.env.APP_URL || 'https://speakforme.ai'}/admin/escalations|View all alerts>`;

    for (const admin of admins) {
      try {
        await client.chat.postMessage({
          channel: admin.slackUserId, // DM by user ID
          text: alertMessage,
        });

        logger.info(
          { alertId, adminUserId: admin.slackUserId },
          'Escalation notification sent to admin'
        );
      } catch (dmError) {
        // Non-fatal - log but continue with other admins
        logger.warn(
          { error: dmError, adminUserId: admin.slackUserId, alertId },
          'Failed to send escalation DM to admin'
        );
      }
    }

    return alertId;
  } catch (error) {
    // CRITICAL: Never throw - escalation alerts should never crash suggestion generation
    logger.error({ error, params }, 'Failed to trigger escalation alert');
    return null;
  }
}

/**
 * Acknowledge an escalation alert
 */
export async function acknowledgeAlert(
  alertId: string,
  organizationId: string,
  acknowledgedBy: string
): Promise<void> {
  await db
    .update(escalationAlerts)
    .set({
      status: 'acknowledged',
      acknowledgedBy,
      acknowledgedAt: new Date(),
    })
    .where(
      and(
        eq(escalationAlerts.id, alertId),
        eq(escalationAlerts.organizationId, organizationId)
      )
    );

  logger.info({ alertId, acknowledgedBy }, 'Escalation alert acknowledged');
}

/**
 * Resolve an escalation alert
 */
export async function resolveAlert(
  alertId: string,
  organizationId: string,
  resolvedBy: string,
  resolutionNotes?: string
): Promise<void> {
  await db
    .update(escalationAlerts)
    .set({
      status: 'resolved',
      acknowledgedBy: resolvedBy, // Also set acknowledgedBy if not set
      acknowledgedAt: sql`COALESCE(acknowledged_at, NOW())`,
      resolvedAt: new Date(),
      resolutionNotes,
    })
    .where(
      and(
        eq(escalationAlerts.id, alertId),
        eq(escalationAlerts.organizationId, organizationId)
      )
    );

  logger.info({ alertId, resolvedBy }, 'Escalation alert resolved');
}

/**
 * Mark an escalation alert as false positive
 */
export async function markFalsePositive(
  alertId: string,
  organizationId: string
): Promise<void> {
  await db
    .update(escalationAlerts)
    .set({
      status: 'false_positive',
    })
    .where(
      and(
        eq(escalationAlerts.id, alertId),
        eq(escalationAlerts.organizationId, organizationId)
      )
    );

  logger.info({ alertId }, 'Escalation alert marked as false positive');
}

interface GetEscalationAlertsFilters {
  status?: string;
  severity?: string;
  limit?: number;
}

/**
 * Get escalation alerts for admin UI
 */
export async function getEscalationAlerts(
  organizationId: string,
  filters?: GetEscalationAlertsFilters
): Promise<Array<typeof escalationAlerts.$inferSelect>> {
  const conditions = [eq(escalationAlerts.organizationId, organizationId)];

  if (filters?.status) {
    conditions.push(eq(escalationAlerts.status, filters.status));
  }

  if (filters?.severity) {
    conditions.push(eq(escalationAlerts.severity, filters.severity));
  }

  const alerts = await db
    .select()
    .from(escalationAlerts)
    .where(and(...conditions))
    .orderBy(sql`${escalationAlerts.createdAt} DESC`)
    .limit(filters?.limit || 50);

  return alerts;
}

/**
 * Get alert statistics for admin dashboard
 */
export async function getAlertStats(
  organizationId: string
): Promise<{
  open: number;
  acknowledged: number;
  resolved: number;
  falsePositive: number;
  totalThisMonth: number;
}> {
  // Get counts by status
  const results = await db
    .select({
      status: escalationAlerts.status,
      count: sql<number>`count(*)`,
    })
    .from(escalationAlerts)
    .where(eq(escalationAlerts.organizationId, organizationId))
    .groupBy(escalationAlerts.status);

  const stats = {
    open: 0,
    acknowledged: 0,
    resolved: 0,
    falsePositive: 0,
    totalThisMonth: 0,
  };

  for (const row of results) {
    const count = Number(row.count);
    switch (row.status) {
      case 'open':
        stats.open = count;
        break;
      case 'acknowledged':
        stats.acknowledged = count;
        break;
      case 'resolved':
        stats.resolved = count;
        break;
      case 'false_positive':
        stats.falsePositive = count;
        break;
    }
  }

  // Get total this month
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const [thisMonth] = await db
    .select({ count: sql<number>`count(*)` })
    .from(escalationAlerts)
    .where(
      and(
        eq(escalationAlerts.organizationId, organizationId),
        gt(escalationAlerts.createdAt, firstOfMonth)
      )
    );

  stats.totalThisMonth = Number(thisMonth?.count || 0);

  return stats;
}
