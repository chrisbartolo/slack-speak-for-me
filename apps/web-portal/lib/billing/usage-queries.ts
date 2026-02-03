import 'server-only';
import { db, schema } from '@/lib/db';
import { eq, and, desc, lte, sql } from 'drizzle-orm';

const { usageRecords, usageEvents, users, workspaces } = schema;

/**
 * Get current billing period usage for a user by email
 */
export async function getCurrentUsage(email: string): Promise<{
  suggestionsUsed: number;
  suggestionsIncluded: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
} | null> {
  const now = new Date();
  const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [record] = await db
    .select({
      suggestionsUsed: usageRecords.suggestionsUsed,
      suggestionsIncluded: usageRecords.suggestionsIncluded,
      billingPeriodStart: usageRecords.billingPeriodStart,
      billingPeriodEnd: usageRecords.billingPeriodEnd,
    })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.email, email),
        eq(usageRecords.billingPeriodStart, billingPeriodStart)
      )
    )
    .limit(1);

  if (!record) {
    return null;
  }

  return {
    suggestionsUsed: record.suggestionsUsed,
    suggestionsIncluded: record.suggestionsIncluded,
    billingPeriodStart: record.billingPeriodStart,
    billingPeriodEnd: record.billingPeriodEnd,
  };
}

/**
 * Get usage history for a user (last N months)
 */
export async function getUsageHistory(
  email: string,
  months: number = 6
): Promise<Array<{
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  suggestionsUsed: number;
  suggestionsIncluded: number;
}>> {
  const records = await db
    .select({
      billingPeriodStart: usageRecords.billingPeriodStart,
      billingPeriodEnd: usageRecords.billingPeriodEnd,
      suggestionsUsed: usageRecords.suggestionsUsed,
      suggestionsIncluded: usageRecords.suggestionsIncluded,
    })
    .from(usageRecords)
    .where(eq(usageRecords.email, email))
    .orderBy(desc(usageRecords.billingPeriodStart))
    .limit(months);

  return records.map(record => ({
    billingPeriodStart: record.billingPeriodStart,
    billingPeriodEnd: record.billingPeriodEnd,
    suggestionsUsed: record.suggestionsUsed,
    suggestionsIncluded: record.suggestionsIncluded,
  }));
}

/**
 * Get aggregate usage summary for an organization (current billing period)
 */
export async function getOrgUsageSummary(organizationId: string): Promise<{
  totalUsers: number;
  totalSuggestions: number;
  averagePerUser: number;
  topUsers: Array<{
    email: string;
    suggestionsUsed: number;
  }>;
}> {
  const now = new Date();
  const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get all workspace IDs for this organization
  const orgWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.organizationId, organizationId));

  const workspaceIds = orgWorkspaces.map(w => w.id);

  if (workspaceIds.length === 0) {
    return {
      totalUsers: 0,
      totalSuggestions: 0,
      averagePerUser: 0,
      topUsers: [],
    };
  }

  // Get all users in these workspaces
  const orgUsers = await db
    .select({
      email: users.email,
    })
    .from(users)
    .where(
      sql`${users.workspaceId} = ANY(${workspaceIds})`
    );

  const emailList = orgUsers
    .map(u => u.email)
    .filter((email): email is string => email !== null);

  if (emailList.length === 0) {
    return {
      totalUsers: 0,
      totalSuggestions: 0,
      averagePerUser: 0,
      topUsers: [],
    };
  }

  // Get current period usage for all org users
  const usageData = await db
    .select({
      email: usageRecords.email,
      suggestionsUsed: usageRecords.suggestionsUsed,
    })
    .from(usageRecords)
    .where(
      and(
        sql`${usageRecords.email} = ANY(${emailList})`,
        eq(usageRecords.billingPeriodStart, billingPeriodStart)
      )
    )
    .orderBy(desc(usageRecords.suggestionsUsed))
    .limit(10);

  const totalSuggestions = usageData.reduce((sum, record) => sum + record.suggestionsUsed, 0);
  const totalUsers = emailList.length;
  const averagePerUser = totalUsers > 0 ? Math.round(totalSuggestions / totalUsers) : 0;

  return {
    totalUsers,
    totalSuggestions,
    averagePerUser,
    topUsers: usageData.map(record => ({
      email: record.email || '',
      suggestionsUsed: record.suggestionsUsed,
    })),
  };
}
