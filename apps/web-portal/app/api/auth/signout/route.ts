import { deleteSession, getSession } from '@/lib/auth/session';
import { auditLogout } from '@/lib/audit';
import { NextResponse } from 'next/server';

export async function POST() {
  // Get session before deleting to log the logout event
  const session = await getSession();

  if (session?.userId && session?.workspaceId) {
    // Log logout event before destroying session
    auditLogout(session.userId, session.workspaceId);
  }

  await deleteSession();
  return NextResponse.json({ success: true });
}
