import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { getOptionalSession } from '@/lib/auth/dal';
import { getOrganization } from '@/lib/auth/admin';
import { getTemplates, createTemplate } from '@/lib/admin/templates';
import { z } from 'zod';

// Validation schema for POST body
const createTemplateBodySchema = z.object({
  name: z.string().min(3).max(100),
  templateType: z.enum(['canned', 'starter', 'playbook']),
  content: z.string().min(10).max(5000),
  description: z.string().max(500).optional(),
});

/**
 * GET /api/admin/templates
 * List templates with optional filters.
 * Query params: ?status=pending&type=canned
 */
export async function GET(request: NextRequest) {
  try {
    // Use getOptionalSession in API routes (verifySession's redirect throws in try/catch)
    const session = await getOptionalSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get organization ID from admin session
    const admin = await requireAdmin();
    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = (searchParams.get('status') as 'all' | 'pending' | 'approved' | 'rejected') || 'all';
    const templateType = searchParams.get('type') as 'canned' | 'starter' | 'playbook' | null;

    // Get templates with filters
    const templates = await getTemplates(admin.organizationId, {
      status,
      templateType,
    });

    // Get organization for plan info
    const org = await getOrganization(admin.organizationId);

    return NextResponse.json({
      templates,
      planId: org?.planId || 'free',
    });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/templates
 * Create a new template.
 * Any authenticated user can submit templates for admin review.
 */
export async function POST(request: NextRequest) {
  try {
    // Use getOptionalSession in API routes (verifySession's redirect throws in try/catch)
    const session = await getOptionalSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get organization ID from admin context
    const admin = await requireAdmin();
    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = createTemplateBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Get organization for plan check
    const org = await getOrganization(admin.organizationId);

    // Create template
    const template = await createTemplate(
      admin.organizationId,
      org?.planId || 'free',
      session.userId,
      validation.data
    );

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);

    // Check if it's a plan limit error
    if (error instanceof Error && error.message.includes('limit reached')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
