import 'server-only';
import { cache } from 'react';
import { sql, eq, and, gte, desc, count } from 'drizzle-orm';
import { db, schema } from '../db';
import { requireAdmin } from '../auth/admin';

const { communicationHealthScores, satisfactionSurveys, suggestionFeedback, suggestionMetrics } = schema;

export interface HealthScoreOverview {
  currentScore: number | null;       // Most recent team aggregate
  previousScore: number | null;      // Previous period team aggregate
  changePercent: number | null;      // % change
  totalUsersScored: number;
  insufficientDataUsers: number;     // Users below 5-suggestion threshold
  avgAcceptance: number | null;
  avgResponseTime: number | null;
  avgSentiment: number | null;
  avgSatisfaction: number | null;
  avgEngagement: number | null;
}

export interface HealthScoreTrendPoint {
  date: string;
  healthScore: number;
  acceptanceRate: number | null;
  avgResponseTimeMs: number | null;
  sentimentScore: number | null;
  satisfactionScore: number | null;
  engagementRate: number | null;
}

export interface NPSDistribution {
  promoters: number;
  passives: number;
  detractors: number;
  totalResponses: number;
  npsScore: number;               // % promoters - % detractors
  responseRate: number;           // completed / delivered
}

export interface SurveyStats {
  totalDelivered: number;
  totalCompleted: number;
  totalExpired: number;
  totalDismissed: number;
  avgRating: number | null;
  responseRate: number;
}

export interface BeforeAfterComparison {
  baselineScore: number | null;      // Avg health score during baseline (isBaseline=true)
  currentScore: number | null;       // Avg health score post-baseline (isBaseline=false)
  improvement: number | null;        // currentScore - baselineScore
  improvementPercent: number | null; // ((current - baseline) / baseline) * 100
  baselineWeeks: number;
  currentWeeks: number;
}

export interface ThumbsRatioPoint {
  date: string;
  thumbsUp: number;
  thumbsDown: number;
  total: number;
  ratio: number;                    // thumbsUp / total as 0-100
}

export interface UserHealthScore {
  userId: string;
  healthScore: number | null;
  acceptanceRate: number | null;
  engagementRate: number | null;
  totalSuggestions: number;
  isBaseline: boolean;
  scoreDate: string;
}

/**
 * Get health score overview metrics
 */
export const getHealthScoreOverview = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<HealthScoreOverview> => {
  await requireAdmin();

  // Get most recent team aggregate score (userId IS NULL)
  const recentScoresResult = await db.execute(sql`
    SELECT
      ${communicationHealthScores.healthScore} as health_score,
      ${communicationHealthScores.acceptanceRate} as acceptance_rate,
      ${communicationHealthScores.avgResponseTimeMs} as avg_response_time_ms,
      ${communicationHealthScores.avgSentimentScore} as avg_sentiment_score,
      ${communicationHealthScores.avgSatisfactionScore} as avg_satisfaction_score,
      ${communicationHealthScores.engagementRate} as engagement_rate
    FROM ${communicationHealthScores}
    WHERE ${communicationHealthScores.organizationId} = ${organizationId}
      AND ${communicationHealthScores.workspaceId} = ${workspaceId}
      AND ${communicationHealthScores.userId} IS NULL
    ORDER BY ${communicationHealthScores.scoreDate} DESC
    LIMIT 2
  `);

  const recentScoresRows = Array.isArray(recentScoresResult) ? recentScoresResult : (recentScoresResult as unknown as { rows: unknown[] }).rows ?? [];

  const currentScoreRow = recentScoresRows[0] as {
    health_score: number | null;
    acceptance_rate: number | null;
    avg_response_time_ms: number | null;
    avg_sentiment_score: number | null;
    avg_satisfaction_score: number | null;
    engagement_rate: number | null;
  } | undefined;

  const previousScoreRow = recentScoresRows[1] as {
    health_score: number | null;
  } | undefined;

  const currentScore = currentScoreRow?.health_score ?? null;
  const previousScore = previousScoreRow?.health_score ?? null;
  const changePercent = currentScore !== null && previousScore !== null && previousScore !== 0
    ? ((currentScore - previousScore) / previousScore) * 100
    : null;

  // Count users scored vs insufficient data
  const userCountResult = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE ${communicationHealthScores.userId} IS NOT NULL AND ${communicationHealthScores.totalSuggestions} >= 5) as total_users_scored,
      COUNT(*) FILTER (WHERE ${communicationHealthScores.userId} IS NOT NULL AND ${communicationHealthScores.totalSuggestions} < 5) as insufficient_data_users
    FROM ${communicationHealthScores}
    WHERE ${communicationHealthScores.organizationId} = ${organizationId}
      AND ${communicationHealthScores.workspaceId} = ${workspaceId}
  `);

  const userCountRows = Array.isArray(userCountResult) ? userCountResult : (userCountResult as unknown as { rows: unknown[] }).rows ?? [];
  const userCountRow = userCountRows[0] as {
    total_users_scored: string;
    insufficient_data_users: string;
  } | undefined;

  const totalUsersScored = Number(userCountRow?.total_users_scored || 0);
  const insufficientDataUsers = Number(userCountRow?.insufficient_data_users || 0);

  return {
    currentScore,
    previousScore,
    changePercent,
    totalUsersScored,
    insufficientDataUsers,
    avgAcceptance: currentScoreRow?.acceptance_rate ?? null,
    avgResponseTime: currentScoreRow?.avg_response_time_ms ?? null,
    avgSentiment: currentScoreRow?.avg_sentiment_score ?? null,
    avgSatisfaction: currentScoreRow?.avg_satisfaction_score ?? null,
    avgEngagement: currentScoreRow?.engagement_rate ?? null,
  };
});

/**
 * Get health score trend over time
 */
export const getHealthScoreTrend = cache(async (
  organizationId: string,
  workspaceId: string,
  weeks: number = 12
): Promise<HealthScoreTrendPoint[]> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeks * 7));

  const result = await db.execute(sql`
    SELECT
      ${communicationHealthScores.scoreDate} as score_date,
      ${communicationHealthScores.healthScore} as health_score,
      ${communicationHealthScores.acceptanceRate} as acceptance_rate,
      ${communicationHealthScores.avgResponseTimeMs} as avg_response_time_ms,
      ${communicationHealthScores.avgSentimentScore} as sentiment_score,
      ${communicationHealthScores.avgSatisfactionScore} as satisfaction_score,
      ${communicationHealthScores.engagementRate} as engagement_rate
    FROM ${communicationHealthScores}
    WHERE ${communicationHealthScores.organizationId} = ${organizationId}
      AND ${communicationHealthScores.workspaceId} = ${workspaceId}
      AND ${communicationHealthScores.userId} IS NULL
      AND ${communicationHealthScores.scoreDate} >= ${startDate}
    ORDER BY ${communicationHealthScores.scoreDate} ASC
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  return (rows as Array<{
    score_date: Date;
    health_score: number;
    acceptance_rate: number | null;
    avg_response_time_ms: number | null;
    sentiment_score: number | null;
    satisfaction_score: number | null;
    engagement_rate: number | null;
  }>).map(row => ({
    date: row.score_date instanceof Date ? row.score_date.toISOString().split('T')[0] : String(row.score_date),
    healthScore: Number(row.health_score) || 0,
    acceptanceRate: row.acceptance_rate !== null ? Number(row.acceptance_rate) : null,
    avgResponseTimeMs: row.avg_response_time_ms !== null ? Number(row.avg_response_time_ms) : null,
    sentimentScore: row.sentiment_score !== null ? Number(row.sentiment_score) : null,
    satisfactionScore: row.satisfaction_score !== null ? Number(row.satisfaction_score) : null,
    engagementRate: row.engagement_rate !== null ? Number(row.engagement_rate) : null,
  }));
});

/**
 * Get NPS distribution
 */
export const getNPSDistribution = cache(async (
  organizationId: string,
  days: number = 90
): Promise<NPSDistribution> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE ${satisfactionSurveys.rating} >= 9) as promoters,
      COUNT(*) FILTER (WHERE ${satisfactionSurveys.rating} >= 7 AND ${satisfactionSurveys.rating} <= 8) as passives,
      COUNT(*) FILTER (WHERE ${satisfactionSurveys.rating} <= 6) as detractors,
      COUNT(*) FILTER (WHERE ${satisfactionSurveys.respondedAt} IS NOT NULL) as total_responses,
      COUNT(*) as total_delivered
    FROM ${satisfactionSurveys}
    WHERE ${satisfactionSurveys.organizationId} = ${organizationId}
      AND ${satisfactionSurveys.deliveredAt} >= ${startDate}
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];
  const row = rows[0] as {
    promoters: string;
    passives: string;
    detractors: string;
    total_responses: string;
    total_delivered: string;
  } | undefined;

  if (!row) {
    return {
      promoters: 0,
      passives: 0,
      detractors: 0,
      totalResponses: 0,
      npsScore: 0,
      responseRate: 0,
    };
  }

  const promoters = Number(row.promoters) || 0;
  const passives = Number(row.passives) || 0;
  const detractors = Number(row.detractors) || 0;
  const totalResponses = Number(row.total_responses) || 0;
  const totalDelivered = Number(row.total_delivered) || 0;

  // NPS = % promoters - % detractors
  const npsScore = totalResponses > 0
    ? ((promoters / totalResponses) * 100) - ((detractors / totalResponses) * 100)
    : 0;

  const responseRate = totalDelivered > 0 ? (totalResponses / totalDelivered) * 100 : 0;

  return {
    promoters,
    passives,
    detractors,
    totalResponses,
    npsScore,
    responseRate,
  };
});

/**
 * Get survey statistics
 */
export const getSurveyStats = cache(async (
  organizationId: string,
  days: number = 90
): Promise<SurveyStats> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total_delivered,
      COUNT(*) FILTER (WHERE ${satisfactionSurveys.status} = 'completed') as total_completed,
      COUNT(*) FILTER (WHERE ${satisfactionSurveys.status} = 'expired') as total_expired,
      COUNT(*) FILTER (WHERE ${satisfactionSurveys.status} = 'dismissed') as total_dismissed,
      AVG(${satisfactionSurveys.rating}) FILTER (WHERE ${satisfactionSurveys.status} = 'completed') as avg_rating
    FROM ${satisfactionSurveys}
    WHERE ${satisfactionSurveys.organizationId} = ${organizationId}
      AND ${satisfactionSurveys.deliveredAt} >= ${startDate}
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];
  const row = rows[0] as {
    total_delivered: string;
    total_completed: string;
    total_expired: string;
    total_dismissed: string;
    avg_rating: string | null;
  } | undefined;

  if (!row) {
    return {
      totalDelivered: 0,
      totalCompleted: 0,
      totalExpired: 0,
      totalDismissed: 0,
      avgRating: null,
      responseRate: 0,
    };
  }

  const totalDelivered = Number(row.total_delivered) || 0;
  const totalCompleted = Number(row.total_completed) || 0;
  const totalExpired = Number(row.total_expired) || 0;
  const totalDismissed = Number(row.total_dismissed) || 0;
  const avgRating = row.avg_rating !== null ? Number(row.avg_rating) : null;

  const responseRate = totalDelivered > 0 ? (totalCompleted / totalDelivered) * 100 : 0;

  return {
    totalDelivered,
    totalCompleted,
    totalExpired,
    totalDismissed,
    avgRating,
    responseRate,
  };
});

/**
 * Get before/after comparison (baseline vs post-baseline)
 */
export const getBeforeAfterComparison = cache(async (
  organizationId: string,
  workspaceId: string
): Promise<BeforeAfterComparison> => {
  await requireAdmin();

  // Get baseline scores
  const baselineResult = await db.execute(sql`
    SELECT
      AVG(${communicationHealthScores.healthScore}) as avg_baseline_score,
      COUNT(DISTINCT ${communicationHealthScores.scoreDate}) as baseline_weeks
    FROM ${communicationHealthScores}
    WHERE ${communicationHealthScores.organizationId} = ${organizationId}
      AND ${communicationHealthScores.workspaceId} = ${workspaceId}
      AND ${communicationHealthScores.userId} IS NULL
      AND ${communicationHealthScores.isBaseline} = true
  `);

  const baselineRows = Array.isArray(baselineResult) ? baselineResult : (baselineResult as unknown as { rows: unknown[] }).rows ?? [];
  const baselineRow = baselineRows[0] as {
    avg_baseline_score: string | null;
    baseline_weeks: string;
  } | undefined;

  // Get post-baseline scores
  const currentResult = await db.execute(sql`
    SELECT
      AVG(${communicationHealthScores.healthScore}) as avg_current_score,
      COUNT(DISTINCT ${communicationHealthScores.scoreDate}) as current_weeks
    FROM ${communicationHealthScores}
    WHERE ${communicationHealthScores.organizationId} = ${organizationId}
      AND ${communicationHealthScores.workspaceId} = ${workspaceId}
      AND ${communicationHealthScores.userId} IS NULL
      AND ${communicationHealthScores.isBaseline} = false
  `);

  const currentRows = Array.isArray(currentResult) ? currentResult : (currentResult as unknown as { rows: unknown[] }).rows ?? [];
  const currentRow = currentRows[0] as {
    avg_current_score: string | null;
    current_weeks: string;
  } | undefined;

  const baselineScore = baselineRow?.avg_baseline_score !== null && baselineRow?.avg_baseline_score !== undefined ? Number(baselineRow.avg_baseline_score) : null;
  const currentScore = currentRow?.avg_current_score !== null && currentRow?.avg_current_score !== undefined ? Number(currentRow.avg_current_score) : null;
  const baselineWeeks = baselineRow ? Number(baselineRow.baseline_weeks || 0) : 0;
  const currentWeeks = currentRow ? Number(currentRow.current_weeks || 0) : 0;

  const improvement = baselineScore !== null && currentScore !== null
    ? currentScore - baselineScore
    : null;

  const improvementPercent = baselineScore !== null && currentScore !== null && baselineScore !== 0
    ? ((currentScore - baselineScore) / baselineScore) * 100
    : null;

  return {
    baselineScore,
    currentScore,
    improvement,
    improvementPercent,
    baselineWeeks,
    currentWeeks,
  };
});

/**
 * Get thumbs up/down ratio trend over time
 */
export const getThumbsRatioTrend = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 90
): Promise<ThumbsRatioPoint[]> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      DATE(${suggestionFeedback.createdAt}) as date,
      COUNT(*) FILTER (WHERE ${suggestionFeedback.action} IN ('accepted', 'sent')) as thumbs_up,
      COUNT(*) FILTER (WHERE ${suggestionFeedback.action} = 'dismissed') as thumbs_down,
      COUNT(*) as total
    FROM ${suggestionFeedback}
    WHERE ${suggestionFeedback.workspaceId} = ${workspaceId}
      AND ${suggestionFeedback.createdAt} >= ${startDate}
    GROUP BY DATE(${suggestionFeedback.createdAt})
    ORDER BY date ASC
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  return (rows as Array<{
    date: Date;
    thumbs_up: string;
    thumbs_down: string;
    total: string;
  }>).map(row => {
    const thumbsUp = Number(row.thumbs_up) || 0;
    const thumbsDown = Number(row.thumbs_down) || 0;
    const total = Number(row.total) || 0;
    const ratio = total > 0 ? (thumbsUp / total) * 100 : 0;

    return {
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
      thumbsUp,
      thumbsDown,
      total,
      ratio,
    };
  });
});

/**
 * Get user health scores (most recent per user)
 */
export const getUserHealthScores = cache(async (
  organizationId: string,
  workspaceId: string
): Promise<UserHealthScore[]> => {
  await requireAdmin();

  // Use DISTINCT ON to get most recent score per user
  const result = await db.execute(sql`
    SELECT DISTINCT ON (${communicationHealthScores.userId})
      ${communicationHealthScores.userId} as user_id,
      ${communicationHealthScores.healthScore} as health_score,
      ${communicationHealthScores.acceptanceRate} as acceptance_rate,
      ${communicationHealthScores.engagementRate} as engagement_rate,
      ${communicationHealthScores.totalSuggestions} as total_suggestions,
      ${communicationHealthScores.isBaseline} as is_baseline,
      ${communicationHealthScores.scoreDate} as score_date
    FROM ${communicationHealthScores}
    WHERE ${communicationHealthScores.organizationId} = ${organizationId}
      AND ${communicationHealthScores.workspaceId} = ${workspaceId}
      AND ${communicationHealthScores.userId} IS NOT NULL
    ORDER BY ${communicationHealthScores.userId}, ${communicationHealthScores.scoreDate} DESC
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  const userScores = (rows as Array<{
    user_id: string;
    health_score: number | null;
    acceptance_rate: number | null;
    engagement_rate: number | null;
    total_suggestions: number;
    is_baseline: boolean;
    score_date: Date;
  }>).map(row => ({
    userId: row.user_id,
    healthScore: row.health_score !== null ? Number(row.health_score) : null,
    acceptanceRate: row.acceptance_rate !== null ? Number(row.acceptance_rate) : null,
    engagementRate: row.engagement_rate !== null ? Number(row.engagement_rate) : null,
    totalSuggestions: Number(row.total_suggestions) || 0,
    isBaseline: Boolean(row.is_baseline),
    scoreDate: row.score_date instanceof Date ? row.score_date.toISOString().split('T')[0] : String(row.score_date),
  }));

  // Sort by health score descending (best scores first), null scores last
  return userScores.sort((a, b) => {
    if (a.healthScore === null && b.healthScore === null) return 0;
    if (a.healthScore === null) return 1;
    if (b.healthScore === null) return -1;
    return b.healthScore - a.healthScore;
  });
});
