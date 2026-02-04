import { requireAdmin } from '@/lib/auth/admin';
import {
  getResponseTimeOverview,
  getResponseTimeTrend,
  getPerChannelMetrics,
  getPerUserMetrics,
  getSLACompliance,
} from '@/lib/admin/response-time-analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponseTimeTrendChart,
  StageBreakdownChart,
  SLAComplianceGauge,
  ChannelMetricsTable,
  UserMetricsTable,
} from '@/components/admin/response-time-charts';
import { Download } from 'lucide-react';

export default async function ResponseTimesPage() {
  const session = await requireAdmin();

  if (!session.organizationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No organization found</p>
      </div>
    );
  }

  // Fetch all analytics data
  let overview, trend, channelMetrics, userMetrics, slaCompliance;
  try {
    [overview, trend, channelMetrics, userMetrics, slaCompliance] = await Promise.all([
      getResponseTimeOverview(session.organizationId, session.workspaceId, 30),
      getResponseTimeTrend(session.organizationId, session.workspaceId, 30),
      getPerChannelMetrics(session.organizationId, session.workspaceId, 30),
      getPerUserMetrics(session.organizationId, session.workspaceId, 30),
      getSLACompliance(session.organizationId, session.workspaceId, 10000, 30),
    ]);
  } catch (error) {
    console.error('Failed to fetch response time data:', error);
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Response Time Analytics</h1>
        <p className="text-muted-foreground">
          No response time data available yet. Metrics will appear once suggestions are generated.
        </p>
      </div>
    );
  }

  // Format time saved
  const hours = Math.floor(overview.timeSavedMinutes / 60);
  const minutes = overview.timeSavedMinutes % 60;
  const timeSavedFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Format milliseconds for display
  const formatMs = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Calculate error rate
  const errorRate =
    overview.totalSuggestions > 0
      ? ((overview.errorCount / overview.totalSuggestions) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Response Time Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track AI pipeline performance and response delivery speed
          </p>
        </div>
        <a
          href="/api/admin/response-times?format=csv"
          download
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </a>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Avg Response Time */}
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Response Time</CardDescription>
            <CardTitle className="text-3xl">{formatMs(overview.avgTotalMs)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {overview.completedSuggestions.toLocaleString()} of{' '}
              {overview.totalSuggestions.toLocaleString()} suggestions delivered
            </p>
          </CardContent>
        </Card>

        {/* Median Response Time */}
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Median Response Time</CardDescription>
            <CardTitle className="text-3xl">{formatMs(overview.medianTotalMs)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              50th percentile (typical experience)
            </p>
          </CardContent>
        </Card>

        {/* P95 Response Time */}
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>P95 Response Time</CardDescription>
            <CardTitle className="text-3xl">{formatMs(overview.p95TotalMs)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              95th percentile (worst-case experience)
            </p>
          </CardContent>
        </Card>

        {/* AI Processing Time */}
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>AI Processing Time</CardDescription>
            <CardTitle className="text-3xl">{formatMs(overview.avgAiMs)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Average Claude API response time
            </p>
          </CardContent>
        </Card>

        {/* Time Saved */}
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Time Saved</CardDescription>
            <CardTitle className="text-3xl">{timeSavedFormatted}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              vs. 5 min manual response time ({overview.completedSuggestions.toLocaleString()} suggestions)
            </p>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Error Rate</CardDescription>
            <CardTitle className="text-3xl">{errorRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {overview.errorCount.toLocaleString()} errors of{' '}
              {overview.totalSuggestions.toLocaleString()} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SLA Compliance Gauge */}
      <SLAComplianceGauge
        complianceRate={slaCompliance.complianceRate}
        thresholdMs={slaCompliance.thresholdMs}
        totalDelivered={slaCompliance.totalDelivered}
        withinSLA={slaCompliance.withinSLA}
      />

      {/* Trend Chart */}
      {trend.length > 0 ? (
        <ResponseTimeTrendChart data={trend} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Not enough data to show trend. Check back after more suggestions are generated.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stage Breakdown and Channel Metrics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <StageBreakdownChart
          queueMs={overview.avgQueueMs}
          aiMs={overview.avgAiMs}
          totalMs={overview.avgTotalMs}
        />
        <ChannelMetricsTable data={channelMetrics} />
      </div>

      {/* User Metrics */}
      <UserMetricsTable data={userMetrics} />
    </div>
  );
}
