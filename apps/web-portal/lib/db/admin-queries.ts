import 'server-only';
import { cache } from 'react';
import { eq, desc, count, isNull, sql } from 'drizzle-orm';
import { db, schema } from './index';
import { requireAdmin } from '../auth/admin';
import { isSuperAdmin, requireSuperAdmin } from '../auth/super-admin';

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
  await requireSuperAdmin();

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

/**
 * Get organizations with user and workspace counts.
 * Super admins see all, regular admins see their own.
 */
export const getOrganizationsWithCounts = cache(async () => {
  const session = await requireAdmin();
  const superAdmin = await isSuperAdmin();

  // Build base query - get orgs with workspace count
  const baseQuery = db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      planId: organizations.planId,
      seatCount: organizations.seatCount,
      subscriptionStatus: organizations.subscriptionStatus,
      createdAt: organizations.createdAt,
      workspaceCount: count(workspaces.id),
    })
    .from(organizations)
    .leftJoin(workspaces, eq(workspaces.organizationId, organizations.id))
    .groupBy(organizations.id)
    .orderBy(desc(organizations.createdAt));

  const orgs = superAdmin
    ? await baseQuery
    : session.organizationId
      ? await baseQuery.where(eq(organizations.id, session.organizationId))
      : [];

  // Get user counts per org (separate query to avoid double-join counting issues)
  const orgIds = orgs.map(o => o.id);
  if (orgIds.length === 0) return [];

  const userCountRows = await db
    .select({
      orgId: workspaces.organizationId,
      userCount: count(users.id),
    })
    .from(users)
    .innerJoin(workspaces, eq(users.workspaceId, workspaces.id))
    .where(sql`${workspaces.organizationId} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(workspaces.organizationId);

  const userCountMap = Object.fromEntries(
    userCountRows.map(r => [r.orgId, r.userCount])
  );

  return orgs.map(org => ({
    ...org,
    userCount: userCountMap[org.id] ?? 0,
  }));
});

/**
 * Get workspaces that are not linked to any organization, with user counts.
 * Super-admin only — cross-org data.
 */
export const getUnaffiliatedWorkspaces = cache(async () => {
  await requireSuperAdmin();

  const results = await db
    .select({
      id: workspaces.id,
      teamId: workspaces.teamId,
      name: workspaces.name,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      userCount: count(users.id),
    })
    .from(workspaces)
    .leftJoin(users, eq(users.workspaceId, workspaces.id))
    .where(isNull(workspaces.organizationId))
    .groupBy(workspaces.id)
    .orderBy(desc(workspaces.createdAt));

  return results;
});
