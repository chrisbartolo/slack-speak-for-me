import 'server-only';
import { redirect } from 'next/navigation';
import { verifySession } from './dal';
import { db, users } from '@slack-speak/database';
import { and, eq } from 'drizzle-orm';

/**
 * Super Admin Emails - Platform administrators who can manage coupons, view all orgs, etc.
 * Add your email(s) here to grant super admin access.
 */
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Check if user is a super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  try {
    const session = await verifySession();

    // Get user email from session or database
    let email: string | null = session.email?.toLowerCase() || null;

    if (!email && session.workspaceId && session.userId) {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(
          and(
            eq(users.workspaceId, session.workspaceId),
            eq(users.slackUserId, session.userId)
          )
        )
        .limit(1);
      email = user?.email?.toLowerCase() || null;
    }

    return !!email && SUPER_ADMIN_EMAILS.includes(email);
  } catch {
    return false;
  }
}

/**
 * Require super admin access
 * Redirects to dashboard if not a super admin
 */
export async function requireSuperAdmin(): Promise<{ email: string }> {
  const session = await verifySession();

  // Get user email
  let email: string | null = session.email?.toLowerCase() || null;

  if (!email && session.workspaceId && session.userId) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.workspaceId, session.workspaceId),
          eq(users.slackUserId, session.userId)
        )
      )
      .limit(1);
    email = user?.email?.toLowerCase() || null;
  }

  if (!email || !SUPER_ADMIN_EMAILS.includes(email)) {
    redirect('/dashboard');
  }

  return { email };
}
