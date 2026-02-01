import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Building2 } from 'lucide-react';
import { getOrganizations } from '@/lib/db/admin-queries';

export default async function OrganizationsPage() {
  const organizations = await getOrganizations();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Organizations</h1>
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
            <div className="space-y-4">
              {organizations.map((org) => (
                <div key={org.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {org.planId || 'Free'} plan - {org.seatCount} seats
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Status: {org.subscriptionStatus || 'None'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
