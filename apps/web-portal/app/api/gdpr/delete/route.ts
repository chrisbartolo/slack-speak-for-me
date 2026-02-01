import { NextRequest, NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/auth/session';
import { deleteUserData } from '@/lib/gdpr/data-deletion';
import { logAuditEvent } from '@/lib/audit';

/**
 * GDPR Data Deletion Endpoint
 *
 * Allows users to exercise their "right to be forgotten" (GDPR Article 17).
 * Deletes all user data and logs out the user.
 *
 * Requires explicit confirmation to prevent accidental deletion.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session?.userId || !session?.workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { confirm?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (body.confirm !== 'DELETE MY ACCOUNT') {
    return NextResponse.json(
      { error: 'Confirmation required. Send { confirm: "DELETE MY ACCOUNT" }' },
      { status: 400 }
    );
  }

  const { userId, workspaceId } = session;
  const slackUserId = session.userId; // session.userId is the Slack user ID
  const ipAddress = request.headers.get('x-forwarded-for') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  // Log deletion request before starting
  logAuditEvent({
    action: 'data_delete_requested',
    userId: slackUserId,
    workspaceId,
    ipAddress,
    userAgent,
    resource: 'user',
    resourceId: slackUserId,
    details: { requestedAt: new Date().toISOString() },
  });

  try {
    // Get internal user UUID from database for deletion
    // The session stores slackUserId as userId, but we need the internal UUID
    const { db, schema } = await import('@/lib/db');
    const { eq, and } = await import('drizzle-orm');

    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.workspaceId, workspaceId),
        eq(schema.users.slackUserId, slackUserId)
      ),
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete all user data
    await deleteUserData(user.id, workspaceId, slackUserId);

    // Log successful deletion
    logAuditEvent({
      action: 'data_delete_completed',
      userId: slackUserId,
      workspaceId,
      ipAddress,
      resource: 'user',
      resourceId: slackUserId,
      details: { completedAt: new Date().toISOString() },
    });

    // Destroy session to log out user
    await deleteSession();

    return NextResponse.json({
      success: true,
      message: 'Your account and all associated data have been deleted.',
      redirect: '/',
    });
  } catch (error) {
    console.error('Data deletion error:', error);

    // Log failure (but don't expose internal details)
    logAuditEvent({
      action: 'data_delete_requested',
      userId: slackUserId,
      workspaceId,
      details: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return NextResponse.json(
      { error: 'Failed to delete data. Please contact support.' },
      { status: 500 }
    );
  }
}
