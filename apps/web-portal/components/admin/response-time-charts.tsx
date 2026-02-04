'use client';

import { Card, LineChart, BarList } from '@tremor/react';
import type {
  ResponseTimeTrendPoint,
  ChannelMetric,
  UserMetric,
  SLACompliance,
} from '@/lib/admin/response-time-analytics';

interface ResponseTimeTrendChartProps {
  data: ResponseTimeTrendPoint[];
}

export function ResponseTimeTrendChart({ data }: ResponseTimeTrendChartProps) {
  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Response Time Trend</h3>
      <LineChart
        className="mt-4 h-72"
        data={data}
        index="date"
        categories={['p50Ms', 'p95Ms', 'avgMs']}
        colors={['emerald', 'amber', 'blue']}
        showAnimation
        valueFormatter={(v) => `${Math.round(v)}ms`}
        yAxisWidth={60}
      />
    </Card>
  );
}

interface StageBreakdownChartProps {
  queueMs: number;
  aiMs: number;
  totalMs: number;
}

export function StageBreakdownChart({ queueMs, aiMs, totalMs }: StageBreakdownChartProps) {
  // Calculate delivery time as remainder (total - queue - ai)
  const deliveryMs = Math.max(0, totalMs - aiMs - queueMs);

  const data = [
    { name: 'Queue Delay', value: queueMs },
    { name: 'AI Processing', value: aiMs },
    { name: 'Delivery', value: deliveryMs },
  ].filter(item => item.value > 0); // Only show stages with time

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Pipeline Stage Breakdown</h3>
      <BarList
        data={data}
        className="mt-4"
        showAnimation
        valueFormatter={(v: number) => `${Math.round(v)}ms`}
      />
    </Card>
  );
}

interface SLAComplianceGaugeProps {
  complianceRate: number;
  thresholdMs: number;
  totalDelivered: number;
  withinSLA: number;
}

export function SLAComplianceGauge({
  complianceRate,
  thresholdMs,
  totalDelivered,
  withinSLA,
}: SLAComplianceGaugeProps) {
  // Determine color based on compliance rate
  const color =
    complianceRate >= 95
      ? 'text-emerald-600'
      : complianceRate >= 80
      ? 'text-amber-600'
      : 'text-red-600';

  const bgColor =
    complianceRate >= 95
      ? 'bg-emerald-50'
      : complianceRate >= 80
      ? 'bg-amber-50'
      : 'bg-red-50';

  const thresholdSeconds = (thresholdMs / 1000).toFixed(1);

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">SLA Compliance</h3>
      <div className={`mt-4 p-6 rounded-lg ${bgColor}`}>
        <div className={`text-5xl font-bold text-center ${color}`}>
          {complianceRate.toFixed(1)}%
        </div>
        <p className="text-center text-sm text-gray-600 mt-2">
          {withinSLA.toLocaleString()} of {totalDelivered.toLocaleString()} suggestions delivered
          within {thresholdSeconds}s threshold
        </p>
      </div>
    </Card>
  );
}

interface ChannelMetricsTableProps {
  data: ChannelMetric[];
}

export function ChannelMetricsTable({ data }: ChannelMetricsTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">Response Times by Channel</h3>
        <p className="text-sm text-gray-500 mt-4">No channel data available yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Response Times by Channel</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-gray-200">
            <tr>
              <th className="pb-2 font-medium text-gray-600">Channel</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Count</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Avg</th>
              <th className="pb-2 font-medium text-gray-600 text-right">P95</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((channel) => (
              <tr key={channel.channelId} className="hover:bg-gray-50">
                <td className="py-2 font-medium">{channel.channelId}</td>
                <td className="py-2 text-right">{channel.count}</td>
                <td className="py-2 text-right">
                  {channel.avgMs < 1000
                    ? `${Math.round(channel.avgMs)}ms`
                    : `${(channel.avgMs / 1000).toFixed(1)}s`}
                </td>
                <td className="py-2 text-right">
                  {channel.p95Ms < 1000
                    ? `${Math.round(channel.p95Ms)}ms`
                    : `${(channel.p95Ms / 1000).toFixed(1)}s`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface UserMetricsTableProps {
  data: UserMetric[];
}

export function UserMetricsTable({ data }: UserMetricsTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">Response Times by User</h3>
        <p className="text-sm text-gray-500 mt-4">No user data available yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Response Times by User</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-gray-200">
            <tr>
              <th className="pb-2 font-medium text-gray-600">User</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Count</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Avg</th>
              <th className="pb-2 font-medium text-gray-600 text-right">P95</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((user) => (
              <tr key={user.userId} className="hover:bg-gray-50">
                <td className="py-2 font-medium">{user.userId}</td>
                <td className="py-2 text-right">{user.count}</td>
                <td className="py-2 text-right">
                  {user.avgMs < 1000
                    ? `${Math.round(user.avgMs)}ms`
                    : `${(user.avgMs / 1000).toFixed(1)}s`}
                </td>
                <td className="py-2 text-right">
                  {user.p95Ms < 1000
                    ? `${Math.round(user.p95Ms)}ms`
                    : `${(user.p95Ms / 1000).toFixed(1)}s`}
                </td>
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
