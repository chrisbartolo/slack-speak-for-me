'use client';

import { Card, LineChart, DonutChart, BarList } from '@tremor/react';
import type { AdoptionTrendPoint, UserMetric, ActionBreakdown } from '@/lib/admin/analytics';

interface AdoptionTrendChartProps {
  data: AdoptionTrendPoint[];
}

export function AdoptionTrendChart({ data }: AdoptionTrendChartProps) {
  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Adoption Trend</h3>
      <LineChart
        className="mt-4 h-72"
        data={data}
        index="month"
        categories={['activeUsers', 'totalSuggestions']}
        colors={['blue', 'emerald']}
        showAnimation
        valueFormatter={(value) => value.toFixed(0)}
        yAxisWidth={40}
      />
    </Card>
  );
}

interface ActionBreakdownChartProps {
  data: ActionBreakdown[];
}

export function ActionBreakdownChart({ data }: ActionBreakdownChartProps) {
  // Map action names to friendly labels and colors
  const chartData = data.map(item => ({
    name: item.action === 'accepted' ? 'Accepted' :
          item.action === 'refined' ? 'Refined' :
          item.action === 'dismissed' ? 'Dismissed' : item.action,
    value: item.count,
  }));

  const colors = data.map(item =>
    item.action === 'accepted' ? 'emerald' :
    item.action === 'refined' ? 'amber' :
    'red'
  );

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Action Breakdown</h3>
      <DonutChart
        className="mt-4 h-72"
        data={chartData}
        category="value"
        index="name"
        colors={colors}
        showAnimation
        valueFormatter={(value) => value.toLocaleString()}
      />
    </Card>
  );
}

interface UserMetricsTableProps {
  data: UserMetric[];
}

export function UserMetricsTable({ data }: UserMetricsTableProps) {
  // Format for BarList display - show top users by suggestion count
  const barListData = data.slice(0, 10).map(user => ({
    name: user.email || user.userId,
    value: user.suggestionCount,
  }));

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Top Users by Activity</h3>
      <BarList
        data={barListData}
        className="mt-4"
        showAnimation
        valueFormatter={(value: number) => `${value} suggestions`}
      />

      {/* Detailed table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-gray-200">
            <tr>
              <th className="pb-2 font-medium text-gray-600">User</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Total</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Accepted</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Refined</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Dismissed</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((user) => (
              <tr key={user.userId} className="hover:bg-gray-50">
                <td className="py-2 font-medium">{user.email || user.userId}</td>
                <td className="py-2 text-right">{user.suggestionCount}</td>
                <td className="py-2 text-right text-emerald-600">{user.acceptedCount}</td>
                <td className="py-2 text-right text-amber-600">{user.refinedCount}</td>
                <td className="py-2 text-right text-red-600">{user.dismissedCount}</td>
                <td className="py-2 text-right text-gray-500">
                  {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
