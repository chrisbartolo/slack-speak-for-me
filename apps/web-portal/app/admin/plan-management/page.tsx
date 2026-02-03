import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { requireAdmin } from '@/lib/auth/admin';
import { getWorkspaceUserPlans } from '@/lib/billing/plan-management';
import { PlanManagementTable } from './plan-management-table';

export default async function PlanManagementPage() {
  await requireSuperAdmin();
  const session = await requireAdmin();

  const users = await getWorkspaceUserPlans(session.workspaceId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">Plans & Usage</h1>
        <p className="text-muted-foreground mt-1">
          Manage user plans, grant bonus suggestions, and reset usage counters
        </p>
      </div>

      <PlanManagementTable users={users} />
    </div>
  );
}
