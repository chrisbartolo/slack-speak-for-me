import 'server-only';
import { cache } from 'react';
import { sql, eq, and, gte, count, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { requireAdmin } from '../auth/admin';

const { suggestionFeedback, users } = schema;

export interface TeamMetrics {
  totalSuggestions: number;
  acceptedCount: number;
  refinedCount: number;
  dismissedCount: number;
  acceptanceRate: number;
  refinementRate: number;
  dismissalRate: number;
  activeUsers: number;
  totalUsers: number;
  adoptionRate: number;
  estimatedTimeSavedMinutes: number;
}

export interface AdoptionTrendPoint {
  month: string;
  activeUsers: number;
  totalSuggestions: number;
  acceptanceRate: number;
}

export interface UserMetric {
  userId: string;
  email: string | null;
  suggestionCount: number;
  acceptedCount: number;
  refinedCount: number;
  dismissedCount: number;
  lastActive: Date | null;
}

export interface ActionBreakdown {
  action: string;
  count: number;
}

/**
 * Get team-wide analytics metrics
 */
export const getTeamMetrics = cache(async (organizationId: string, workspaceId: string): Promise<TeamMetrics> => {
  await requireAdmin();

  // Calculate 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get aggregated metrics
  const [metrics] = await db
    .select({
      totalSuggestions: count(),
      acceptedCount: sql<number>`COUNT(*) FILTER (WHERE ${suggestionFeedback.action} = 'accepted')`,
      refinedCount: sql<number>`COUNT(*) FILTER (WHERE ${suggestionFeedback.action} = 'refined')`,
      dismissedCount: sql<number>`COUNT(*) FILTER (WHERE ${suggestionFeedback.action} = 'dismissed')`,
      totalCharacters: sql<number>`SUM(CASE WHEN ${suggestionFeedback.action} IN ('accepted', 'refined') THEN LENGTH(COALESCE(${suggestionFeedback.finalText}, ${suggestionFeedback.originalText})) ELSE 0 END)`,
    })
    .from(suggestionFeedback)
    .where(eq(suggestionFeedback.workspaceId, workspaceId));

  // Get active users (users who generated suggestions in last 30 days)
  const [activeUsersResult] = await db
    .select({
      activeUsers: sql<number>`COUNT(DISTINCT ${suggestionFeedback.userId})`,
    })
    .from(suggestionFeedback)
    .where(
      and(
        eq(suggestionFeedback.workspaceId, workspaceId),
        gte(suggestionFeedback.createdAt, thirtyDaysAgo)
      )
    );

  // Get total users
  const [totalUsersResult] = await db
    .select({
      totalUsers: count(),
    })
    .from(users)
    .where(eq(users.workspaceId, workspaceId));

  const totalSuggestions = metrics.totalSuggestions || 0;
  const acceptedCount = Number(metrics.acceptedCount) || 0;
  const refinedCount = Number(metrics.refinedCount) || 0;
  const dismissedCount = Number(metrics.dismissedCount) || 0;
  const totalCharacters = Number(metrics.totalCharacters) || 0;
  const activeUsers = Number(activeUsersResult.activeUsers) || 0;
  const totalUsers = totalUsersResult.totalUsers || 0;

  // Calculate rates
  const acceptanceRate = totalSuggestions > 0 ? (acceptedCount / totalSuggestions) * 100 : 0;
  const refinementRate = totalSuggestions > 0 ? (refinedCount / totalSuggestions) * 100 : 0;
  const dismissalRate = totalSuggestions > 0 ? (dismissedCount / totalSuggestions) * 100 : 0;
  const adoptionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

  // Estimate time saved: 200 chars per min (40 WPM * 5 chars per word)
  const estimatedTimeSavedMinutes = Math.round(totalCharacters / 200);

  return {
    totalSuggestions,
    acceptedCount,
    refinedCount,
    dismissedCount,
    acceptanceRate,
    refinementRate,
    dismissalRate,
    activeUsers,
    totalUsers,
    adoptionRate,
    estimatedTimeSavedMinutes,
  };
});

/**
 * Get monthly adoption trend over time
 */
export const getAdoptionTrend = cache(async (
  organizationId: string,
  workspaceId: string,
  months: number = 6
): Promise<AdoptionTrendPoint[]> => {
  await requireAdmin();

  // Calculate date N months ago
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const results = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', ${suggestionFeedback.createdAt}), 'YYYY-MM') as month,
      COUNT(DISTINCT ${suggestionFeedback.userId}) as active_users,
      COUNT(*) as total_suggestions,
      COUNT(*) FILTER (WHERE ${suggestionFeedback.action} = 'accepted') as accepted_count
    FROM ${suggestionFeedback}
    WHERE ${suggestionFeedback.workspaceId} = ${workspaceId}
      AND ${suggestionFeedback.createdAt} >= ${startDate}
      AND ${suggestionFeedback.createdAt} IS NOT NULL
    GROUP BY DATE_TRUNC('month', ${suggestionFeedback.createdAt})
    ORDER BY month ASC
  `);

  // db.execute returns array-like result with postgres-js
  const rows = Array.isArray(results) ? results : (results as unknown as { rows: unknown[] }).rows ?? [];

  return (rows as Array<{
    month: string;
    active_users: string;
    total_suggestions: string;
    accepted_count: string;
  }>).map(row => ({
    month: row.month,
    activeUsers: Number(row.active_users),
    totalSuggestions: Number(row.total_suggestions),
    acceptanceRate: Number(row.total_suggestions) > 0
      ? (Number(row.accepted_count) / Number(row.total_suggestions)) * 100
      : 0,
  }));
});

/**
 * Get per-user metrics breakdown
 */
export const getUserMetrics = cache(async (
  organizationId: string,
  workspaceId: string
): Promise<UserMetric[]> => {
  await requireAdmin();

  const results = await db
    .select({
      userId: suggestionFeedback.userId,
      email: users.email,
      suggestionCount: count(),
      acceptedCount: sql<number>`COUNT(*) FILTER (WHERE ${suggestionFeedback.action} = 'accepted')`,
      refinedCount: sql<number>`COUNT(*) FILTER (WHERE ${suggestionFeedback.action} = 'refined')`,
      dismissedCount: sql<number>`COUNT(*) FILTER (WHERE ${suggestionFeedback.action} = 'dismissed')`,
      lastActive: sql<Date>`MAX(${suggestionFeedback.createdAt})`,
    })
    .from(suggestionFeedback)
    .leftJoin(users, and(
      eq(users.workspaceId, suggestionFeedback.workspaceId),
      eq(users.slackUserId, suggestionFeedback.userId)
    ))
    .where(eq(suggestionFeedback.workspaceId, workspaceId))
    .groupBy(suggestionFeedback.userId, users.email)
    .orderBy(desc(sql`COUNT(*)`));

  return results.map(row => ({
    userId: row.userId,
    email: row.email,
    suggestionCount: row.suggestionCount,
    acceptedCount: Number(row.acceptedCount),
    refinedCount: Number(row.refinedCount),
    dismissedCount: Number(row.dismissedCount),
    lastActive: row.lastActive,
  }));
});

/**
 * Get action breakdown for donut chart
 */
export const getActionBreakdown = cache(async (
  organizationId: string,
  workspaceId: string
): Promise<ActionBreakdown[]> => {
  await requireAdmin();

  const results = await db
    .select({
      action: suggestionFeedback.action,
      count: count(),
    })
    .from(suggestionFeedback)
    .where(eq(suggestionFeedback.workspaceId, workspaceId))
    .groupBy(suggestionFeedback.action)
    .orderBy(desc(count()));

  return results.map(row => ({
    action: row.action,
    count: row.count,
  }));
});
