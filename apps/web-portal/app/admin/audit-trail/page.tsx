import { requireAdmin } from '@/lib/auth/admin';
import { getAuditTrail, getAuditTrailStats, getAdminAuditTrail } from '@/lib/admin/audit-trail';
import { getPlanFeatures } from '@/lib/admin/plan-features';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { AuditTrailClient } from '@/components/admin/audit-trail-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';

const { workspaces, organizations } = schema;

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await requireAdmin();

  // Get workspace to retrieve plan ID
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, session.workspaceId))
    .limit(1);

  // Get organization plan ID for feature gating
  let planId: string | null = null;
  if (workspace?.organizationId && session.organizationId) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1);

    planId = org?.planId ?? null;
  }

  const planFeatures = getPlanFeatures(planId);

  // Parse query params
  const page = parseInt((searchParams.page as string) || '1', 10);
  const pageSize = parseInt((searchParams.pageSize as string) || '50', 10);
  const action = searchParams.action as 'accepted' | 'refined' | 'dismissed' | 'sent' | undefined;
  const startDate = searchParams.startDate
    ? new Date(searchParams.startDate as string)
    : undefined;
  const endDate = searchParams.endDate
    ? new Date(searchParams.endDate as string)
    : undefined;

  // Fetch audit trail data
  const auditTrail = await getAuditTrail(
    session.organizationId,
    session.workspaceId,
    planId,
    {
      page,
      pageSize,
      action,
      startDate,
      endDate,
    }
  );

  // Fetch stats
  const stats = await getAuditTrailStats(session.organizationId, session.workspaceId);

  // Fetch admin audit logs
  const adminLogs = await getAdminAuditTrail(session.organizationId, session.workspaceId, {
    page: 1,
    pageSize: 10,
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Audit Trail</h1>
          <p className="text-muted-foreground mt-1">
            Track all AI-assisted response activity for compliance and oversight
          </p>
        </div>

        {/* Plan indicator */}
        <div className="flex items-center gap-2">
          {planFeatures.auditTrailTextVisible ? (
            <Badge variant="default" className="bg-green-600">
              Full text access
            </Badge>
          ) : (
            <Badge variant="secondary">Metadata only</Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {planFeatures.dataRetentionDays} days retention
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEntries.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last 24 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last24h.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Most Common Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{stats.mostCommonAction}</div>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2">
        {planFeatures.csvExportEnabled && (
          <a
            href={`/api/admin/audit-trail/export?format=csv${action ? `&action=${action}` : ''}${startDate ? `&startDate=${startDate.toISOString()}` : ''}${endDate ? `&endDate=${endDate.toISOString()}` : ''}`}
            download
          >
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </a>
        )}

        {planFeatures.pdfExportEnabled && (
          <a
            href={`/api/admin/audit-trail/export?format=pdf${action ? `&action=${action}` : ''}${startDate ? `&startDate=${startDate.toISOString()}` : ''}${endDate ? `&endDate=${endDate.toISOString()}` : ''}`}
            download
          >
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </a>
        )}

        {!planFeatures.csvExportEnabled && !planFeatures.pdfExportEnabled && (
          <Badge variant="secondary">
            Export not available in your plan
          </Badge>
        )}
      </div>

      {/* Audit Trail Table */}
      <Card>
        <CardHeader>
          <CardTitle>AI Response Activity</CardTitle>
          <CardDescription>
            All suggestions generated and user actions taken
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditTrailClient
            data={auditTrail.items}
            showText={planFeatures.auditTrailTextVisible}
            total={auditTrail.total}
            page={auditTrail.page}
            pageSize={auditTrail.pageSize}
            hasMore={auditTrail.hasMore}
            searchParams={{
              page: page.toString(),
              pageSize: pageSize.toString(),
              action: action,
              startDate: startDate?.toISOString(),
              endDate: endDate?.toISOString(),
            }}
          />
        </CardContent>
      </Card>

      {/* Admin Config Changes */}
      {adminLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Admin Configuration Changes</CardTitle>
            <CardDescription>
              Recent administrative actions and settings modifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {adminLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{log.action.replace('_', ' ')}</span>
                      {log.resource && (
                        <Badge variant="outline" className="text-xs">
                          {log.resource}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {log.userId || 'System'} • {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                    </div>
                    {log.details && (
                      <div className="text-sm mt-2 bg-muted p-2 rounded">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
