import 'server-only';
import { cache } from 'react';
import { sql, eq, and, gte, count, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { requireAdmin } from '../auth/admin';

const { suggestionMetrics } = schema;

export interface ResponseTimeOverview {
  totalSuggestions: number;
  completedSuggestions: number; // have both eventReceivedAt and deliveredAt
  avgTotalMs: number;
  medianTotalMs: number;
  p95TotalMs: number;
  avgAiMs: number;
  avgQueueMs: number;
  avgDeliveryMs: number;
  timeSavedMinutes: number; // estimate vs manual (assume 5 min manual per message)
  errorCount: number;
}

export interface ResponseTimeTrendPoint {
  date: string;
  p50Ms: number;
  p95Ms: number;
  avgMs: number;
  count: number;
}

export interface ChannelMetric {
  channelId: string;
  count: number;
  avgMs: number;
  p95Ms: number;
}

export interface UserMetric {
  userId: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  lastActive: string | null;
}

export interface SLACompliance {
  thresholdMs: number;
  totalDelivered: number;
  withinSLA: number;
  complianceRate: number; // percentage 0-100
}

export interface DetailedMetricRow {
  suggestionId: string;
  userId: string;
  channelId: string | null;
  triggerType: string | null;
  eventReceivedAt: string | null;
  deliveredAt: string | null;
  totalDurationMs: number | null;
  aiProcessingMs: number | null;
  queueDelayMs: number | null;
  userAction: string | null;
  errorType: string | null;
  createdAt: string;
}

/**
 * Get response time overview metrics
 */
export const getResponseTimeOverview = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<ResponseTimeOverview> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total_suggestions,
      COUNT(*) FILTER (WHERE ${suggestionMetrics.deliveredAt} IS NOT NULL AND ${suggestionMetrics.eventReceivedAt} IS NOT NULL) as completed_suggestions,
      AVG(${suggestionMetrics.totalDurationMs}) FILTER (WHERE ${suggestionMetrics.totalDurationMs} IS NOT NULL) as avg_total_ms,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${suggestionMetrics.totalDurationMs}) FILTER (WHERE ${suggestionMetrics.totalDurationMs} IS NOT NULL) as median_total_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${suggestionMetrics.totalDurationMs}) FILTER (WHERE ${suggestionMetrics.totalDurationMs} IS NOT NULL) as p95_total_ms,
      AVG(${suggestionMetrics.aiProcessingMs}) FILTER (WHERE ${suggestionMetrics.aiProcessingMs} IS NOT NULL) as avg_ai_ms,
      AVG(${suggestionMetrics.queueDelayMs}) FILTER (WHERE ${suggestionMetrics.queueDelayMs} IS NOT NULL) as avg_queue_ms,
      COUNT(*) FILTER (WHERE ${suggestionMetrics.errorType} IS NOT NULL) as error_count
    FROM ${suggestionMetrics}
    WHERE ${suggestionMetrics.workspaceId} = ${workspaceId}
      AND ${suggestionMetrics.createdAt} >= ${startDate}
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];
  const row = rows[0] as {
    total_suggestions: string;
    completed_suggestions: string;
    avg_total_ms: string | null;
    median_total_ms: string | null;
    p95_total_ms: string | null;
    avg_ai_ms: string | null;
    avg_queue_ms: string | null;
    error_count: string;
  } | undefined;

  if (!row) {
    return {
      totalSuggestions: 0,
      completedSuggestions: 0,
      avgTotalMs: 0,
      medianTotalMs: 0,
      p95TotalMs: 0,
      avgAiMs: 0,
      avgQueueMs: 0,
      avgDeliveryMs: 0,
      timeSavedMinutes: 0,
      errorCount: 0,
    };
  }

  const totalSuggestions = Number(row.total_suggestions) || 0;
  const completedSuggestions = Number(row.completed_suggestions) || 0;
  const avgTotalMs = Number(row.avg_total_ms) || 0;
  const medianTotalMs = Number(row.median_total_ms) || 0;
  const p95TotalMs = Number(row.p95_total_ms) || 0;
  const avgAiMs = Number(row.avg_ai_ms) || 0;
  const avgQueueMs = Number(row.avg_queue_ms) || 0;
  const errorCount = Number(row.error_count) || 0;

  // Calculate avg delivery time as total - ai - queue
  const avgDeliveryMs = Math.max(0, avgTotalMs - avgAiMs - avgQueueMs);

  // Time saved: completedSuggestions * 5 minutes (assumes 5 min manual per message, AI provides instant draft)
  const timeSavedMinutes = completedSuggestions * 5;

  return {
    totalSuggestions,
    completedSuggestions,
    avgTotalMs,
    medianTotalMs,
    p95TotalMs,
    avgAiMs,
    avgQueueMs,
    avgDeliveryMs,
    timeSavedMinutes,
    errorCount,
  };
});

/**
 * Get response time trend over time
 */
export const getResponseTimeTrend = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<ResponseTimeTrendPoint[]> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      DATE(${suggestionMetrics.createdAt}) as date,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${suggestionMetrics.totalDurationMs}) as p50_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${suggestionMetrics.totalDurationMs}) as p95_ms,
      AVG(${suggestionMetrics.totalDurationMs}) as avg_ms,
      COUNT(*) as count
    FROM ${suggestionMetrics}
    WHERE ${suggestionMetrics.workspaceId} = ${workspaceId}
      AND ${suggestionMetrics.createdAt} >= ${startDate}
      AND ${suggestionMetrics.totalDurationMs} IS NOT NULL
    GROUP BY DATE(${suggestionMetrics.createdAt})
    ORDER BY date ASC
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  return (rows as Array<{
    date: Date;
    p50_ms: string | null;
    p95_ms: string | null;
    avg_ms: string | null;
    count: string;
  }>).map(row => ({
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
    p50Ms: Number(row.p50_ms) || 0,
    p95Ms: Number(row.p95_ms) || 0,
    avgMs: Number(row.avg_ms) || 0,
    count: Number(row.count) || 0,
  }));
});

/**
 * Get per-channel response time metrics
 */
export const getPerChannelMetrics = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<ChannelMetric[]> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      ${suggestionMetrics.channelId} as channel_id,
      COUNT(*) as count,
      AVG(${suggestionMetrics.totalDurationMs}) as avg_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${suggestionMetrics.totalDurationMs}) as p95_ms
    FROM ${suggestionMetrics}
    WHERE ${suggestionMetrics.workspaceId} = ${workspaceId}
      AND ${suggestionMetrics.createdAt} >= ${startDate}
      AND ${suggestionMetrics.totalDurationMs} IS NOT NULL
      AND ${suggestionMetrics.channelId} IS NOT NULL
    GROUP BY ${suggestionMetrics.channelId}
    ORDER BY count DESC
    LIMIT 20
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  return (rows as Array<{
    channel_id: string;
    count: string;
    avg_ms: string | null;
    p95_ms: string | null;
  }>).map(row => ({
    channelId: row.channel_id,
    count: Number(row.count) || 0,
    avgMs: Number(row.avg_ms) || 0,
    p95Ms: Number(row.p95_ms) || 0,
  }));
});

/**
 * Get per-user response time metrics
 */
export const getPerUserMetrics = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<UserMetric[]> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      ${suggestionMetrics.userId} as user_id,
      COUNT(*) as count,
      AVG(${suggestionMetrics.totalDurationMs}) as avg_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${suggestionMetrics.totalDurationMs}) as p95_ms,
      MAX(${suggestionMetrics.createdAt}) as last_active
    FROM ${suggestionMetrics}
    WHERE ${suggestionMetrics.workspaceId} = ${workspaceId}
      AND ${suggestionMetrics.createdAt} >= ${startDate}
      AND ${suggestionMetrics.totalDurationMs} IS NOT NULL
    GROUP BY ${suggestionMetrics.userId}
    ORDER BY count DESC
    LIMIT 20
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  return (rows as Array<{
    user_id: string;
    count: string;
    avg_ms: string | null;
    p95_ms: string | null;
    last_active: Date | null;
  }>).map(row => ({
    userId: row.user_id,
    count: Number(row.count) || 0,
    avgMs: Number(row.avg_ms) || 0,
    p95Ms: Number(row.p95_ms) || 0,
    lastActive: row.last_active ? row.last_active.toISOString() : null,
  }));
});

/**
 * Get SLA compliance metrics
 */
export const getSLACompliance = cache(async (
  organizationId: string,
  workspaceId: string,
  thresholdMs: number = 10000,
  days: number = 30
): Promise<SLACompliance> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE ${suggestionMetrics.deliveredAt} IS NOT NULL) as total_delivered,
      COUNT(*) FILTER (WHERE ${suggestionMetrics.deliveredAt} IS NOT NULL AND ${suggestionMetrics.totalDurationMs} <= ${thresholdMs}) as within_sla
    FROM ${suggestionMetrics}
    WHERE ${suggestionMetrics.workspaceId} = ${workspaceId}
      AND ${suggestionMetrics.createdAt} >= ${startDate}
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];
  const row = rows[0] as {
    total_delivered: string;
    within_sla: string;
  } | undefined;

  if (!row) {
    return {
      thresholdMs,
      totalDelivered: 0,
      withinSLA: 0,
      complianceRate: 0,
    };
  }

  const totalDelivered = Number(row.total_delivered) || 0;
  const withinSLA = Number(row.within_sla) || 0;
  const complianceRate = totalDelivered > 0 ? (withinSLA / totalDelivered) * 100 : 0;

  return {
    thresholdMs,
    totalDelivered,
    withinSLA,
    complianceRate,
  };
});

/**
 * Get detailed metrics for CSV export
 */
export const getDetailedMetrics = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 90
): Promise<DetailedMetricRow[]> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const results = await db
    .select({
      suggestionId: suggestionMetrics.suggestionId,
      userId: suggestionMetrics.userId,
      channelId: suggestionMetrics.channelId,
      triggerType: suggestionMetrics.triggerType,
      eventReceivedAt: suggestionMetrics.eventReceivedAt,
      deliveredAt: suggestionMetrics.deliveredAt,
      totalDurationMs: suggestionMetrics.totalDurationMs,
      aiProcessingMs: suggestionMetrics.aiProcessingMs,
      queueDelayMs: suggestionMetrics.queueDelayMs,
      userAction: suggestionMetrics.userAction,
      errorType: suggestionMetrics.errorType,
      createdAt: suggestionMetrics.createdAt,
    })
    .from(suggestionMetrics)
    .where(
      and(
        eq(suggestionMetrics.workspaceId, workspaceId),
        gte(suggestionMetrics.createdAt, startDate)
      )
    )
    .orderBy(desc(suggestionMetrics.createdAt))
    .limit(10000);

  return results.map(row => ({
    suggestionId: row.suggestionId,
    userId: row.userId,
    channelId: row.channelId,
    triggerType: row.triggerType,
    eventReceivedAt: row.eventReceivedAt ? row.eventReceivedAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    totalDurationMs: row.totalDurationMs,
    aiProcessingMs: row.aiProcessingMs,
    queueDelayMs: row.queueDelayMs,
    userAction: row.userAction,
    errorType: row.errorType,
    createdAt: row.createdAt.toISOString(),
  }));
});
