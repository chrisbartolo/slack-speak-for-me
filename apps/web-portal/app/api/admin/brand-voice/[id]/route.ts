import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const { brandVoiceTemplates } = schema;

// Validation schema for updating brand voice templates
const updateBrandVoiceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  toneGuidelines: z.string().min(1).max(2000).optional(),
  approvedPhrases: z.array(z.string().max(200)).optional(),
  forbiddenPhrases: z.array(z.string().max(200)).optional(),
  responsePatterns: z.array(z.object({
    situation: z.string().max(200),
    pattern: z.string().max(500),
  })).optional(),
  isDefault: z.boolean().optional(),
  applicableTo: z.enum(['all', 'client_conversations', 'internal_only']).optional(),
});

/**
 * PUT /api/admin/brand-voice/[id]
 * Update a brand voice template
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateBrandVoiceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // If setting as default, clear other defaults first
    if (data.isDefault === true) {
      await db
        .update(brandVoiceTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(brandVoiceTemplates.organizationId, admin.organizationId),
            eq(brandVoiceTemplates.isDefault, true)
          )
        );
    }

    // Update template with org ownership check
    const [template] = await db
      .update(brandVoiceTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(brandVoiceTemplates.id, id),
          eq(brandVoiceTemplates.organizationId, admin.organizationId)
        )
      )
      .returning();

    if (!template) {
      return NextResponse.json(
        { error: 'Brand voice template not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Update brand voice template error:', error);
    return NextResponse.json(
      { error: 'Failed to update brand voice template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/brand-voice/[id]
 * Delete a brand voice template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const { id } = await params;

    // First verify ownership
    const [existing] = await db
      .select()
      .from(brandVoiceTemplates)
      .where(
        and(
          eq(brandVoiceTemplates.id, id),
          eq(brandVoiceTemplates.organizationId, admin.organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Brand voice template not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the template
    await db
      .delete(brandVoiceTemplates)
      .where(eq(brandVoiceTemplates.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete brand voice template error:', error);
    return NextResponse.json(
      { error: 'Failed to delete brand voice template' },
      { status: 500 }
    );
  }
}
