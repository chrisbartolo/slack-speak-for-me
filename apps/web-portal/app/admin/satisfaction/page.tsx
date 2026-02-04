import { requireAdmin } from '@/lib/auth/admin';
import {
  getHealthScoreOverview,
  getHealthScoreTrend,
  getNPSDistribution,
  getSurveyStats,
  getBeforeAfterComparison,
  getThumbsRatioTrend,
  getUserHealthScores,
} from '@/lib/admin/satisfaction-analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HealthScoreGauge,
  HealthScoreTrendChart,
  NPSDistributionChart,
  BeforeAfterCard,
  ThumbsRatioChart,
  UserHealthScoreTable,
} from '@/components/admin/satisfaction-charts';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { HelpLink } from '@/components/help/help-link';

export default async function SatisfactionDashboardPage() {
  const session = await requireAdmin();

  if (!session.organizationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No organization found</p>
      </div>
    );
  }

  // Fetch all satisfaction data in parallel
  let overview, trend, npsDistribution, surveyStats, beforeAfter, thumbsRatio, userScores;
  try {
    [overview, trend, npsDistribution, surveyStats, beforeAfter, thumbsRatio, userScores] = await Promise.all([
      getHealthScoreOverview(session.organizationId, session.workspaceId, 30),
      getHealthScoreTrend(session.organizationId, session.workspaceId, 12),
      getNPSDistribution(session.organizationId, 90),
      getSurveyStats(session.organizationId, 90),
      getBeforeAfterComparison(session.organizationId, session.workspaceId),
      getThumbsRatioTrend(session.organizationId, session.workspaceId, 90),
      getUserHealthScores(session.organizationId, session.workspaceId),
    ]);
  } catch (error) {
    console.error('Failed to fetch satisfaction data:', error);
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Satisfaction & Health Scores</h1>
        <p className="text-muted-foreground">
          No satisfaction data available yet. Data will appear after the first week of health score computation (runs Sundays at 2 AM UTC).
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with export link */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Satisfaction & Health Scores</h1>
            <HelpLink href="/docs/admin/satisfaction" label="Learn about satisfaction tracking" />
          </div>
          <p className="text-muted-foreground mt-1">
            Track team communication quality, user satisfaction, and feedback trends
          </p>
        </div>
        <Link
          href="/api/admin/satisfaction?format=csv"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </Link>
      </div>

      {/* Row 1: Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Health Score Gauge */}
        <HealthScoreGauge
          score={overview.currentScore}
          previousScore={overview.previousScore}
          changePercent={overview.changePercent}
        />

        {/* NPS Score */}
        <NPSDistributionChart data={npsDistribution} />

        {/* Survey Stats Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Survey Stats</CardTitle>
            <CardDescription>Last 90 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Delivered</span>
              <span className="text-sm font-medium">{surveyStats.totalDelivered}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Completed</span>
              <span className="text-sm font-medium">{surveyStats.totalCompleted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Response Rate</span>
              <span className="text-sm font-medium">{surveyStats.responseRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm text-gray-600">Avg Rating</span>
              <span className="text-sm font-medium">
                {surveyStats.avgRating !== null ? surveyStats.avgRating.toFixed(1) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Expired: {surveyStats.totalExpired}</span>
              <span>Dismissed: {surveyStats.totalDismissed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Health Score Trend - full width */}
      <HealthScoreTrendChart data={trend} />

      {/* Row 3: Before/After and Thumbs Ratio */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BeforeAfterCard data={beforeAfter} />
        <ThumbsRatioChart data={thumbsRatio} />
      </div>

      {/* Row 4: User Health Scores - full width */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Individual User Scores</h2>
          <Link
            href="/api/admin/satisfaction?format=csv&type=users"
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export Users
          </Link>
        </div>
        <UserHealthScoreTable data={userScores} />
      </div>

      {/* Additional stats from overview */}
      {overview.totalUsersScored > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Users with scores</span>
              <span className="text-sm font-medium">{overview.totalUsersScored}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Insufficient data</span>
              <span className="text-sm font-medium text-gray-500">{overview.insufficientDataUsers}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Users need at least 5 suggestions for a health score to be calculated
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
