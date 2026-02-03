import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, ChevronRight, Globe } from 'lucide-react';
import { getOrganizationsWithCounts, getUnaffiliatedWorkspaces } from '@/lib/db/admin-queries';
import { isSuperAdmin } from '@/lib/auth/super-admin';

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="secondary">No subscription</Badge>;

  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 hover:bg-green-100',
    trialing: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    past_due: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
    paused: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    canceled: 'bg-red-100 text-red-700 hover:bg-red-100',
  };

  return (
    <Badge className={colors[status] || ''} variant="secondary">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default async function OrganizationsPage() {
  const organizations = await getOrganizationsWithCounts();
  const superAdmin = await isSuperAdmin();
  const unaffiliated = superAdmin ? await getUnaffiliatedWorkspaces() : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organizations</h1>
        <p className="text-muted-foreground mt-1">
          {superAdmin ? 'All organizations across the platform' : 'Manage your organization and users'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{superAdmin ? 'All Organizations' : 'Your Organization'}</CardTitle>
          <CardDescription>
            {organizations.length === 0
              ? 'No organizations found'
              : `${organizations.length} organization(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No organizations"
              description="Organizations are created when workspaces subscribe to a paid plan."
            />
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/admin/organizations/${org.id}`}
                  className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-lg">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{org.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {org.userCount} {org.userCount === 1 ? 'user' : 'users'}
                        </span>
                        <span>·</span>
                        <span>{org.workspaceCount} {org.workspaceCount === 1 ? 'workspace' : 'workspaces'}</span>
                        <span>·</span>
                        <span>{org.planId || 'Free'} plan</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={org.subscriptionStatus} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unaffiliated workspaces — super admin only */}
      {superAdmin && unaffiliated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unaffiliated Workspaces</CardTitle>
            <CardDescription>
              Workspaces not linked to any organization ({unaffiliated.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link
                href="/admin/organizations/unaffiliated"
                className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-muted rounded-lg">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">All Unaffiliated Users</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {unaffiliated.reduce((sum, w) => sum + w.userCount, 0)} users
                      </span>
                      <span>·</span>
                      <span>{unaffiliated.length} {unaffiliated.length === 1 ? 'workspace' : 'workspaces'}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
