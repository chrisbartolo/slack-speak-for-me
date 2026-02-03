import { requireAdmin } from '@/lib/auth/admin';
import { getOrganization } from '@/lib/auth/admin';
import { getOrgUsageSummary } from '@/lib/billing/usage-queries';
import { UsageAnalyticsTable } from '@/components/admin/usage-analytics';

export const metadata = { title: 'Usage Analytics' };

export default async function AdminUsagePage() {
  const admin = await requireAdmin();

  if (!admin.organizationId) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usage Analytics</h1>
          <p className="text-muted-foreground mt-1">
            No organization found. Organization-level usage analytics require an active organization.
          </p>
        </div>
      </div>
    );
  }

  const org = await getOrganization(admin.organizationId);

  if (!org) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usage Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Organization not found.
          </p>
        </div>
      </div>
    );
  }

  const summary = await getOrgUsageSummary(org.id);

  const billingPeriodLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Usage Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Organization-wide AI suggestion usage for the current billing period
        </p>
      </div>

      <UsageAnalyticsTable
        totalUsers={summary.totalUsers}
        totalSuggestions={summary.totalSuggestions}
        averagePerUser={summary.averagePerUser}
        topUsers={summary.topUsers}
        billingPeriodLabel={billingPeriodLabel}
      />
    </div>
  );
}
