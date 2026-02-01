import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { exportUserData } from '@/lib/gdpr/data-export';
import { logAuditEvent } from '@/lib/audit';

/**
 * GET /api/gdpr/export
 *
 * GDPR Article 20 - Right to Data Portability
 * Returns all user data in a structured, machine-readable JSON format.
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Validate authenticated user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, workspaceId } = session;
    // userId from session is the Slack user ID
    const slackUserId = userId;

    // Log audit event: data export requested
    logAuditEvent({
      action: 'data_export_requested',
      userId: slackUserId,
      workspaceId,
      resource: 'user',
      resourceId: slackUserId,
      details: { requestedAt: new Date().toISOString() },
    });

    // Export all user data
    const exportData = await exportUserData(
      workspaceId, // The user record uses workspaceId
      workspaceId,
      slackUserId
    );

    // Log audit event: data export completed
    logAuditEvent({
      action: 'data_export_completed',
      userId: slackUserId,
      workspaceId,
      resource: 'user',
      resourceId: slackUserId,
      details: {
        completedAt: new Date().toISOString(),
        dataSize: JSON.stringify(exportData).length,
      },
    });

    // Return as downloadable JSON file
    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition':
          'attachment; filename="speak-for-me-data-export.json"',
        'Cache-Control': 'no-store', // Don't cache personal data
      },
    });
  } catch (error) {
    // Log error but don't leak details to client
    console.error('GDPR data export failed:', error);

    return NextResponse.json(
      { error: 'Failed to export data. Please try again later.' },
      { status: 500 }
    );
  }
}
