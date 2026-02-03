import 'server-only';
import { cache } from 'react';
import { eq, desc, count } from 'drizzle-orm';
import { db, schema } from './index';
import { requireAdmin } from '../auth/admin';
import { isSuperAdmin } from '../auth/super-admin';

const { organizations, workspaces, users } = schema;

/**
 * Get all organizations (for super-admin)
 * Or get the admin's own organization
 */
export const getOrganizations = cache(async () => {
  const session = await requireAdmin();
  const superAdmin = await isSuperAdmin();

  // Super admins see all organizations
  if (superAdmin) {
    return db
      .select()
      .from(organizations)
      .orderBy(desc(organizations.createdAt));
  }

  // Regular admins see only their own organization
  if (session.organizationId) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1);

    return org ? [org] : [];
  }

  // No org yet - return empty
  return [];
});

/**
 * Get workspaces for an organization
 */
export const getOrganizationWorkspaces = cache(async (organizationId: string) => {
  await requireAdmin(); // Verify admin access

  const results = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.organizationId, organizationId))
    .orderBy(desc(workspaces.createdAt));

  return results;
});

/**
 * Get users for a workspace
 */
export const getWorkspaceUsers = cache(async (workspaceId: string) => {
  await requireAdmin(); // Verify admin access

  const results = await db
    .select()
    .from(users)
    .where(eq(users.workspaceId, workspaceId))
    .orderBy(desc(users.createdAt));

  return results;
});

/**
 * Get all users across all workspaces (super-admin only)
 */
export const getAllUsers = cache(async () => {
  await requireAdmin();

  const results = await db
    .select({
      id: users.id,
      slackUserId: users.slackUserId,
      workspaceId: users.workspaceId,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      workspaceName: workspaces.name,
    })
    .from(users)
    .innerJoin(workspaces, eq(users.workspaceId, workspaces.id))
    .orderBy(desc(users.createdAt));

  return results;
});

/**
 * Get user count per workspace
 */
export const getUserCounts = cache(async (organizationId: string) => {
  await requireAdmin();

  const results = await db
    .select({
      workspaceId: workspaces.id,
      userCount: count(users.id),
    })
    .from(workspaces)
    .leftJoin(users, eq(users.workspaceId, workspaces.id))
    .where(eq(workspaces.organizationId, organizationId))
    .groupBy(workspaces.id);

  return Object.fromEntries(results.map(r => [r.workspaceId, r.userCount]));
});
