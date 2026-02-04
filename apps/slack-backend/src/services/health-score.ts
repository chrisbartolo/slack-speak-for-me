import { db, organizations, workspaces, users, communicationHealthScores, suggestionFeedback, suggestionMetrics, topicClassifications, satisfactionSurveys, usageEvents } from '@slack-speak/database';
import { sql, eq, and, gte, lt, count } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { startOfWeek, subWeeks } from 'date-fns';

interface HealthMetrics {
  acceptanceRate: number | null;      // 0-1, null if no data
  avgResponseTimeMs: number | null;   // milliseconds, null if no data
  avgSentimentScore: number | null;   // 0-1, null if no data
  avgSatisfactionScore: number | null; // 0-10 NPS, null if no surveys
  engagementRate: number | null;      // 0-1, null if no data
  totalSuggestions: number;           // total suggestions in period
}

interface HealthScoreWeights {
  acceptance: number;
  responseTime: number;
  sentiment: number;
  satisfaction: number;
  engagement: number;
}

const DEFAULT_WEIGHTS: HealthScoreWeights = {
  acceptance: 0.25,
  responseTime: 0.20,
  sentiment: 0.20,
  satisfaction: 0.20,
  engagement: 0.15,
};

const MIN_SUGGESTIONS_FOR_SCORE = 5;

/**
 * Calculate health score from metrics
 * Returns 0-100 composite score, or null if insufficient data
 */
export function calculateHealthScore(
  metrics: HealthMetrics,
  weights: HealthScoreWeights = DEFAULT_WEIGHTS
): number | null {
  // Insufficient data check
  if (metrics.totalSuggestions < MIN_SUGGESTIONS_FOR_SCORE) {
    return null;
  }

  // Normalize each metric to 0-100 scale
  const acceptanceScore = metrics.acceptanceRate !== null
    ? metrics.acceptanceRate * 100
    : 50; // neutral default

  // Response time: invert (lower is better), clamp to 60s max
  let responseTimeScore = 50; // neutral default
  if (metrics.avgResponseTimeMs !== null) {
    const clampedMs = Math.max(0, Math.min(metrics.avgResponseTimeMs, 60000));
    responseTimeScore = ((60000 - clampedMs) / 60000) * 100;
  }

  const sentimentScore = metrics.avgSentimentScore !== null
    ? metrics.avgSentimentScore * 100
    : 50;

  const satisfactionScore = metrics.avgSatisfactionScore !== null
    ? metrics.avgSatisfactionScore * 10 // 0-10 to 0-100
    : 50;

  const engagementScore = metrics.engagementRate !== null
    ? metrics.engagementRate * 100
    : 50;

  // Weighted composite
  const healthScore =
    acceptanceScore * weights.acceptance +
    responseTimeScore * weights.responseTime +
    sentimentScore * weights.sentiment +
    satisfactionScore * weights.satisfaction +
    engagementScore * weights.engagement;

  // Clamp to 0-100 and round
  return Math.round(Math.max(0, Math.min(100, healthScore)));
}

/**
 * Fetch weekly metrics for health score calculation
 */
export async function fetchWeeklyMetrics(
  organizationId: string,
  workspaceId: string,
  userId: string | null,
  weekStart: Date,
  weekEnd: Date
): Promise<HealthMetrics> {
  // 1. Acceptance rate from suggestion_feedback
  let acceptanceRate: number | null = null;
  try {
    const feedbackQuery = userId
      ? sql`
          SELECT
            COUNT(*) FILTER (WHERE action = 'accepted') AS accepted_count,
            COUNT(*) AS total_count
          FROM ${suggestionFeedback}
          WHERE workspace_id = ${workspaceId}
            AND user_id = ${userId}
            AND created_at >= ${weekStart}
            AND created_at < ${weekEnd}
        `
      : sql`
          SELECT
            COUNT(*) FILTER (WHERE action = 'accepted') AS accepted_count,
            COUNT(*) AS total_count
          FROM ${suggestionFeedback}
          WHERE workspace_id = ${workspaceId}
            AND created_at >= ${weekStart}
            AND created_at < ${weekEnd}
        `;

    const feedbackResult = await db.execute<{ accepted_count: string; total_count: string }>(feedbackQuery);
    const row = feedbackResult[0];

    if (row) {
      const acceptedCount = parseInt(row.accepted_count, 10);
      const totalCount = parseInt(row.total_count, 10);

      if (totalCount > 0) {
        acceptanceRate = acceptedCount / totalCount;
      }
    }
  } catch (error) {
    logger.warn({ error, organizationId, userId }, 'Failed to fetch acceptance rate');
  }

  // 2. Avg response time from suggestion_metrics
  let avgResponseTimeMs: number | null = null;
  try {
    const metricsQuery = userId
      ? sql`
          SELECT AVG(total_duration_ms) AS avg_duration
          FROM ${suggestionMetrics}
          WHERE organization_id = ${organizationId}
            AND user_id = ${userId}
            AND delivered_at >= ${weekStart}
            AND delivered_at < ${weekEnd}
            AND total_duration_ms IS NOT NULL
        `
      : sql`
          SELECT AVG(total_duration_ms) AS avg_duration
          FROM ${suggestionMetrics}
          WHERE organization_id = ${organizationId}
            AND delivered_at >= ${weekStart}
            AND delivered_at < ${weekEnd}
            AND total_duration_ms IS NOT NULL
        `;

    const metricsResult = await db.execute<{ avg_duration: string | null }>(metricsQuery);
    const row = metricsResult[0];

    if (row && row.avg_duration !== null) {
      avgResponseTimeMs = Math.round(parseFloat(row.avg_duration));
    }
  } catch (error) {
    logger.warn({ error, organizationId, userId }, 'Failed to fetch avg response time');
  }

  // 3. Avg sentiment from topic_classifications
  let avgSentimentScore: number | null = null;
  try {
    const sentimentQuery = userId
      ? sql`
          SELECT AVG(
            CASE
              WHEN sentiment->>'tone' IN ('positive', 'neutral') THEN 1.0
              WHEN sentiment->>'tone' = 'cautious' THEN 0.5
              ELSE 0.0
            END
          ) AS avg_sentiment
          FROM ${topicClassifications}
          WHERE organization_id = ${organizationId}
            AND user_id = ${userId}
            AND created_at >= ${weekStart}
            AND created_at < ${weekEnd}
            AND sentiment IS NOT NULL
        `
      : sql`
          SELECT AVG(
            CASE
              WHEN sentiment->>'tone' IN ('positive', 'neutral') THEN 1.0
              WHEN sentiment->>'tone' = 'cautious' THEN 0.5
              ELSE 0.0
            END
          ) AS avg_sentiment
          FROM ${topicClassifications}
          WHERE organization_id = ${organizationId}
            AND created_at >= ${weekStart}
            AND created_at < ${weekEnd}
            AND sentiment IS NOT NULL
        `;

    const sentimentResult = await db.execute<{ avg_sentiment: string | null }>(sentimentQuery);
    const row = sentimentResult[0];

    if (row && row.avg_sentiment !== null) {
      avgSentimentScore = parseFloat(row.avg_sentiment);
    }
  } catch (error) {
    logger.warn({ error, organizationId, userId }, 'Failed to fetch avg sentiment');
  }

  // 4. Avg satisfaction from satisfaction_surveys
  let avgSatisfactionScore: number | null = null;
  try {
    const satisfactionQuery = userId
      ? sql`
          SELECT AVG(rating) AS avg_rating
          FROM ${satisfactionSurveys}
          WHERE organization_id = ${organizationId}
            AND user_id = ${userId}
            AND status = 'completed'
            AND responded_at >= ${weekStart}
            AND responded_at < ${weekEnd}
        `
      : sql`
          SELECT AVG(rating) AS avg_rating
          FROM ${satisfactionSurveys}
          WHERE organization_id = ${organizationId}
            AND status = 'completed'
            AND responded_at >= ${weekStart}
            AND responded_at < ${weekEnd}
        `;

    const satisfactionResult = await db.execute<{ avg_rating: string | null }>(satisfactionQuery);
    const row = satisfactionResult[0];

    if (row && row.avg_rating !== null) {
      avgSatisfactionScore = parseFloat(row.avg_rating);
    }
  } catch (error) {
    logger.warn({ error, organizationId, userId }, 'Failed to fetch avg satisfaction');
  }

  // 5. Engagement rate from usage_events (working days in week / 5)
  let engagementRate: number | null = null;
  try {
    const engagementQuery = userId
      ? sql`
          SELECT COUNT(DISTINCT DATE(created_at)) AS active_days
          FROM ${usageEvents}
          WHERE organization_id = ${organizationId}
            AND slack_user_id = ${userId}
            AND created_at >= ${weekStart}
            AND created_at < ${weekEnd}
        `
      : sql`
          SELECT COUNT(DISTINCT DATE(created_at)) AS active_days
          FROM ${usageEvents}
          WHERE organization_id = ${organizationId}
            AND created_at >= ${weekStart}
            AND created_at < ${weekEnd}
        `;

    const engagementResult = await db.execute<{ active_days: string }>(engagementQuery);
    const row = engagementResult[0];

    if (row) {
      const activeDays = parseInt(row.active_days, 10);
      engagementRate = Math.min(1.0, activeDays / 5); // clamp to 1.0
    }
  } catch (error) {
    logger.warn({ error, organizationId, userId }, 'Failed to fetch engagement rate');
  }

  // 6. Total suggestions from suggestion_metrics
  let totalSuggestions = 0;
  try {
    const totalQuery = userId
      ? sql`
          SELECT COUNT(*) AS total
          FROM ${suggestionMetrics}
          WHERE organization_id = ${organizationId}
            AND user_id = ${userId}
            AND created_at >= ${weekStart}
            AND created_at < ${weekEnd}
        `
      : sql`
          SELECT COUNT(*) AS total
          FROM ${suggestionMetrics}
          WHERE organization_id = ${organizationId}
            AND created_at >= ${weekStart}
            AND created_at < ${weekEnd}
        `;

    const totalResult = await db.execute<{ total: string }>(totalQuery);
    const row = totalResult[0];

    if (row) {
      totalSuggestions = parseInt(row.total, 10);
    }
  } catch (error) {
    logger.warn({ error, organizationId, userId }, 'Failed to fetch total suggestions');
  }

  return {
    acceptanceRate,
    avgResponseTimeMs,
    avgSentimentScore,
    avgSatisfactionScore,
    engagementRate,
    totalSuggestions,
  };
}

/**
 * Check if this org/user is still in baseline period (first 5 weeks)
 */
export async function isBaselinePeriod(
  organizationId: string,
  userId: string | null
): Promise<boolean> {
  try {
    const existingScores = await db
      .select({ count: count() })
      .from(communicationHealthScores)
      .where(
        and(
          eq(communicationHealthScores.organizationId, organizationId),
          userId ? eq(communicationHealthScores.userId, userId) : sql`${communicationHealthScores.userId} IS NULL`
        )
      );

    const scoreCount = existingScores[0]?.count ?? 0;
    return scoreCount < 5;
  } catch (error) {
    logger.warn({ error, organizationId, userId }, 'Failed to check baseline period');
    return false;
  }
}

/**
 * Compute and store health scores for all orgs/users
 * Called by weekly BullMQ scheduler
 */
export async function computeAndStoreHealthScores(
  weekStartDate?: Date
): Promise<{ orgsProcessed: number; scoresCreated: number; errors: number }> {
  // Default to previous week (Monday-based)
  const weekStart = weekStartDate ?? subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  logger.info({ weekStart, weekEnd }, 'Computing health scores for week');

  let orgsProcessed = 0;
  let scoresCreated = 0;
  let errors = 0;

  try {
    // Fetch all active organizations
    const allOrgs = await db
      .select()
      .from(organizations);

    for (const org of allOrgs) {
      try {
        // Get workspace for org
        const [workspace] = await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.organizationId, org.id))
          .limit(1);

        if (!workspace) {
          logger.warn({ organizationId: org.id }, 'No workspace found for organization');
          continue;
        }

        // Get all users for workspace
        const allUsers = await db
          .select()
          .from(users)
          .where(eq(users.workspaceId, workspace.id));

        // Process each user
        for (const user of allUsers) {
          try {
            const metrics = await fetchWeeklyMetrics(
              org.id,
              workspace.id,
              user.slackUserId,
              weekStart,
              weekEnd
            );

            const score = calculateHealthScore(metrics);

            if (score === null) {
              logger.debug({
                organizationId: org.id,
                userId: user.slackUserId,
                totalSuggestions: metrics.totalSuggestions,
              }, 'Insufficient data for health score');
              continue;
            }

            const isBaseline = await isBaselinePeriod(org.id, user.slackUserId);

            // Insert health score
            await db.insert(communicationHealthScores).values({
              organizationId: org.id,
              workspaceId: workspace.id,
              userId: user.slackUserId,
              scoreDate: weekStart,
              scorePeriod: 'weekly',
              healthScore: score,
              acceptanceRate: metrics.acceptanceRate !== null ? Math.round(metrics.acceptanceRate * 100) : null,
              avgResponseTimeMs: metrics.avgResponseTimeMs,
              avgSentimentScore: metrics.avgSentimentScore !== null ? Math.round(metrics.avgSentimentScore * 100) : null,
              avgSatisfactionScore: metrics.avgSatisfactionScore !== null ? Math.round(metrics.avgSatisfactionScore * 10) : null,
              engagementRate: metrics.engagementRate !== null ? Math.round(metrics.engagementRate * 100) : null,
              totalSuggestions: metrics.totalSuggestions,
              isBaseline,
            });

            scoresCreated++;
            logger.debug({
              organizationId: org.id,
              userId: user.slackUserId,
              score,
              isBaseline,
            }, 'User health score computed');
          } catch (userError) {
            logger.warn({ error: userError, userId: user.slackUserId }, 'Failed to compute user health score');
            errors++;
          }
        }

        // Compute team aggregate (userId = null)
        try {
          const teamMetrics = await fetchWeeklyMetrics(
            org.id,
            workspace.id,
            null,
            weekStart,
            weekEnd
          );

          const teamScore = calculateHealthScore(teamMetrics);

          if (teamScore !== null) {
            const isBaseline = await isBaselinePeriod(org.id, null);

            await db.insert(communicationHealthScores).values({
              organizationId: org.id,
              workspaceId: workspace.id,
              userId: null, // Team aggregate
              scoreDate: weekStart,
              scorePeriod: 'weekly',
              healthScore: teamScore,
              acceptanceRate: teamMetrics.acceptanceRate !== null ? Math.round(teamMetrics.acceptanceRate * 100) : null,
              avgResponseTimeMs: teamMetrics.avgResponseTimeMs,
              avgSentimentScore: teamMetrics.avgSentimentScore !== null ? Math.round(teamMetrics.avgSentimentScore * 100) : null,
              avgSatisfactionScore: teamMetrics.avgSatisfactionScore !== null ? Math.round(teamMetrics.avgSatisfactionScore * 10) : null,
              engagementRate: teamMetrics.engagementRate !== null ? Math.round(teamMetrics.engagementRate * 100) : null,
              totalSuggestions: teamMetrics.totalSuggestions,
              isBaseline,
            });

            scoresCreated++;
            logger.debug({
              organizationId: org.id,
              teamScore,
              isBaseline,
            }, 'Team aggregate health score computed');
          }
        } catch (teamError) {
          logger.warn({ error: teamError, organizationId: org.id }, 'Failed to compute team health score');
          errors++;
        }

        orgsProcessed++;
      } catch (orgError) {
        logger.error({ error: orgError, organizationId: org.id }, 'Failed to process organization');
        errors++;
      }
    }

    logger.info({
      orgsProcessed,
      scoresCreated,
      errors,
      weekStart,
      weekEnd,
    }, 'Health score computation completed');

    return { orgsProcessed, scoresCreated, errors };
  } catch (error) {
    logger.error({ error }, 'Failed to compute health scores');
    throw error;
  }
}
