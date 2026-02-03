import 'server-only';
import { db, schema } from '../db';
import { and, eq, gte, lte, desc, sql, count } from 'drizzle-orm';
import { getPlanFeatures } from './plan-features';

const { suggestionFeedback, users, auditLogs, workspaces } = schema;

export interface AuditTrailOptions {
  page?: number;
  pageSize?: number;
  action?: 'accepted' | 'refined' | 'dismissed' | 'sent';
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditTrailEntry {
  id: string;
  userId: string;
  userEmail?: string | null;
  action: string;
  channelId?: string | null;
  originalText?: string | null;
  finalText?: string | null;
  triggerContext?: string | null;
  createdAt: Date;
}

export interface AuditTrailResult {
  items: AuditTrailEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AuditTrailStats {
  totalEntries: number;
  last24h: number;
  uniqueUsers: number;
  mostCommonAction: string;
}

/**
 * Get paginated audit trail with plan-gated visibility
 */
export async function getAuditTrail(
  organizationId: string | undefined,
  workspaceId: string,
  planId: string | null | undefined,
  options: AuditTrailOptions = {}
): Promise<AuditTrailResult> {
  const {
    page = 1,
    pageSize = 50,
    action,
    userId,
    startDate,
    endDate,
  } = options;

  const planFeatures = getPlanFeatures(planId);
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions
  const conditions = [eq(suggestionFeedback.workspaceId, workspaceId)];

  if (action) {
    conditions.push(eq(suggestionFeedback.action, action));
  }

  if (userId) {
    conditions.push(eq(suggestionFeedback.userId, userId));
  }

  // Apply retention period if no explicit date range
  if (!startDate && !endDate) {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - planFeatures.dataRetentionDays);
    conditions.push(gte(suggestionFeedback.createdAt, retentionDate));
  } else {
    if (startDate) {
      conditions.push(gte(suggestionFeedback.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(suggestionFeedback.createdAt, endDate));
    }
  }

  // Select fields based on plan-gated visibility
  const selectFields = {
    id: suggestionFeedback.id,
    userId: suggestionFeedback.userId,
    userEmail: users.email,
    action: suggestionFeedback.action,
    channelId: suggestionFeedback.channelId,
    triggerContext: suggestionFeedback.triggerContext,
    createdAt: suggestionFeedback.createdAt,
    // Conditionally include text fields based on plan
    ...(planFeatures.auditTrailTextVisible
      ? {
          originalText: suggestionFeedback.originalText,
          finalText: suggestionFeedback.finalText,
        }
      : {}),
  };

  // Get paginated items
  const items = await db
    .select(selectFields)
    .from(suggestionFeedback)
    .leftJoin(users, eq(suggestionFeedback.userId, users.slackUserId))
    .where(and(...conditions))
    .orderBy(desc(suggestionFeedback.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(suggestionFeedback)
    .where(and(...conditions));

  const total = countResult?.count ?? 0;

  return {
    items: items as AuditTrailEntry[],
    total,
    page,
    pageSize,
    hasMore: offset + items.length < total,
  };
}

/**
 * Get audit trail summary statistics
 */
export async function getAuditTrailStats(
  organizationId: string | undefined,
  workspaceId: string
): Promise<AuditTrailStats> {
  // Total entries
  const [totalResult] = await db
    .select({ count: count() })
    .from(suggestionFeedback)
    .where(eq(suggestionFeedback.workspaceId, workspaceId));

  // Last 24h entries
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const [last24hResult] = await db
    .select({ count: count() })
    .from(suggestionFeedback)
    .where(
      and(
        eq(suggestionFeedback.workspaceId, workspaceId),
        gte(suggestionFeedback.createdAt, yesterday)
      )
    );

  // Unique users
  const [uniqueUsersResult] = await db
    .select({ count: sql<number>`count(distinct ${suggestionFeedback.userId})` })
    .from(suggestionFeedback)
    .where(eq(suggestionFeedback.workspaceId, workspaceId));

  // Most common action
  const actionCounts = await db
    .select({
      action: suggestionFeedback.action,
      count: count(),
    })
    .from(suggestionFeedback)
    .where(eq(suggestionFeedback.workspaceId, workspaceId))
    .groupBy(suggestionFeedback.action)
    .orderBy(desc(count()))
    .limit(1);

  return {
    totalEntries: totalResult?.count ?? 0,
    last24h: last24hResult?.count ?? 0,
    uniqueUsers: uniqueUsersResult?.count ?? 0,
    mostCommonAction: actionCounts[0]?.action ?? 'none',
  };
}

export interface AdminAuditEntry {
  id: string;
  userId?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  previousValue?: unknown;
  newValue?: unknown;
  createdAt: Date;
}

/**
 * Get admin-level audit logs (settings changes, admin actions)
 */
export async function getAdminAuditTrail(
  organizationId: string | undefined,
  workspaceId?: string,
  options: AuditTrailOptions = {}
): Promise<AdminAuditEntry[]> {
  const {
    page = 1,
    pageSize = 50,
    startDate,
    endDate,
  } = options;

  const offset = (page - 1) * pageSize;

  // Build WHERE conditions for admin actions
  const conditions = [];

  if (workspaceId) {
    conditions.push(eq(auditLogs.workspaceId, workspaceId));
  }

  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(auditLogs.createdAt, endDate));
  }

  // Only get admin-relevant actions
  conditions.push(
    sql`${auditLogs.action} IN ('settings_changed', 'admin_action', 'subscription_created', 'subscription_cancelled')`
  );

  const entries = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      action: auditLogs.action,
      resource: auditLogs.resource,
      resourceId: auditLogs.resourceId,
      details: auditLogs.details,
      previousValue: auditLogs.previousValue,
      newValue: auditLogs.newValue,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  return entries;
}
