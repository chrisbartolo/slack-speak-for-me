import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Users, User, Shield } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/admin';
import { getWorkspaceUsers, getAllUsers } from '@/lib/db/admin-queries';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { Badge } from '@/components/ui/badge';

export default async function UsersPage() {
  const session = await requireAdmin();
  const superAdmin = await isSuperAdmin();

  // Super admins see all users across all workspaces
  const allUsers = superAdmin ? await getAllUsers() : null;
  const workspaceUsers = superAdmin ? null : await getWorkspaceUsers(session.workspaceId);
  const userList = allUsers ?? workspaceUsers ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1">
          {superAdmin ? 'All users across all workspaces' : 'Team members in your workspace'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{superAdmin ? 'All Users' : 'Team Members'}</CardTitle>
          <CardDescription>
            {userList.length} user(s){superAdmin ? ' across all workspaces' : ' in this workspace'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userList.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users"
              description="Users appear here when they interact with the app."
            />
          ) : (
            <div className="space-y-3">
              {userList.map((user) => (
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
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{user.slackUserId}</span>
                        {'workspaceName' in user && user.workspaceName && (
                          <>
                            <span>·</span>
                            <span>{user.workspaceName}</span>
                          </>
                        )}
                      </div>
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
