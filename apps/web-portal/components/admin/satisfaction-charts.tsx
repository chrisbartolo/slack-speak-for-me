'use client';

import {
  Card,
  LineChart,
  DonutChart,
  ProgressBar,
  Badge,
  type Color,
} from '@tremor/react';
import type {
  HealthScoreTrendPoint,
  NPSDistribution,
  BeforeAfterComparison,
  ThumbsRatioPoint,
  UserHealthScore,
} from '@/lib/admin/satisfaction-analytics';

interface HealthScoreGaugeProps {
  score: number | null;
  previousScore: number | null;
  changePercent: number | null;
}

export function HealthScoreGauge({ score, previousScore, changePercent }: HealthScoreGaugeProps) {
  // Determine color and label based on score
  const getScoreTier = (s: number | null): { color: Color; label: string; bgColor: string } => {
    if (s === null) return { color: 'gray', label: 'Insufficient Data', bgColor: 'bg-gray-50' };
    if (s >= 80) return { color: 'emerald', label: 'Excellent', bgColor: 'bg-emerald-50' };
    if (s >= 60) return { color: 'blue', label: 'Good', bgColor: 'bg-blue-50' };
    if (s >= 40) return { color: 'amber', label: 'Fair', bgColor: 'bg-amber-50' };
    return { color: 'red', label: 'Needs Attention', bgColor: 'bg-red-50' };
  };

  const tier = getScoreTier(score);
  const changeIsPositive = changePercent !== null && changePercent > 0;
  const changeColor = changeIsPositive ? 'text-emerald-600' : 'text-red-600';
  const changeIcon = changeIsPositive ? '↑' : '↓';

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Team Health Score</h3>
      <div className={`p-6 rounded-lg ${tier.bgColor}`}>
        <div className="text-center">
          <p className="text-5xl font-bold">{score !== null ? score.toFixed(0) : 'N/A'}</p>
          <div className="mt-2">
            <Badge color={tier.color}>{tier.label}</Badge>
          </div>
          {changePercent !== null && (
            <p className={`text-sm font-medium mt-2 ${changeColor}`}>
              {changeIcon} {Math.abs(changePercent).toFixed(1)}% from last week
            </p>
          )}
        </div>
      </div>
      {score !== null && (
        <div className="mt-4">
          <ProgressBar value={score} color={tier.color} className="mt-2" />
          <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-gray-600">
            <div>
              <span className="font-medium">Excellent:</span> 80-100
            </div>
            <div>
              <span className="font-medium">Good:</span> 60-79
            </div>
            <div>
              <span className="font-medium">Fair:</span> 40-59
            </div>
            <div>
              <span className="font-medium">Needs Attention:</span> 0-39
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface HealthScoreTrendChartProps {
  data: HealthScoreTrendPoint[];
}

export function HealthScoreTrendChart({ data }: HealthScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">Health Score Trend (12 Weeks)</h3>
        <p className="text-sm text-gray-500 mt-4">No health score data yet. Scores are calculated weekly.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Health Score Trend (12 Weeks)</h3>
      <LineChart
        className="mt-4 h-80"
        data={data}
        index="date"
        categories={['healthScore', 'acceptanceRate', 'sentimentScore', 'satisfactionScore', 'engagementRate']}
        colors={['blue', 'emerald', 'purple', 'orange', 'cyan']}
        showAnimation
        yAxisWidth={60}
        showLegend
        showGridLines
      />
    </Card>
  );
}

interface NPSDistributionChartProps {
  data: NPSDistribution;
}

export function NPSDistributionChart({ data }: NPSDistributionChartProps) {
  const chartData = [
    { name: 'Promoters', value: data.promoters, color: 'emerald' as Color },
    { name: 'Passives', value: data.passives, color: 'amber' as Color },
    { name: 'Detractors', value: data.detractors, color: 'red' as Color },
  ].filter(item => item.value > 0);

  const npsFormatted = data.npsScore >= 0 ? `+${data.npsScore.toFixed(0)}` : data.npsScore.toFixed(0);

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">NPS Score</h3>
      <div className="mt-4 flex flex-col items-center">
        <div className="text-center mb-4">
          <p className="text-5xl font-bold">{npsFormatted}</p>
          <p className="mt-1 text-sm text-gray-600">Net Promoter Score</p>
        </div>
        {chartData.length > 0 ? (
          <>
            <DonutChart
              className="h-48"
              data={chartData}
              category="value"
              index="name"
              colors={chartData.map(d => d.color)}
              showAnimation
            />
            <div className="mt-4 w-full space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-emerald-600">Promoters (9-10)</span>
                <span className="text-sm font-medium">{data.promoters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-amber-600">Passives (7-8)</span>
                <span className="text-sm font-medium">{data.passives}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-red-600">Detractors (0-6)</span>
                <span className="text-sm font-medium">{data.detractors}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm">Response Rate</span>
                <span className="text-sm font-medium">{data.responseRate.toFixed(1)}%</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">No survey responses yet.</p>
        )}
      </div>
    </Card>
  );
}

interface BeforeAfterCardProps {
  data: BeforeAfterComparison;
}

export function BeforeAfterCard({ data }: BeforeAfterCardProps) {
  const hasData = data.baselineScore !== null && data.currentScore !== null;
  const improvementColor =
    data.improvementPercent === null ? 'text-gray-600' :
    data.improvementPercent > 0 ? 'text-emerald-600' :
    data.improvementPercent < 0 ? 'text-red-600' :
    'text-gray-600';
  const improvementIcon =
    data.improvementPercent === null ? '' :
    data.improvementPercent > 0 ? '↑' :
    data.improvementPercent < 0 ? '↓' : '→';

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Before/After Comparison</h3>
      {hasData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Baseline */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Baseline</p>
              <p className="text-3xl font-bold">{data.baselineScore!.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">{data.baselineWeeks} weeks</p>
            </div>

            {/* Arrow with improvement */}
            <div className="text-center">
              <div className={`text-4xl font-bold ${improvementColor}`}>
                {improvementIcon}
              </div>
              {data.improvementPercent !== null && (
                <p className={`text-sm font-medium ${improvementColor}`}>
                  {data.improvementPercent > 0 ? '+' : ''}{data.improvementPercent.toFixed(1)}%
                </p>
              )}
            </div>

            {/* Current */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Current</p>
              <p className="text-3xl font-bold">{data.currentScore!.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">{data.currentWeeks} weeks</p>
            </div>
          </div>

          {data.improvement !== null && (
            <div className="text-center pt-4 border-t">
              <p className="text-sm">
                {data.improvement > 0 ? 'Improvement' : data.improvement < 0 ? 'Decline' : 'No change'}: {' '}
                <span className="font-medium">{Math.abs(data.improvement).toFixed(1)} points</span>
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Insufficient data for comparison. Baseline requires 5 weeks of scores.
        </p>
      )}
    </Card>
  );
}

interface ThumbsRatioChartProps {
  data: ThumbsRatioPoint[];
}

export function ThumbsRatioChart({ data }: ThumbsRatioChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">Feedback Approval Rate</h3>
        <p className="text-sm text-gray-500 mt-4">No feedback data yet. Users can give thumbs up/down on suggestions.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Feedback Approval Rate</h3>
      <LineChart
        className="mt-4 h-80"
        data={data}
        index="date"
        categories={['ratio']}
        colors={['blue']}
        showAnimation
        yAxisWidth={60}
        valueFormatter={(v) => `${v.toFixed(1)}%`}
        showGridLines
      />
      <div className="mt-4 text-sm text-gray-600">
        <p>
          Approval rate calculated from thumbs up (accepted/sent) vs thumbs down (dismissed) feedback
        </p>
      </div>
    </Card>
  );
}

interface UserHealthScoreTableProps {
  data: UserHealthScore[];
}

export function UserHealthScoreTable({ data }: UserHealthScoreTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">Individual User Scores</h3>
        <p className="text-sm text-gray-500 mt-4">No user scores available yet. Scores require at least 5 suggestions per user.</p>
      </Card>
    );
  }

  const getScoreColor = (score: number | null): string => {
    if (score === null) return 'text-gray-600';
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number | null): { text: string; color: Color } => {
    if (score === null) return { text: 'Insufficient', color: 'gray' };
    if (score >= 70) return { text: score.toFixed(0), color: 'emerald' };
    if (score >= 40) return { text: score.toFixed(0), color: 'amber' };
    return { text: score.toFixed(0), color: 'red' };
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Individual User Scores</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-gray-200">
            <tr>
              <th className="pb-2 font-medium text-gray-600">User ID</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Health Score</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Acceptance</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Engagement</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Suggestions</th>
              <th className="pb-2 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((user) => {
              const scoreBadge = getScoreBadge(user.healthScore);
              return (
                <tr key={user.userId} className="hover:bg-gray-50">
                  <td className="py-2 font-medium">{user.userId}</td>
                  <td className="py-2 text-right">
                    <Badge color={scoreBadge.color} size="sm">
                      {scoreBadge.text}
                    </Badge>
                  </td>
                  <td className="py-2 text-right">
                    {user.acceptanceRate !== null ? `${user.acceptanceRate.toFixed(0)}%` : 'N/A'}
                  </td>
                  <td className="py-2 text-right">
                    {user.engagementRate !== null ? `${user.engagementRate.toFixed(0)}%` : 'N/A'}
                  </td>
                  <td className="py-2 text-right">{user.totalSuggestions}</td>
                  <td className="py-2">
                    {user.isBaseline ? (
                      <Badge color="blue" size="sm">Baseline</Badge>
                    ) : (
                      <Badge color="gray" size="sm">Active</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
