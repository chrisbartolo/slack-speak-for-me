import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import {
  getYoloModeSettings,
  updateYoloModeGlobal,
  updateYoloModeUser,
} from '@/lib/admin/org-style';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const { users, workspaces } = schema;

export async function GET() {
  try {
    const session = await requireAdmin();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    const settings = await getYoloModeSettings(session.organizationId);

    // Get list of users in the organization
    const orgUsers = await db
      .select({
        slackUserId: users.slackUserId,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .innerJoin(workspaces, eq(users.workspaceId, workspaces.id))
      .where(eq(workspaces.organizationId, session.organizationId));

    // Combine with override status
    const usersWithStatus = orgUsers.map((user) => ({
      slackUserId: user.slackUserId,
      email: user.email,
      role: user.role,
      override: settings.userOverrides[user.slackUserId] ?? null,
      effectiveStatus:
        settings.userOverrides[user.slackUserId] ?? settings.globalEnabled,
    }));

    return NextResponse.json({
      globalEnabled: settings.globalEnabled,
      userOverrides: settings.userOverrides,
      users: usersWithStatus,
    });
  } catch (error) {
    console.error('Get YOLO mode settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch YOLO mode settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { global, userId, enabled } = body;

    // Update global setting
    if (global !== undefined) {
      await updateYoloModeGlobal(session.organizationId, global);
      return NextResponse.json({ success: true, globalEnabled: global });
    }

    // Update user-specific override
    if (userId !== undefined) {
      const result = await updateYoloModeUser(
        session.organizationId,
        userId,
        enabled ?? null
      );
      return NextResponse.json({
        success: true,
        userId,
        enabled,
        userOverrides: result.userOverrides,
      });
    }

    return NextResponse.json(
      { error: 'Either global or userId must be provided' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update YOLO mode error:', error);
    return NextResponse.json(
      { error: 'Failed to update YOLO mode settings' },
      { status: 500 }
    );
  }
}
