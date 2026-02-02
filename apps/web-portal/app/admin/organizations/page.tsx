import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { Building2, Users } from 'lucide-react';
import { getOrganizations } from '@/lib/db/admin-queries';

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="secondary">No subscription</Badge>;

  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    trialing: 'default',
    past_due: 'secondary',
    paused: 'secondary',
    canceled: 'destructive',
  };

  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 hover:bg-green-100',
    trialing: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    past_due: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
    paused: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    canceled: 'bg-red-100 text-red-700 hover:bg-red-100',
  };

  return (
    <Badge className={colors[status] || ''} variant={variants[status] || 'secondary'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default async function OrganizationsPage() {
  const organizations = await getOrganizations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Organizations</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organizations and workspaces
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Organizations</CardTitle>
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
                <div
                  key={org.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-accent/50 transition-colors"
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
                          {org.seatCount} {org.seatCount === 1 ? 'seat' : 'seats'}
                        </span>
                        <span>•</span>
                        <span>{org.planId || 'Free'} plan</span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={org.subscriptionStatus} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
