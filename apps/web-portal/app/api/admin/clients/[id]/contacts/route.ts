import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const { clientProfiles, clientContacts, workspaces } = schema;

// Validation schema for adding a contact
const addContactSchema = z.object({
  slackUserId: z.string().min(1, 'Slack user ID is required'),
  slackUserName: z.string().optional(),
  role: z.string().optional(),
});

// Validation schema for removing a contact
const removeContactSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
});

/**
 * GET /api/admin/clients/[id]/contacts
 * List all contacts for a client profile
 */
export async function GET(
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

    // Verify profile ownership
    const [profile] = await db
      .select()
      .from(clientProfiles)
      .where(
        and(
          eq(clientProfiles.id, id),
          eq(clientProfiles.organizationId, admin.organizationId)
        )
      )
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: 'Client profile not found or access denied' },
        { status: 404 }
      );
    }

    // Get all contacts for this profile
    const contacts = await db
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientProfileId, id));

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Get client contacts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client contacts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/clients/[id]/contacts
 * Add a contact to a client profile
 */
export async function POST(
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

    // Verify profile ownership
    const [profile] = await db
      .select()
      .from(clientProfiles)
      .where(
        and(
          eq(clientProfiles.id, id),
          eq(clientProfiles.organizationId, admin.organizationId)
        )
      )
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: 'Client profile not found or access denied' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = addContactSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get workspace ID for this admin
    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.organizationId, admin.organizationId))
      .limit(1);

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 400 }
      );
    }

    // Add contact (upsert to handle duplicates)
    const [contact] = await db
      .insert(clientContacts)
      .values({
        clientProfileId: id,
        workspaceId: workspace.id,
        slackUserId: data.slackUserId,
        slackUserName: data.slackUserName,
        role: data.role,
      })
      .onConflictDoNothing()
      .returning();

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error('Add client contact error:', error);
    return NextResponse.json(
      { error: 'Failed to add client contact' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/clients/[id]/contacts
 * Remove a contact from a client profile
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

    const body = await request.json();
    const validation = removeContactSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { contactId } = validation.data;

    // Verify profile ownership
    const [profile] = await db
      .select()
      .from(clientProfiles)
      .where(
        and(
          eq(clientProfiles.id, id),
          eq(clientProfiles.organizationId, admin.organizationId)
        )
      )
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: 'Client profile not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the contact
    await db
      .delete(clientContacts)
      .where(
        and(
          eq(clientContacts.id, contactId),
          eq(clientContacts.clientProfileId, id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove client contact error:', error);
    return NextResponse.json(
      { error: 'Failed to remove client contact' },
      { status: 500 }
    );
  }
}
