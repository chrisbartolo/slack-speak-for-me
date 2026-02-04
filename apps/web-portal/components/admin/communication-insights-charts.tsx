'use client';

import { Card, AreaChart, LineChart } from '@tremor/react';
import type {
  TopicTrendPoint,
  SentimentTrendPoint,
  ChannelHotspot,
  PeriodComparison,
  EscalationSummary,
  ClientInsight,
} from '@/lib/admin/communication-insights';

interface TopicTrendChartProps {
  data: TopicTrendPoint[];
}

export function TopicTrendChart({ data }: TopicTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">Topic Distribution Over Time</h3>
        <p className="text-sm text-gray-500 mt-4">No topic data available yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Topic Distribution Over Time</h3>
      <AreaChart
        className="mt-4 h-72"
        data={data}
        index="date"
        categories={['escalation', 'complaint', 'technical', 'request', 'scheduling', 'status_update', 'general']}
        colors={['red', 'orange', 'blue', 'green', 'indigo', 'purple', 'gray']}
        stack={true}
        showAnimation
        yAxisWidth={60}
      />
    </Card>
  );
}

interface SentimentTrendChartProps {
  data: SentimentTrendPoint[];
}

export function SentimentTrendChart({ data }: SentimentTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">Sentiment Trend Over Time</h3>
        <p className="text-sm text-gray-500 mt-4">No sentiment data available yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Sentiment Trend Over Time</h3>
      <LineChart
        className="mt-4 h-72"
        data={data}
        index="date"
        categories={['angry', 'frustrated', 'tense', 'neutral', 'positive']}
        colors={['red', 'orange', 'yellow', 'blue', 'emerald']}
        showAnimation
        yAxisWidth={60}
      />
    </Card>
  );
}

interface ChannelHotspotTableProps {
  hotspots: ChannelHotspot[];
}

export function ChannelHotspotTable({ hotspots }: ChannelHotspotTableProps) {
  if (hotspots.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-2">Channel Hotspots</h3>
        <p className="text-sm text-gray-500 mt-4">No channel hotspots detected yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Channel Hotspots</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-gray-200">
            <tr>
              <th className="pb-2 font-medium text-gray-600">Channel ID</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Total</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Complaints</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Escalations</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Complaint Rate</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Risk Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hotspots.map((hotspot) => {
              // Color code risk score
              const riskColor =
                hotspot.riskScore > 50
                  ? 'text-red-600'
                  : hotspot.riskScore > 25
                  ? 'text-orange-600'
                  : 'text-yellow-600';

              return (
                <tr key={hotspot.channelId} className="hover:bg-gray-50">
                  <td className="py-2 font-medium">{hotspot.channelId}</td>
                  <td className="py-2 text-right">{hotspot.totalMessages}</td>
                  <td className="py-2 text-right">{hotspot.complaintCount}</td>
                  <td className="py-2 text-right">{hotspot.escalationCount}</td>
                  <td className="py-2 text-right">{hotspot.complaintRate.toFixed(1)}%</td>
                  <td className={`py-2 text-right font-semibold ${riskColor}`}>
                    {hotspot.riskScore.toFixed(1)}
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

interface WeekOverWeekCardsProps {
  data: PeriodComparison;
}

export function WeekOverWeekCards({ data }: WeekOverWeekCardsProps) {
  const { current, changes, warnings } = data;

  // Helper to format change with color
  const formatChange = (change: number) => {
    const isPositive = change > 0;
    const color = isPositive ? 'text-red-600' : 'text-emerald-600';
    const icon = isPositive ? '↑' : '↓';
    return (
      <span className={`text-sm font-medium ${color}`}>
        {icon} {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  // Get top 3 topic changes
  const topicChangesArray = Object.entries(changes.topicChanges)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);

  return (
    <div>
      {warnings.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">{warnings[0]}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <h3 className="text-sm font-medium text-gray-600">Total Suggestions</h3>
          <p className="text-2xl font-bold mt-1">{current.totalSuggestions}</p>
          <p className="text-xs mt-1">{formatChange(changes.totalSuggestionsChange)}</p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-600">Escalations</h3>
          <p className="text-2xl font-bold mt-1">{current.escalationCount}</p>
          <p className="text-xs mt-1">{formatChange(changes.escalationChange)}</p>
        </Card>

        {topicChangesArray.map(([topic, change]) => {
          const topicLabel = topic.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
          return (
            <Card key={topic}>
              <h3 className="text-sm font-medium text-gray-600">{topicLabel}</h3>
              <p className="text-2xl font-bold mt-1">{current.topicCounts[topic] || 0}</p>
              <p className="text-xs mt-1">{formatChange(change)}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface EscalationSummaryCardProps {
  data: EscalationSummary;
}

export function EscalationSummaryCard({ data }: EscalationSummaryCardProps) {
  const formatHours = (hours: number | null) => {
    if (hours === null) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Escalation Summary</h3>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Escalations</p>
            <p className="text-2xl font-bold">{data.total}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Avg Resolution Time</p>
            <p className="text-2xl font-bold">{formatHours(data.avgResolutionHours)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Open</p>
            <p className="text-xl font-semibold text-red-600">{data.openCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Resolved</p>
            <p className="text-xl font-semibold text-emerald-600">{data.resolvedCount}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">By Severity</p>
          <div className="space-y-1">
            {Object.entries(data.bySeverity).map(([severity, count]) => (
              <div key={severity} className="flex justify-between text-sm">
                <span className="capitalize">{severity}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

interface ClientInsightsTableProps {
  clients: ClientInsight[];
}

export function ClientInsightsTable({ clients }: ClientInsightsTableProps) {
  if (clients.length === 0) {
    return null;
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Client Communication Insights</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-gray-200">
            <tr>
              <th className="pb-2 font-medium text-gray-600">Client Name</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Messages</th>
              <th className="pb-2 font-medium text-gray-600">Top Topic</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Complaint Rate</th>
              <th className="pb-2 font-medium text-gray-600 text-right">Escalations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients
              .sort((a, b) => b.complaintRate - a.complaintRate)
              .map((client) => (
                <tr key={client.clientProfileId} className="hover:bg-gray-50">
                  <td className="py-2 font-medium">{client.clientName}</td>
                  <td className="py-2 text-right">{client.totalMessages}</td>
                  <td className="py-2 capitalize">{client.topTopic.replace('_', ' ')}</td>
                  <td className="py-2 text-right">{client.complaintRate.toFixed(1)}%</td>
                  <td className="py-2 text-right">{client.escalationCount}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
