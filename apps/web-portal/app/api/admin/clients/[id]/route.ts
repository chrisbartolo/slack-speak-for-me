import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const { clientProfiles, clientContacts } = schema;

// Validation schema for updating client profiles
const updateClientSchema = z.object({
  companyName: z.string().min(1).optional(),
  domain: z.string().optional(),
  servicesProvided: z.array(z.string()).optional(),
  contractDetails: z.string().max(2000).optional(),
  accountManager: z.string().optional(),
  relationshipStatus: z.enum(['active', 'at_risk', 'churned']).optional(),
  lifetimeValue: z.number().int().optional(),
  startDate: z.string().optional(), // ISO date string
  renewalDate: z.string().optional(), // ISO date string
});

/**
 * PUT /api/admin/clients/[id]
 * Update a client profile
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateClientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Parse dates if provided
    const updateData: Record<string, any> = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.renewalDate) {
      updateData.renewalDate = new Date(data.renewalDate);
    }

    // Update profile with org ownership check
    const [profile] = await db
      .update(clientProfiles)
      .set(updateData)
      .where(
        and(
          eq(clientProfiles.id, id),
          eq(clientProfiles.organizationId, admin.organizationId)
        )
      )
      .returning();

    if (!profile) {
      return NextResponse.json(
        { error: 'Client profile not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Update client profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update client profile' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/clients/[id]
 * Delete a client profile
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    // First verify ownership
    const [existing] = await db
      .select()
      .from(clientProfiles)
      .where(
        and(
          eq(clientProfiles.id, id),
          eq(clientProfiles.organizationId, admin.organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Client profile not found or access denied' },
        { status: 404 }
      );
    }

    // Delete associated contacts first
    await db
      .delete(clientContacts)
      .where(eq(clientContacts.clientProfileId, id));

    // Delete the profile
    await db
      .delete(clientProfiles)
      .where(eq(clientProfiles.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete client profile error:', error);
    return NextResponse.json(
      { error: 'Failed to delete client profile' },
      { status: 500 }
    );
  }
}
