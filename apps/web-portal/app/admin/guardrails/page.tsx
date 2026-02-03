import { requireAdmin, getOrganization } from '@/lib/auth/admin';
import { getGuardrailConfig, getViolationStats, PREDEFINED_CATEGORIES } from '@/lib/admin/guardrails';
import { getPlanFeatures } from '@/lib/admin/plan-features';
import { GuardrailsConfig } from './guardrails-config';
import { ViolationsReport } from './violations-report';

export default async function AdminGuardrailsPage() {
  // Only org admins can manage guardrails
  const admin = await requireAdmin();

  if (!admin.organizationId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Content Guardrails</h1>
          <p className="text-muted-foreground mt-1">
            No organization found
          </p>
        </div>
      </div>
    );
  }

  // Get organization for plan info
  const org = await getOrganization(admin.organizationId);
  const planFeatures = getPlanFeatures(org?.planId);

  // Get guardrail config
  const config = await getGuardrailConfig(admin.organizationId);

  // Get violation stats (last 30 days)
  const violationStats = await getViolationStats(admin.organizationId, 30);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">Content Guardrails</h1>
        <p className="text-muted-foreground mt-1">
          Control what AI can and cannot suggest to your team
        </p>
      </div>

      <GuardrailsConfig
        config={config}
        planFeatures={planFeatures}
        predefinedCategories={PREDEFINED_CATEGORIES}
      />

      <ViolationsReport stats={violationStats} />
    </div>
  );
}
