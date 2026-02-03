'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarList, DonutChart } from '@tremor/react';
import { AlertTriangle, TrendingUp, Shield, Activity } from 'lucide-react';

interface ViolationStats {
  totalCount: number;
  byType: Record<string, number>;
  byRule: Record<string, number>;
  byAction: Record<string, number>;
  dailyTrend: Array<{ date: string; count: number }>;
  mostTriggeredRule: string;
  mostCommonAction: string;
  recentViolations: Array<{
    id: string;
    userId: string;
    violationType: string;
    violatedRule: string;
    action: string;
    createdAt: Date | null;
  }>;
}

interface ViolationsReportProps {
  stats: ViolationStats;
}

const PERIOD_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

export function ViolationsReport({ stats: initialStats }: ViolationsReportProps) {
  const [period, setPeriod] = useState(30);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(false);

  const handlePeriodChange = async (days: number) => {
    setPeriod(days);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/guardrails/violations?days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch stats');

      const newStats = await response.json();
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching violation stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare data for charts
  const byRuleData = Object.entries(stats.byRule)
    .map(([name, value]) => ({
      name,
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const byTypeData = Object.entries(stats.byType).map(([name, value]) => ({
    name: name === 'category' ? 'Category' : 'Keyword',
    value,
  }));

  const byActionData = Object.entries(stats.byAction).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Violations Report
            </CardTitle>
            <CardDescription>
              Track guardrail triggers and patterns
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={period === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePeriodChange(option.value)}
                disabled={isLoading}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-900">Total Violations</p>
            </div>
            <p className="text-2xl font-bold text-amber-900">{stats.totalCount}</p>
            <p className="text-xs text-amber-600 mt-1">Last {period} days</p>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-900">Most Triggered</p>
            </div>
            <p className="text-lg font-semibold text-blue-900 truncate">
              {stats.mostTriggeredRule}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {stats.byRule[stats.mostTriggeredRule] || 0} times
            </p>
          </div>

          <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-purple-600" />
              <p className="text-sm font-medium text-purple-900">Most Common Action</p>
            </div>
            <p className="text-lg font-semibold text-purple-900 capitalize">
              {stats.mostCommonAction}
            </p>
            <p className="text-xs text-purple-600 mt-1">
              {stats.byAction[stats.mostCommonAction.toLowerCase()] || 0} times
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        {stats.totalCount > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Violations by Rule */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Top Triggered Rules</h3>
              <BarList data={byRuleData} className="mt-2" />
            </div>

            {/* Violations by Type */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Violations by Type</h3>
              <DonutChart
                data={byTypeData}
                category="value"
                index="name"
                colors={['blue', 'purple']}
                className="h-48"
              />
            </div>

            {/* Violations by Action */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Actions Taken</h3>
              <DonutChart
                data={byActionData}
                category="value"
                index="name"
                colors={['red', 'amber', 'green']}
                className="h-48"
              />
            </div>

            {/* Daily Trend */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Daily Trend</h3>
              {stats.dailyTrend.length > 0 ? (
                <div className="space-y-2">
                  {stats.dailyTrend.slice(-7).map((day) => (
                    <div key={day.date} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24">{day.date}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{
                            width: `${(day.count / Math.max(...stats.dailyTrend.map((d) => d.count))) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right">{day.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No trend data available</p>
              )}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No violations recorded</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your guardrails haven't been triggered in the last {period} days
            </p>
          </div>
        )}

        {/* Recent Violations Table */}
        {stats.recentViolations.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Recent Violations</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Rule</th>
                    <th className="text-left p-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentViolations.slice(0, 50).map((violation) => (
                    <tr key={violation.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">
                        {violation.createdAt
                          ? new Date(violation.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="p-3 font-mono text-xs">{violation.userId.slice(0, 8)}...</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {violation.violationType}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs truncate max-w-xs">{violation.violatedRule}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            violation.action === 'blocked'
                              ? 'destructive'
                              : violation.action === 'warned'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {violation.action}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
