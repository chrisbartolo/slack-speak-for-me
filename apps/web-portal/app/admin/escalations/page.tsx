'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/dashboard/empty-state';
import { AlertTriangle, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface EscalationAlert {
  id: string;
  organizationId: string;
  workspaceId: string;
  clientProfileId: string | null;
  channelId: string;
  messageTs: string;
  alertType: string;
  severity: 'medium' | 'high' | 'critical';
  summary: string;
  suggestedAction: string | null;
  sentiment: any;
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

interface Stats {
  open: number;
  acknowledged: number;
  resolved: number;
  falsePositive: number;
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'critical') {
    return <Badge variant="destructive" className="font-semibold">Critical</Badge>;
  }
  if (severity === 'high') {
    return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 font-semibold">High</Badge>;
  }
  return <Badge variant="default" className="font-semibold">Medium</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'open') {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Open</Badge>;
  }
  if (status === 'acknowledged') {
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Acknowledged</Badge>;
  }
  if (status === 'resolved') {
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Resolved</Badge>;
  }
  return <Badge variant="secondary">False Positive</Badge>;
}

export default function EscalationsPage() {
  const [alerts, setAlerts] = useState<EscalationAlert[]>([]);
  const [stats, setStats] = useState<Stats>({ open: 0, acknowledged: 0, resolved: 0, falsePositive: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter]);

  const fetchAlerts = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);

      const response = await fetch(`/api/admin/escalations?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
        setStats(data.stats || { open: 0, acknowledged: 0, resolved: 0, falsePositive: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAlertStatus = async (alertId: string, status: 'acknowledged' | 'resolved' | 'false_positive', notes?: string) => {
    try {
      const response = await fetch(`/api/admin/escalations/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolutionNotes: notes }),
      });

      if (response.ok) {
        await fetchAlerts();
        setResolutionNotes(prev => {
          const newNotes = { ...prev };
          delete newNotes[alertId];
          return newNotes;
        });
      }
    } catch (error) {
      console.error('Failed to update alert:', error);
    }
  };

  const getSlackChannelLink = (channelId: string, workspaceId: string) => {
    // Note: This assumes we have team ID available, otherwise just return the channel ID
    return `slack://channel?id=${channelId}`;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Escalation Alerts</h1>
        <p className="text-muted-foreground">
          Monitor and manage client communication risks
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acknowledged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.acknowledged}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">False Positive Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {stats.falsePositive + stats.resolved > 0
                ? Math.round((stats.falsePositive / (stats.falsePositive + stats.resolved)) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-4">
        <div className="w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="false_positive">False Positive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alert List */}
      {alerts.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No escalation alerts"
          description={
            statusFilter !== 'all' || severityFilter !== 'all'
              ? 'No alerts match your current filters'
              : 'All client conversations are healthy'
          }
        />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <StatusBadge status={alert.status} />
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{alert.summary}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={getSlackChannelLink(alert.channelId, alert.workspaceId)}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View in Slack
                    </a>
                  </div>

                  {alert.sentiment?.indicators && alert.sentiment.indicators.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {alert.sentiment.indicators.map((indicator: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {indicator}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {alert.suggestedAction && (
                    <div className="rounded-md bg-blue-50 p-3 text-sm">
                      <p className="font-medium text-blue-900">Suggested Action:</p>
                      <p className="text-blue-800 mt-1">{alert.suggestedAction}</p>
                    </div>
                  )}
                </div>

                {alert.status === 'open' && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateAlertStatus(alert.id, 'acknowledged')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        if (resolutionNotes[alert.id]) {
                          updateAlertStatus(alert.id, 'resolved', resolutionNotes[alert.id]);
                        } else {
                          updateAlertStatus(alert.id, 'resolved');
                        }
                      }}
                    >
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateAlertStatus(alert.id, 'false_positive')}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      False Positive
                    </Button>
                  </div>
                )}

                {alert.status === 'acknowledged' && (
                  <div className="space-y-2 pt-2 border-t">
                    <Textarea
                      placeholder="Add resolution notes (optional)"
                      value={resolutionNotes[alert.id] || ''}
                      onChange={(e) => setResolutionNotes(prev => ({ ...prev, [alert.id]: e.target.value }))}
                      className="min-h-20"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateAlertStatus(alert.id, 'resolved', resolutionNotes[alert.id])}
                      >
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateAlertStatus(alert.id, 'false_positive')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        False Positive
                      </Button>
                    </div>
                  </div>
                )}

                {alert.status === 'resolved' && alert.resolutionNotes && (
                  <div className="rounded-md bg-green-50 p-3 text-sm border-t pt-2">
                    <p className="font-medium text-green-900">Resolution Notes:</p>
                    <p className="text-green-800 mt-1">{alert.resolutionNotes}</p>
                  </div>
                )}

                {alert.status === 'false_positive' && (
                  <div className="text-sm text-muted-foreground border-t pt-2">
                    Marked as false positive
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
