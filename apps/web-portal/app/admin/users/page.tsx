import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Users } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/admin';
import { getWorkspaceUsers } from '@/lib/db/admin-queries';
import { Badge } from '@/components/ui/badge';

export default async function UsersPage() {
  const session = await requireAdmin();
  const users = await getWorkspaceUsers(session.workspaceId);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">
          Team members in your workspace
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {users.length} user(s) in this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users"
              description="Users appear here when they interact with the app."
            />
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{user.email || user.slackUserId}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.slackUserId}
                    </p>
                  </div>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                    {user.role || 'member'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
