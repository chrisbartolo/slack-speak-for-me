import { db, organizations, topicClassifications, escalationAlerts, communicationTrends } from '@slack-speak/database';
import { sql, eq, and, gte, lt } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

export interface TrendAggregationResult {
  organizationsProcessed: number;
  trendsCreated: number;
  errors: number;
}

/**
 * Aggregate daily communication trends for all organizations.
 *
 * @param targetDate - The date to aggregate trends for (defaults to yesterday)
 * @returns Summary of aggregation results
 */
export async function aggregateDailyTrends(targetDate?: Date): Promise<TrendAggregationResult> {
  // Calculate date range
  const date = targetDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday if not provided
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  logger.info({ dayStart, dayEnd }, 'Starting daily trend aggregation');

  let organizationsProcessed = 0;
  let trendsCreated = 0;
  let errors = 0;

  try {
    // Fetch all organizations
    const orgs = await db.select({ id: organizations.id }).from(organizations);
    logger.info({ orgCount: orgs.length }, 'Processing organizations for trend aggregation');

    // Process each organization with error isolation
    for (const org of orgs) {
      try {
        await aggregateOrgTrends(org.id, dayStart, dayEnd);
        organizationsProcessed++;
        trendsCreated++;
      } catch (error) {
        logger.error({ error, organizationId: org.id }, 'Failed to aggregate trends for organization');
        errors++;
      }
    }

    logger.info({
      organizationsProcessed,
      trendsCreated,
      errors,
      dayStart,
      dayEnd,
    }, 'Daily trend aggregation completed');

    return { organizationsProcessed, trendsCreated, errors };
  } catch (error) {
    logger.error({ error }, 'Fatal error during trend aggregation');
    throw error;
  }
}

/**
 * Aggregate trends for a single organization
 */
async function aggregateOrgTrends(
  organizationId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<void> {
  // Step 1: Topic distribution
  const topicResult = await db.execute<{
    topic: string;
    count: string;
  }>(sql`
    SELECT topic, COUNT(*) as count
    FROM ${topicClassifications}
    WHERE organization_id = ${organizationId}
      AND created_at >= ${dayStart}
      AND created_at < ${dayEnd}
    GROUP BY topic
  `);

  const topicDistribution: Record<string, number> = {};
  let totalClassifications = 0;

  for (const row of topicResult) {
    const count = parseInt(row.count, 10);
    topicDistribution[row.topic] = count;
    totalClassifications += count;
  }

  // Step 2: Sentiment distribution
  const sentimentResult = await db.execute<{
    tone: string;
    count: string;
  }>(sql`
    SELECT sentiment->>'tone' as tone, COUNT(*) as count
    FROM ${topicClassifications}
    WHERE organization_id = ${organizationId}
      AND created_at >= ${dayStart}
      AND created_at < ${dayEnd}
      AND sentiment IS NOT NULL
    GROUP BY sentiment->>'tone'
  `);

  const sentimentDistribution: Record<string, number> = {};
  for (const row of sentimentResult) {
    if (row.tone) {
      sentimentDistribution[row.tone] = parseInt(row.count, 10);
    }
  }

  // Step 3: Escalation counts
  const escalationResult = await db.execute<{
    severity: string;
    count: string;
  }>(sql`
    SELECT severity, COUNT(*) as count
    FROM ${escalationAlerts}
    WHERE organization_id = ${organizationId}
      AND created_at >= ${dayStart}
      AND created_at < ${dayEnd}
    GROUP BY severity
  `);

  const escalationCounts: Record<string, number> = {};
  for (const row of escalationResult) {
    escalationCounts[row.severity] = parseInt(row.count, 10);
  }

  // Step 4: Channel hotspots (channels with high complaint/escalation ratio)
  const hotspotResult = await db.execute<{
    channel_id: string;
    total_messages: string;
    complaint_count: string;
    escalation_count: string;
  }>(sql`
    SELECT
      channel_id,
      COUNT(*) as total_messages,
      SUM(CASE WHEN topic = 'complaint' THEN 1 ELSE 0 END) as complaint_count,
      SUM(CASE WHEN topic = 'escalation' THEN 1 ELSE 0 END) as escalation_count
    FROM ${topicClassifications}
    WHERE organization_id = ${organizationId}
      AND created_at >= ${dayStart}
      AND created_at < ${dayEnd}
      AND channel_id IS NOT NULL
    GROUP BY channel_id
    HAVING COUNT(*) >= 10
  `);

  const channelHotspots: Array<{ channelId: string; riskScore: number; messageCount: number }> = [];
  for (const row of hotspotResult) {
    const totalMessages = parseInt(row.total_messages, 10);
    const complaintCount = parseInt(row.complaint_count, 10);
    const escalationCount = parseInt(row.escalation_count, 10);
    const hotspotRatio = (complaintCount + escalationCount) / totalMessages;

    if (hotspotRatio > 0.3) {
      channelHotspots.push({
        channelId: row.channel_id,
        riskScore: Math.round(hotspotRatio * 100),
        messageCount: totalMessages,
      });
    }
  }

  // Step 5: Compute average confidence
  const avgConfidenceResult = await db.execute<{
    avg_confidence: string;
  }>(sql`
    SELECT AVG(confidence) as avg_confidence
    FROM ${topicClassifications}
    WHERE organization_id = ${organizationId}
      AND created_at >= ${dayStart}
      AND created_at < ${dayEnd}
      AND confidence IS NOT NULL
  `);

  const avgConfidence = avgConfidenceResult[0]?.avg_confidence
    ? Math.round(parseFloat(avgConfidenceResult[0].avg_confidence))
    : null;

  // Step 6: Upsert into communication_trends
  await db
    .insert(communicationTrends)
    .values({
      organizationId,
      trendDate: dayStart,
      trendPeriod: 'daily',
      topicDistribution,
      sentimentDistribution,
      escalationCounts,
      channelHotspots,
      totalClassifications,
      avgConfidence,
    })
    .onConflictDoUpdate({
      target: [
        communicationTrends.organizationId,
        communicationTrends.trendDate,
        communicationTrends.trendPeriod,
      ],
      set: {
        topicDistribution,
        sentimentDistribution,
        escalationCounts,
        channelHotspots,
        totalClassifications,
        avgConfidence,
      },
    });

  logger.debug({
    organizationId,
    totalClassifications,
    topicCount: Object.keys(topicDistribution).length,
    sentimentCount: Object.keys(sentimentDistribution).length,
    escalationCount: Object.keys(escalationCounts).length,
    hotspotCount: channelHotspots.length,
  }, 'Organization trends aggregated');
}
