import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Users, User, Shield } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/admin';
import { getWorkspaceUsers } from '@/lib/db/admin-queries';
import { Badge } from '@/components/ui/badge';

export default async function UsersPage() {
  const session = await requireAdmin();
  const users = await getWorkspaceUsers(session.workspaceId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
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
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-lg">
                      {user.role === 'admin' ? (
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user.email || user.slackUserId}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.slackUserId}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={user.role === 'admin' ? 'default' : 'secondary'}
                    className={user.role === 'admin' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100' : ''}
                  >
                    {user.role === 'admin' ? 'Admin' : 'Member'}
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
