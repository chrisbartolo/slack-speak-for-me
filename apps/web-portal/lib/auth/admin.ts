import 'server-only';
import { redirect } from 'next/navigation';
import { verifySession } from './dal';
import { db, schema } from '../db';
import { and, eq } from 'drizzle-orm';

const { users, workspaces, organizations } = schema;

export interface AdminSession {
  userId: string;
  workspaceId: string;
  organizationId?: string;
  role: 'admin' | 'member' | 'viewer';
}

/**
 * Verify user has admin role
 * Redirects to dashboard if not admin
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await verifySession();

  // Query user with role and org info
  const [user] = await db
    .select({
      role: users.role,
      organizationId: workspaces.organizationId,
    })
    .from(users)
    .innerJoin(workspaces, eq(users.workspaceId, workspaces.id))
    .where(
      and(
        eq(users.workspaceId, session.workspaceId),
        eq(users.slackUserId, session.userId)
      )
    )
    .limit(1);

  if (!user || user.role !== 'admin') {
    redirect('/dashboard');
  }

  return {
    userId: session.userId,
    workspaceId: session.workspaceId,
    organizationId: user.organizationId ?? undefined,
    role: user.role as 'admin',
  };
}

/**
 * Check if user is admin (non-blocking)
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await verifySession();

    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(
        and(
          eq(users.workspaceId, session.workspaceId),
          eq(users.slackUserId, session.userId)
        )
      )
      .limit(1);

    return user?.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Get user's organization with billing info
 */
export async function getOrganization(organizationId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return org ?? null;
}
