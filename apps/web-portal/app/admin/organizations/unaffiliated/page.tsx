import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { getUnaffiliatedUserPlans } from '@/lib/billing/plan-management';
import { PlanManagementTable } from '../../plan-management/plan-management-table';

export default async function UnaffiliatedUsersPage() {
  await requireSuperAdmin();

  const users = await getUnaffiliatedUserPlans();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/organizations" className="hover:text-foreground transition-colors">
          Organizations
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Unaffiliated</span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Unaffiliated Users</h1>
        <p className="text-muted-foreground mt-1">
          Users in workspaces not linked to any organization ({users.length})
        </p>
      </div>

      {/* Users with plan management */}
      <PlanManagementTable users={users} showWorkspace isSuperAdmin />
    </div>
  );
}
