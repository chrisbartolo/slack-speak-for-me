import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { BrandVoiceList } from './brand-voice-list';

const { brandVoiceTemplates } = schema;

export default async function AdminBrandVoicePage() {
  // Only org admins can manage brand voice templates
  const admin = await requireAdmin();

  if (!admin.organizationId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Brand Voice Templates</h1>
          <p className="text-muted-foreground mt-1">
            No organization found
          </p>
        </div>
      </div>
    );
  }

  const templates = await db
    .select()
    .from(brandVoiceTemplates)
    .where(eq(brandVoiceTemplates.organizationId, admin.organizationId))
    .orderBy(desc(brandVoiceTemplates.isDefault), desc(brandVoiceTemplates.updatedAt));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">Brand Voice Templates</h1>
        <p className="text-muted-foreground mt-1">
          Define response patterns and tone guidelines for client-facing communication
        </p>
      </div>

      <BrandVoiceList templates={templates} />
    </div>
  );
}
