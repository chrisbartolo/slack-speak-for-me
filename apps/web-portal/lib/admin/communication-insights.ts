import 'server-only';
import { cache } from 'react';
import { sql, eq, and, gte, lt, count, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { requireAdmin } from '../auth/admin';

const { topicClassifications, communicationTrends, escalationAlerts, clientProfiles, clientContacts } = schema;

export interface TopicOverview {
  topics: Array<{
    topic: string;
    count: number;
    percentage: number;
  }>;
  totalClassifications: number;
  avgConfidence: number;
}

export interface TopicTrendPoint {
  date: string;
  scheduling: number;
  complaint: number;
  technical: number;
  status_update: number;
  request: number;
  escalation: number;
  general: number;
}

export interface SentimentTrendPoint {
  date: string;
  positive: number;
  neutral: number;
  tense: number;
  frustrated: number;
  angry: number;
}

export interface ChannelHotspot {
  channelId: string;
  totalMessages: number;
  complaintCount: number;
  escalationCount: number;
  complaintRate: number;
  riskScore: number;
}

export interface PeriodComparison {
  current: {
    totalSuggestions: number;
    topicCounts: Record<string, number>;
    escalationCount: number;
    topComplaintChannels: string[];
  };
  previous: {
    totalSuggestions: number;
    topicCounts: Record<string, number>;
    escalationCount: number;
    topComplaintChannels: string[];
  };
  changes: {
    totalSuggestionsChange: number;
    escalationChange: number;
    topicChanges: Record<string, number>;
  };
  warnings: string[];
}

export interface EscalationSummary {
  total: number;
  bySeverity: Record<string, number>;
  openCount: number;
  resolvedCount: number;
  avgResolutionHours: number | null;
}

export interface ClientInsight {
  clientProfileId: string;
  clientName: string;
  totalMessages: number;
  topTopic: string;
  topicBreakdown: Record<string, number>;
  complaintRate: number;
  escalationCount: number;
  dominantSentiment: string;
}

/**
 * Get topic overview metrics
 */
export const getTopicOverview = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<TopicOverview> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      ${topicClassifications.topic} as topic,
      COUNT(*) as count,
      AVG(${topicClassifications.confidence}) as avg_confidence
    FROM ${topicClassifications}
    WHERE ${topicClassifications.organizationId} = ${organizationId}
      AND ${topicClassifications.createdAt} >= ${startDate}
    GROUP BY ${topicClassifications.topic}
    ORDER BY count DESC
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  const typedRows = rows as Array<{
    topic: string;
    count: string;
    avg_confidence: string | null;
  }>;

  // Calculate total for percentages
  const totalClassifications = typedRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const avgConfidenceSum = typedRows.reduce((sum, row) => sum + (Number(row.avg_confidence || 0) * Number(row.count || 0)), 0);
  const avgConfidence = totalClassifications > 0 ? avgConfidenceSum / totalClassifications : 0;

  const topics = typedRows.map(row => {
    const rowCount = Number(row.count) || 0;
    return {
      topic: row.topic,
      count: rowCount,
      percentage: totalClassifications > 0 ? (rowCount / totalClassifications) * 100 : 0,
    };
  });

  return {
    topics,
    totalClassifications,
    avgConfidence,
  };
});

/**
 * Get topic trend over time
 */
export const getTopicTrend = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<TopicTrendPoint[]> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      DATE(${topicClassifications.createdAt}) as date,
      ${topicClassifications.topic} as topic,
      COUNT(*) as count
    FROM ${topicClassifications}
    WHERE ${topicClassifications.organizationId} = ${organizationId}
      AND ${topicClassifications.createdAt} >= ${startDate}
    GROUP BY DATE(${topicClassifications.createdAt}), ${topicClassifications.topic}
    ORDER BY date ASC
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  // Pivot results into TopicTrendPoint array (one row per date with all 7 topic counts)
  const dateMap = new Map<string, TopicTrendPoint>();

  for (const row of rows as Array<{ date: Date; topic: string; count: string }>) {
    const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);

    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, {
        date: dateStr,
        scheduling: 0,
        complaint: 0,
        technical: 0,
        status_update: 0,
        request: 0,
        escalation: 0,
        general: 0,
      });
    }

    const trendPoint = dateMap.get(dateStr)!;
    const topicCount = Number(row.count) || 0;

    // Map topic to the right field
    switch (row.topic) {
      case 'scheduling':
        trendPoint.scheduling = topicCount;
        break;
      case 'complaint':
        trendPoint.complaint = topicCount;
        break;
      case 'technical':
        trendPoint.technical = topicCount;
        break;
      case 'status_update':
        trendPoint.status_update = topicCount;
        break;
      case 'request':
        trendPoint.request = topicCount;
        break;
      case 'escalation':
        trendPoint.escalation = topicCount;
        break;
      case 'general':
        trendPoint.general = topicCount;
        break;
    }
  }

  // Convert map to sorted array
  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
});

/**
 * Get sentiment trend over time
 */
export const getSentimentTrend = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<SentimentTrendPoint[]> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      DATE(${topicClassifications.createdAt}) as date,
      ${topicClassifications.sentiment}->>'tone' as tone,
      COUNT(*) as count
    FROM ${topicClassifications}
    WHERE ${topicClassifications.organizationId} = ${organizationId}
      AND ${topicClassifications.createdAt} >= ${startDate}
      AND ${topicClassifications.sentiment} IS NOT NULL
    GROUP BY DATE(${topicClassifications.createdAt}), ${topicClassifications.sentiment}->>'tone'
    ORDER BY date ASC
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  // Pivot results into SentimentTrendPoint array (one row per date with all 5 tone counts)
  const dateMap = new Map<string, SentimentTrendPoint>();

  for (const row of rows as Array<{ date: Date; tone: string | null; count: string }>) {
    const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);

    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, {
        date: dateStr,
        positive: 0,
        neutral: 0,
        tense: 0,
        frustrated: 0,
        angry: 0,
      });
    }

    const trendPoint = dateMap.get(dateStr)!;
    const toneCount = Number(row.count) || 0;

    // Map tone to the right field
    switch (row.tone) {
      case 'positive':
        trendPoint.positive = toneCount;
        break;
      case 'neutral':
        trendPoint.neutral = toneCount;
        break;
      case 'tense':
        trendPoint.tense = toneCount;
        break;
      case 'frustrated':
        trendPoint.frustrated = toneCount;
        break;
      case 'angry':
        trendPoint.angry = toneCount;
        break;
    }
  }

  // Convert map to sorted array
  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
});

/**
 * Get channel hotspots with high complaint/escalation rates
 */
export const getChannelHotspots = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 7
): Promise<ChannelHotspot[]> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      ${topicClassifications.channelId} as channel_id,
      COUNT(*) as total_messages,
      COUNT(*) FILTER (WHERE ${topicClassifications.topic} = 'complaint') as complaint_count,
      COUNT(*) FILTER (WHERE ${topicClassifications.topic} = 'escalation') as escalation_count
    FROM ${topicClassifications}
    WHERE ${topicClassifications.organizationId} = ${organizationId}
      AND ${topicClassifications.createdAt} >= ${startDate}
      AND ${topicClassifications.channelId} IS NOT NULL
    GROUP BY ${topicClassifications.channelId}
    HAVING COUNT(*) >= 10
    ORDER BY (COUNT(*) FILTER (WHERE ${topicClassifications.topic} IN ('complaint', 'escalation'))) DESC
    LIMIT 20
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  return (rows as Array<{
    channel_id: string;
    total_messages: string;
    complaint_count: string;
    escalation_count: string;
  }>).map(row => {
    const totalMessages = Number(row.total_messages) || 0;
    const complaintCount = Number(row.complaint_count) || 0;
    const escalationCount = Number(row.escalation_count) || 0;
    const complaintRate = totalMessages > 0 ? (complaintCount / totalMessages) * 100 : 0;

    // Risk score: weighted sum of complaint rate and escalation count
    const riskScore = (complaintRate * 0.7) + (escalationCount * 3);

    return {
      channelId: row.channel_id,
      totalMessages,
      complaintCount,
      escalationCount,
      complaintRate,
      riskScore,
    };
  });
});

/**
 * Get week-over-week comparison
 */
export const getWeekOverWeek = cache(async (
  organizationId: string,
  workspaceId: string
): Promise<PeriodComparison> => {
  await requireAdmin();

  // Calculate week boundaries (Monday-based)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0 days back, Sunday = 6 days back

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - daysToMonday);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  const lastWeekEnd = new Date(thisWeekStart);

  // Query current week
  const currentResult = await db.execute(sql`
    SELECT
      ${topicClassifications.topic} as topic,
      COUNT(*) as count
    FROM ${topicClassifications}
    WHERE ${topicClassifications.organizationId} = ${organizationId}
      AND ${topicClassifications.createdAt} >= ${thisWeekStart}
    GROUP BY ${topicClassifications.topic}
  `);

  const currentRows = Array.isArray(currentResult) ? currentResult : (currentResult as unknown as { rows: unknown[] }).rows ?? [];

  // Query previous week
  const previousResult = await db.execute(sql`
    SELECT
      ${topicClassifications.topic} as topic,
      COUNT(*) as count
    FROM ${topicClassifications}
    WHERE ${topicClassifications.organizationId} = ${organizationId}
      AND ${topicClassifications.createdAt} >= ${lastWeekStart}
      AND ${topicClassifications.createdAt} < ${lastWeekEnd}
    GROUP BY ${topicClassifications.topic}
  `);

  const previousRows = Array.isArray(previousResult) ? previousResult : (previousResult as unknown as { rows: unknown[] }).rows ?? [];

  // Query escalation counts for both periods
  const currentEscalationResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${escalationAlerts}
    WHERE ${escalationAlerts.organizationId} = ${organizationId}
      AND ${escalationAlerts.createdAt} >= ${thisWeekStart}
  `);

  const currentEscalationRows = Array.isArray(currentEscalationResult) ? currentEscalationResult : (currentEscalationResult as unknown as { rows: unknown[] }).rows ?? [];
  const currentEscalationCount = Number((currentEscalationRows[0] as any)?.count || 0);

  const previousEscalationResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${escalationAlerts}
    WHERE ${escalationAlerts.organizationId} = ${organizationId}
      AND ${escalationAlerts.createdAt} >= ${lastWeekStart}
      AND ${escalationAlerts.createdAt} < ${lastWeekEnd}
  `);

  const previousEscalationRows = Array.isArray(previousEscalationResult) ? previousEscalationResult : (previousEscalationResult as unknown as { rows: unknown[] }).rows ?? [];
  const previousEscalationCount = Number((previousEscalationRows[0] as any)?.count || 0);

  // Query top complaint channels for both periods
  const currentComplaintChannelsResult = await db.execute(sql`
    SELECT ${topicClassifications.channelId} as channel_id
    FROM ${topicClassifications}
    WHERE ${topicClassifications.organizationId} = ${organizationId}
      AND ${topicClassifications.createdAt} >= ${thisWeekStart}
      AND ${topicClassifications.topic} = 'complaint'
      AND ${topicClassifications.channelId} IS NOT NULL
    GROUP BY ${topicClassifications.channelId}
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `);

  const currentComplaintChannelsRows = Array.isArray(currentComplaintChannelsResult) ? currentComplaintChannelsResult : (currentComplaintChannelsResult as unknown as { rows: unknown[] }).rows ?? [];
  const currentTopComplaintChannels = (currentComplaintChannelsRows as Array<{ channel_id: string }>).map(row => row.channel_id);

  const previousComplaintChannelsResult = await db.execute(sql`
    SELECT ${topicClassifications.channelId} as channel_id
    FROM ${topicClassifications}
    WHERE ${topicClassifications.organizationId} = ${organizationId}
      AND ${topicClassifications.createdAt} >= ${lastWeekStart}
      AND ${topicClassifications.createdAt} < ${lastWeekEnd}
      AND ${topicClassifications.topic} = 'complaint'
      AND ${topicClassifications.channelId} IS NOT NULL
    GROUP BY ${topicClassifications.channelId}
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `);

  const previousComplaintChannelsRows = Array.isArray(previousComplaintChannelsResult) ? previousComplaintChannelsResult : (previousComplaintChannelsResult as unknown as { rows: unknown[] }).rows ?? [];
  const previousTopComplaintChannels = (previousComplaintChannelsRows as Array<{ channel_id: string }>).map(row => row.channel_id);

  // Build topic counts
  const currentTopicCounts: Record<string, number> = {};
  let currentTotal = 0;
  for (const row of currentRows as Array<{ topic: string; count: string }>) {
    const topicCount = Number(row.count) || 0;
    currentTopicCounts[row.topic] = topicCount;
    currentTotal += topicCount;
  }

  const previousTopicCounts: Record<string, number> = {};
  let previousTotal = 0;
  for (const row of previousRows as Array<{ topic: string; count: string }>) {
    const topicCount = Number(row.count) || 0;
    previousTopicCounts[row.topic] = topicCount;
    previousTotal += topicCount;
  }

  // Calculate changes
  const totalSuggestionsChange = previousTotal > 0
    ? ((currentTotal - previousTotal) / previousTotal) * 100
    : 0;

  const escalationChange = previousEscalationCount > 0
    ? ((currentEscalationCount - previousEscalationCount) / previousEscalationCount) * 100
    : 0;

  const topicChanges: Record<string, number> = {};
  const allTopics = new Set([...Object.keys(currentTopicCounts), ...Object.keys(previousTopicCounts)]);

  for (const topic of allTopics) {
    const current = currentTopicCounts[topic] || 0;
    const previous = previousTopicCounts[topic] || 0;
    topicChanges[topic] = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  }

  // Add warnings if current week has < 3 days
  const warnings: string[] = [];
  const daysIntoCurrentWeek = Math.ceil((now.getTime() - thisWeekStart.getTime()) / (1000 * 60 * 60 * 24));
  if (daysIntoCurrentWeek < 3) {
    warnings.push(`Current week has only ${daysIntoCurrentWeek} day(s) of data. Comparisons may be unreliable.`);
  }

  return {
    current: {
      totalSuggestions: currentTotal,
      topicCounts: currentTopicCounts,
      escalationCount: currentEscalationCount,
      topComplaintChannels: currentTopComplaintChannels,
    },
    previous: {
      totalSuggestions: previousTotal,
      topicCounts: previousTopicCounts,
      escalationCount: previousEscalationCount,
      topComplaintChannels: previousTopComplaintChannels,
    },
    changes: {
      totalSuggestionsChange,
      escalationChange,
      topicChanges,
    },
    warnings,
  };
});

/**
 * Get escalation summary
 */
export const getEscalationSummary = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<EscalationSummary> => {
  await requireAdmin();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      ${escalationAlerts.severity} as severity,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE ${escalationAlerts.status} = 'open') as open_count,
      COUNT(*) FILTER (WHERE ${escalationAlerts.status} = 'resolved') as resolved_count
    FROM ${escalationAlerts}
    WHERE ${escalationAlerts.organizationId} = ${organizationId}
      AND ${escalationAlerts.createdAt} >= ${startDate}
    GROUP BY ${escalationAlerts.severity}
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  // Calculate average resolution time
  const resolutionResult = await db.execute(sql`
    SELECT
      AVG(EXTRACT(EPOCH FROM (${escalationAlerts.resolvedAt} - ${escalationAlerts.createdAt})) / 3600) as avg_resolution_hours
    FROM ${escalationAlerts}
    WHERE ${escalationAlerts.organizationId} = ${organizationId}
      AND ${escalationAlerts.createdAt} >= ${startDate}
      AND ${escalationAlerts.resolvedAt} IS NOT NULL
  `);

  const resolutionRows = Array.isArray(resolutionResult) ? resolutionResult : (resolutionResult as unknown as { rows: unknown[] }).rows ?? [];
  const avgResolutionHours = resolutionRows[0] ? Number((resolutionRows[0] as any).avg_resolution_hours) || null : null;

  // Build severity breakdown
  const bySeverity: Record<string, number> = {};
  let total = 0;
  let openCount = 0;
  let resolvedCount = 0;

  for (const row of rows as Array<{ severity: string; count: string; open_count: string; resolved_count: string }>) {
    const severityCount = Number(row.count) || 0;
    bySeverity[row.severity] = severityCount;
    total += severityCount;
    openCount += Number(row.open_count) || 0;
    resolvedCount += Number(row.resolved_count) || 0;
  }

  return {
    total,
    bySeverity,
    openCount,
    resolvedCount,
    avgResolutionHours,
  };
});

/**
 * Get client insights
 */
export const getClientInsights = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<ClientInsight[]> => {
  await requireAdmin();

  // First check if org has client profiles
  const clientCountResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${clientProfiles}
    WHERE ${clientProfiles.organizationId} = ${organizationId}
  `);

  const clientCountRows = Array.isArray(clientCountResult) ? clientCountResult : (clientCountResult as unknown as { rows: unknown[] }).rows ?? [];
  const clientCount = Number((clientCountRows[0] as any)?.count || 0);

  if (clientCount === 0) {
    return [];
  }

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Query topic classifications joined through client_contacts to client_profiles
  const result = await db.execute(sql`
    SELECT
      cp.id as client_profile_id,
      cp.company_name as client_name,
      COUNT(*) as total_messages,
      ${topicClassifications.topic} as topic,
      ${topicClassifications.sentiment}->>'tone' as tone
    FROM ${topicClassifications} tc
    INNER JOIN ${clientContacts} cc ON tc.user_id = cc.slack_user_id AND tc.workspace_id = cc.workspace_id
    INNER JOIN ${clientProfiles} cp ON cc.client_profile_id = cp.id
    WHERE cp.organization_id = ${organizationId}
      AND tc.created_at >= ${startDate}
    GROUP BY cp.id, cp.company_name, tc.topic, tc.sentiment->>'tone'
  `);

  const rows = Array.isArray(result) ? result : (result as unknown as { rows: unknown[] }).rows ?? [];

  // Aggregate per client
  const clientMap = new Map<string, {
    clientProfileId: string;
    clientName: string;
    totalMessages: number;
    topicBreakdown: Record<string, number>;
    sentimentCounts: Record<string, number>;
  }>();

  for (const row of rows as Array<{
    client_profile_id: string;
    client_name: string;
    total_messages: string;
    topic: string;
    tone: string | null;
  }>) {
    const clientId = row.client_profile_id;

    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        clientProfileId: clientId,
        clientName: row.client_name,
        totalMessages: 0,
        topicBreakdown: {},
        sentimentCounts: {},
      });
    }

    const client = clientMap.get(clientId)!;
    const messageCount = Number(row.total_messages) || 0;

    client.totalMessages += messageCount;
    client.topicBreakdown[row.topic] = (client.topicBreakdown[row.topic] || 0) + messageCount;

    if (row.tone) {
      client.sentimentCounts[row.tone] = (client.sentimentCounts[row.tone] || 0) + messageCount;
    }
  }

  // Convert to ClientInsight array
  const insights: ClientInsight[] = [];

  for (const client of clientMap.values()) {
    // Find top topic
    let topTopic = 'general';
    let topTopicCount = 0;
    for (const [topic, count] of Object.entries(client.topicBreakdown)) {
      if (count > topTopicCount) {
        topTopic = topic;
        topTopicCount = count;
      }
    }

    // Calculate complaint rate
    const complaintCount = client.topicBreakdown['complaint'] || 0;
    const complaintRate = client.totalMessages > 0 ? (complaintCount / client.totalMessages) * 100 : 0;

    // Count escalations
    const escalationCount = client.topicBreakdown['escalation'] || 0;

    // Find dominant sentiment
    let dominantSentiment = 'neutral';
    let dominantSentimentCount = 0;
    for (const [tone, count] of Object.entries(client.sentimentCounts)) {
      if (count > dominantSentimentCount) {
        dominantSentiment = tone;
        dominantSentimentCount = count;
      }
    }

    insights.push({
      clientProfileId: client.clientProfileId,
      clientName: client.clientName,
      totalMessages: client.totalMessages,
      topTopic,
      topicBreakdown: client.topicBreakdown,
      complaintRate,
      escalationCount,
      dominantSentiment,
    });
  }

  // Sort by total messages descending
  return insights.sort((a, b) => b.totalMessages - a.totalMessages);
});
