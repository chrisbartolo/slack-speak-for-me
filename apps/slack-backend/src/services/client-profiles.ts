import { db, clientProfiles, clientContacts, workspaces } from '@slack-speak/database';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

/**
 * Get all client profiles for an organization
 * Returns profiles ordered by most recently updated
 */
export async function getClientProfiles(organizationId: string) {
  return await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.organizationId, organizationId))
    .orderBy(desc(clientProfiles.updatedAt));
}

/**
 * Get a single client profile by ID with organization check
 */
export async function getClientProfileById(id: string, organizationId: string) {
  const [result] = await db
    .select()
    .from(clientProfiles)
    .where(
      and(
        eq(clientProfiles.id, id),
        eq(clientProfiles.organizationId, organizationId)
      )
    )
    .limit(1);

  return result ?? null;
}

/**
 * Create a new client profile
 */
export async function createClientProfile(data: {
  organizationId: string;
  companyName: string;
  domain?: string;
  servicesProvided?: string[];
  contractDetails?: string;
  accountManager?: string;
  relationshipStatus?: string;
  lifetimeValue?: number;
  startDate?: Date;
  renewalDate?: Date;
}) {
  // Validate contractDetails length (max 2000 chars)
  if (data.contractDetails && data.contractDetails.length > 2000) {
    throw new Error('Contract details must be 2000 characters or less');
  }

  const [result] = await db
    .insert(clientProfiles)
    .values({
      organizationId: data.organizationId,
      companyName: data.companyName,
      domain: data.domain,
      servicesProvided: data.servicesProvided,
      contractDetails: data.contractDetails,
      accountManager: data.accountManager,
      relationshipStatus: data.relationshipStatus || 'active',
      lifetimeValue: data.lifetimeValue,
      startDate: data.startDate,
      renewalDate: data.renewalDate,
    })
    .returning();

  logger.info({
    clientProfileId: result.id,
    organizationId: data.organizationId,
    companyName: data.companyName,
  }, 'Created client profile');

  return result;
}

/**
 * Update an existing client profile
 */
export async function updateClientProfile(
  id: string,
  organizationId: string,
  data: Partial<{
    companyName: string;
    domain: string;
    servicesProvided: string[];
    contractDetails: string;
    accountManager: string;
    relationshipStatus: string;
    lifetimeValue: number;
    startDate: Date;
    renewalDate: Date;
  }>
) {
  // Validate contractDetails length if provided
  if (data.contractDetails && data.contractDetails.length > 2000) {
    throw new Error('Contract details must be 2000 characters or less');
  }

  const [result] = await db
    .update(clientProfiles)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clientProfiles.id, id),
        eq(clientProfiles.organizationId, organizationId)
      )
    )
    .returning();

  if (!result) {
    throw new Error('Client profile not found or access denied');
  }

  logger.info({
    clientProfileId: id,
    organizationId,
  }, 'Updated client profile');

  return result;
}

/**
 * Delete a client profile and cascade to contacts
 */
export async function deleteClientProfile(id: string, organizationId: string) {
  // Delete contacts first
  await db
    .delete(clientContacts)
    .where(eq(clientContacts.clientProfileId, id));

  // Delete the profile
  const [result] = await db
    .delete(clientProfiles)
    .where(
      and(
        eq(clientProfiles.id, id),
        eq(clientProfiles.organizationId, organizationId)
      )
    )
    .returning();

  if (!result) {
    throw new Error('Client profile not found or access denied');
  }

  logger.info({
    clientProfileId: id,
    organizationId,
  }, 'Deleted client profile');

  return result;
}

/**
 * Look up if a Slack user is a client contact
 * This is critical for AI integration to identify client conversations
 */
export async function getClientContactBySlackUserId(
  workspaceId: string,
  slackUserId: string
) {
  const [result] = await db
    .select()
    .from(clientContacts)
    .where(
      and(
        eq(clientContacts.workspaceId, workspaceId),
        eq(clientContacts.slackUserId, slackUserId)
      )
    )
    .limit(1);

  return result ?? null;
}

/**
 * Get all contacts for a client profile
 */
export async function getClientContactsByProfile(clientProfileId: string) {
  return await db
    .select()
    .from(clientContacts)
    .where(eq(clientContacts.clientProfileId, clientProfileId));
}

/**
 * Add a client contact (upsert to handle duplicates)
 */
export async function addClientContact(data: {
  clientProfileId: string;
  workspaceId: string;
  slackUserId: string;
  slackUserName?: string;
  role?: string;
}) {
  const [result] = await db
    .insert(clientContacts)
    .values({
      clientProfileId: data.clientProfileId,
      workspaceId: data.workspaceId,
      slackUserId: data.slackUserId,
      slackUserName: data.slackUserName,
      role: data.role,
    })
    .onConflictDoNothing()
    .returning();

  if (result) {
    logger.info({
      clientProfileId: data.clientProfileId,
      slackUserId: data.slackUserId,
    }, 'Added client contact');
  }

  return result;
}

/**
 * Remove a client contact by ID
 */
export async function removeClientContact(id: string) {
  const [result] = await db
    .delete(clientContacts)
    .where(eq(clientContacts.id, id))
    .returning();

  if (result) {
    logger.info({
      contactId: id,
      clientProfileId: result.clientProfileId,
    }, 'Removed client contact');
  }

  return result;
}
