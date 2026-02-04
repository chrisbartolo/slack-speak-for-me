import { requireAdmin } from '@/lib/auth/admin';
import {
  getTopicOverview,
  getTopicTrend,
  getSentimentTrend,
  getChannelHotspots,
  getWeekOverWeek,
  getEscalationSummary,
  getClientInsights,
} from '@/lib/admin/communication-insights';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TopicTrendChart,
  SentimentTrendChart,
  ChannelHotspotTable,
  WeekOverWeekCards,
  EscalationSummaryCard,
  ClientInsightsTable,
} from '@/components/admin/communication-insights-charts';

export default async function CommunicationInsightsPage() {
  const session = await requireAdmin();

  if (!session.organizationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No organization found</p>
      </div>
    );
  }

  // Fetch all analytics data
  let topicOverview, topicTrend, sentimentTrend, channelHotspots, weekOverWeek, escalationSummary, clientInsights;
  try {
    [topicOverview, topicTrend, sentimentTrend, channelHotspots, weekOverWeek, escalationSummary, clientInsights] = await Promise.all([
      getTopicOverview(session.organizationId, session.workspaceId, 30),
      getTopicTrend(session.organizationId, session.workspaceId, 30),
      getSentimentTrend(session.organizationId, session.workspaceId, 30),
      getChannelHotspots(session.organizationId, session.workspaceId, 7),
      getWeekOverWeek(session.organizationId, session.workspaceId),
      getEscalationSummary(session.organizationId, session.workspaceId, 30),
      getClientInsights(session.organizationId, session.workspaceId, 30),
    ]);
  } catch (error) {
    console.error('Failed to fetch communication insights data:', error);
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Communication Insights</h1>
        <p className="text-muted-foreground">
          No communication insights data available yet. Data will appear once topic classifications are generated.
        </p>
      </div>
    );
  }

  // Find top topic for overview card
  const topTopic = topicOverview.topics.length > 0 ? topicOverview.topics[0].topic : 'N/A';
  const topTopicPercentage = topicOverview.topics.length > 0 ? topicOverview.topics[0].percentage.toFixed(1) : '0.0';

  // Count active hotspots (risk score > 25)
  const activeHotspots = channelHotspots.filter(h => h.riskScore > 25).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Communication Insights</h1>
        <p className="text-muted-foreground mt-1">
          Track conversation topics, sentiment trends, and communication patterns
        </p>
      </div>

      {/* Week-over-Week Comparison */}
      <WeekOverWeekCards data={weekOverWeek} />

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Classifications</CardDescription>
            <CardTitle className="text-3xl">{topicOverview.totalClassifications.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Messages analyzed for topic and sentiment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Top Topic</CardDescription>
            <CardTitle className="text-3xl capitalize">{topTopic.replace('_', ' ')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {topTopicPercentage}% of all messages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Confidence</CardDescription>
            <CardTitle className="text-3xl">{topicOverview.avgConfidence.toFixed(0)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Classification confidence score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Hotspots</CardDescription>
            <CardTitle className="text-3xl">{activeHotspots}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Channels with elevated risk (last 7 days)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Topic Trend Chart */}
      <TopicTrendChart data={topicTrend} />

      {/* Sentiment Trend Chart */}
      <SentimentTrendChart data={sentimentTrend} />

      {/* Channel Hotspots and Escalation Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChannelHotspotTable hotspots={channelHotspots} />
        <EscalationSummaryCard data={escalationSummary} />
      </div>

      {/* Client Insights (conditional) */}
      {clientInsights.length > 0 && <ClientInsightsTable clients={clientInsights} />}
    </div>
  );
}
