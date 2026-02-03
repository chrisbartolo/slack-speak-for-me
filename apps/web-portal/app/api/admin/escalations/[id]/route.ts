import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

const { escalationAlerts } = schema;

const updateAlertSchema = z.object({
  status: z.enum(['acknowledged', 'resolved', 'false_positive']),
  resolutionNotes: z.string().optional(),
});

/**
 * PUT /api/admin/escalations/[id]
 * Update escalation alert status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateAlertSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { status, resolutionNotes } = validation.data;

    // Verify alert belongs to admin's organization
    const [existingAlert] = await db
      .select()
      .from(escalationAlerts)
      .where(
        and(
          eq(escalationAlerts.id, params.id),
          eq(escalationAlerts.organizationId, admin.organizationId)
        )
      )
      .limit(1);

    if (!existingAlert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Build update values based on status
    const updateValues: any = {
      status,
    };

    if (status === 'acknowledged') {
      updateValues.acknowledgedBy = admin.userId;
      updateValues.acknowledgedAt = new Date();
    } else if (status === 'resolved') {
      updateValues.acknowledgedBy = admin.userId;
      updateValues.acknowledgedAt = sql`COALESCE(acknowledged_at, NOW())`;
      updateValues.resolvedAt = new Date();
      if (resolutionNotes) {
        updateValues.resolutionNotes = resolutionNotes;
      }
    }

    // Update alert
    const [updated] = await db
      .update(escalationAlerts)
      .set(updateValues)
      .where(
        and(
          eq(escalationAlerts.id, params.id),
          eq(escalationAlerts.organizationId, admin.organizationId)
        )
      )
      .returning();

    return NextResponse.json({ alert: updated });
  } catch (error) {
    console.error('Update escalation alert error:', error);
    return NextResponse.json(
      { error: 'Failed to update escalation alert' },
      { status: 500 }
    );
  }
}
