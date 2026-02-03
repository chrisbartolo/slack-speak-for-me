import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const { brandVoiceTemplates } = schema;

// Validation schema for creating/updating brand voice templates
const createBrandVoiceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  toneGuidelines: z.string().min(1, 'Tone guidelines are required').max(2000, 'Tone guidelines must be 2000 characters or less'),
  approvedPhrases: z.array(z.string().max(200, 'Each phrase must be 200 characters or less')).optional(),
  forbiddenPhrases: z.array(z.string().max(200, 'Each phrase must be 200 characters or less')).optional(),
  responsePatterns: z.array(z.object({
    situation: z.string().max(200, 'Situation must be 200 characters or less'),
    pattern: z.string().max(500, 'Pattern must be 500 characters or less'),
  })).optional(),
  isDefault: z.boolean().optional(),
  applicableTo: z.enum(['all', 'client_conversations', 'internal_only']).optional(),
});

/**
 * GET /api/admin/brand-voice
 * List all brand voice templates for admin's organization
 */
export async function GET() {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const templates = await db
      .select()
      .from(brandVoiceTemplates)
      .where(eq(brandVoiceTemplates.organizationId, admin.organizationId))
      .orderBy(desc(brandVoiceTemplates.isDefault), desc(brandVoiceTemplates.updatedAt));

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Get brand voice templates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand voice templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/brand-voice
 * Create a new brand voice template
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = createBrandVoiceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // If setting as default, clear other defaults first
    if (data.isDefault) {
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

    const [template] = await db
      .insert(brandVoiceTemplates)
      .values({
        organizationId: admin.organizationId,
        name: data.name,
        description: data.description,
        toneGuidelines: data.toneGuidelines,
        approvedPhrases: data.approvedPhrases,
        forbiddenPhrases: data.forbiddenPhrases,
        responsePatterns: data.responsePatterns,
        isDefault: data.isDefault ?? false,
        applicableTo: data.applicableTo,
      })
      .returning();

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Create brand voice template error:', error);
    return NextResponse.json(
      { error: 'Failed to create brand voice template' },
      { status: 500 }
    );
  }
}
