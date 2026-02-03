import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { approveTemplate, rejectTemplate, deleteTemplate } from '@/lib/admin/templates';
import { z } from 'zod';

// Validation schema for PUT body
const updateTemplateBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

/**
 * PUT /api/admin/templates/[id]
 * Approve or reject a template (admin only).
 * Body: { action: 'approve' | 'reject', reason?: string }
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

    // Parse and validate body
    const body = await request.json();
    const validation = updateTemplateBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { action, reason } = validation.data;

    // Perform action
    let template;
    if (action === 'approve') {
      template = await approveTemplate(id, admin.organizationId, admin.userId);
    } else {
      template = await rejectTemplate(id, admin.organizationId, admin.userId, reason);
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Update template error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/templates/[id]
 * Delete a template (admin only).
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

    // Delete template
    await deleteTemplate(id, admin.organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
