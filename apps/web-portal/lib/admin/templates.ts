import 'server-only';
import { db, schema } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getPlanFeatures } from './plan-features';

const { responseTemplates } = schema;

// Type exports
export type TemplateStatus = 'pending' | 'approved' | 'rejected';
export type TemplateType = 'canned' | 'starter' | 'playbook';

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100, 'Name must be 100 characters or less'),
  templateType: z.enum(['canned', 'starter', 'playbook'], {
    errorMap: () => ({ message: 'Invalid template type' }),
  }),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000, 'Content must be 5000 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
});

export interface GetTemplatesOptions {
  status?: 'all' | 'pending' | 'approved' | 'rejected';
  templateType?: 'canned' | 'starter' | 'playbook' | null;
}

/**
 * Get all templates for an organization with optional filters.
 * Orders pending templates first, then by creation date.
 */
export async function getTemplates(
  organizationId: string,
  options?: GetTemplatesOptions
) {
  const { status = 'all', templateType = null } = options || {};

  let query = db
    .select()
    .from(responseTemplates)
    .where(eq(responseTemplates.organizationId, organizationId))
    .$dynamic();

  // Apply status filter
  if (status !== 'all') {
    query = query.where(eq(responseTemplates.status, status));
  }

  // Apply template type filter
  if (templateType) {
    query = query.where(eq(responseTemplates.templateType, templateType));
  }

  // Order: pending first, then by createdAt DESC
  const templates = await query.orderBy(
    sql`CASE WHEN ${responseTemplates.status} = 'pending' THEN 0 ELSE 1 END`,
    desc(responseTemplates.createdAt)
  );

  return templates;
}

/**
 * Create a new template.
 * Validates against plan limits and requires approval.
 */
export async function createTemplate(
  organizationId: string,
  planId: string | null | undefined,
  submittedBy: string,
  data: z.infer<typeof createTemplateSchema>
) {
  // Validate input
  const validation = createTemplateSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(validation.error.errors[0].message);
  }

  // Check approved template count against plan limit
  const planFeatures = getPlanFeatures(planId);
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(responseTemplates)
    .where(
      and(
        eq(responseTemplates.organizationId, organizationId),
        eq(responseTemplates.status, 'approved')
      )
    );

  const approvedCount = Number(countResult?.count || 0);
  if (approvedCount >= planFeatures.maxTemplates) {
    throw new Error(`Template limit reached for your plan (${planFeatures.maxTemplates} max)`);
  }

  // Create template with pending status
  const [template] = await db
    .insert(responseTemplates)
    .values({
      organizationId,
      name: validation.data.name,
      templateType: validation.data.templateType,
      content: validation.data.content,
      description: validation.data.description,
      submittedBy,
      status: 'pending',
    })
    .returning();

  return template;
}

/**
 * Approve a template.
 * Sets status to approved and records reviewer info.
 */
export async function approveTemplate(
  templateId: string,
  organizationId: string,
  adminUserId: string
) {
  const [template] = await db
    .update(responseTemplates)
    .set({
      status: 'approved',
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      rejectionReason: null, // Clear any previous rejection reason
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(responseTemplates.id, templateId),
        eq(responseTemplates.organizationId, organizationId)
      )
    )
    .returning();

  if (!template) {
    throw new Error('Template not found or access denied');
  }

  return template;
}

/**
 * Reject a template.
 * Sets status to rejected and records reviewer info and reason.
 */
export async function rejectTemplate(
  templateId: string,
  organizationId: string,
  adminUserId: string,
  reason?: string
) {
  const [template] = await db
    .update(responseTemplates)
    .set({
      status: 'rejected',
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      rejectionReason: reason || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(responseTemplates.id, templateId),
        eq(responseTemplates.organizationId, organizationId)
      )
    )
    .returning();

  if (!template) {
    throw new Error('Template not found or access denied');
  }

  return template;
}

/**
 * Delete a template (admin only).
 * Hard delete from database.
 */
export async function deleteTemplate(
  templateId: string,
  organizationId: string
) {
  // First verify ownership
  const [existing] = await db
    .select()
    .from(responseTemplates)
    .where(
      and(
        eq(responseTemplates.id, templateId),
        eq(responseTemplates.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new Error('Template not found or access denied');
  }

  // Delete the template
  await db.delete(responseTemplates).where(eq(responseTemplates.id, templateId));

  return { success: true };
}

/**
 * Get only approved templates for an organization.
 * Used by AI to suggest templates during response generation.
 */
export async function getApprovedTemplates(organizationId: string) {
  const templates = await db
    .select()
    .from(responseTemplates)
    .where(
      and(
        eq(responseTemplates.organizationId, organizationId),
        eq(responseTemplates.status, 'approved')
      )
    )
    .orderBy(desc(responseTemplates.createdAt));

  return templates;
}
