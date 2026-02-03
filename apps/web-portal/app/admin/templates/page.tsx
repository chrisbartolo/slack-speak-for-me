import { requireAdmin, getOrganization } from '@/lib/auth/admin';
import { getTemplates } from '@/lib/admin/templates';
import { getPlanFeatures } from '@/lib/admin/plan-features';
import { TemplateList } from './template-list';

export default async function AdminTemplatesPage() {
  // Only org admins can manage templates
  const admin = await requireAdmin();

  if (!admin.organizationId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Response Templates</h1>
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

  // Get all templates (filtering will be handled client-side)
  const allTemplates = await getTemplates(admin.organizationId, { status: 'all' });

  // Type assertion needed because Drizzle returns nullable status/templateType
  // but our schema guarantees they're always set with defaults
  const templates = allTemplates as Array<typeof allTemplates[0] & {
    status: 'pending' | 'approved' | 'rejected';
    templateType: 'canned' | 'starter' | 'playbook';
  }>;

  // Count approved templates for limit display
  const approvedCount = templates.filter((t) => t.status === 'approved').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">Response Templates</h1>
        <p className="text-muted-foreground mt-1">
          Manage shared response templates for your team
        </p>
      </div>

      <TemplateList
        templates={templates}
        maxTemplates={planFeatures.maxTemplates}
        approvedCount={approvedCount}
      />
    </div>
  );
}
