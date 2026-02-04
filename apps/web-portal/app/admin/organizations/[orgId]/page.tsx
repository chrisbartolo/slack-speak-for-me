import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Building2, Users, CreditCard, Calendar } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/admin';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { getOrganization } from '@/lib/auth/admin';
import { getOrganizationUserPlans } from '@/lib/billing/plan-management';
import { PlanManagementTable } from '../../plan-management/plan-management-table';

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await requireAdmin();
  const superAdmin = await isSuperAdmin();

  // Access control: super admins see any org, regular admins only their own
  if (!superAdmin && session.organizationId !== orgId) {
    redirect('/admin/organizations');
  }

  const org = await getOrganization(orgId);
  if (!org) notFound();

  const users = await getOrganizationUserPlans(orgId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/organizations" className="hover:text-foreground transition-colors">
          Organizations
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{org.name}</span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{org.name}</h1>
        <p className="text-muted-foreground mt-1">
          {users.length} {users.length === 1 ? 'user' : 'users'} in this organization
        </p>
      </div>

      {/* Org summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{org.planId || 'Free'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              className={
                org.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' :
                org.subscriptionStatus === 'trialing' ? 'bg-blue-100 text-blue-700' :
                org.subscriptionStatus === 'canceled' ? 'bg-red-100 text-red-700' :
                ''
              }
              variant="secondary"
            >
              {org.subscriptionStatus
                ? org.subscriptionStatus.charAt(0).toUpperCase() + org.subscriptionStatus.slice(1)
                : 'No subscription'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Seats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{org.seatCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'Unknown'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users with plan management */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{superAdmin ? 'Users & Plan Management' : 'Users'}</h2>
        <PlanManagementTable users={users} showWorkspace isSuperAdmin={superAdmin} />
      </div>
    </div>
  );
}
