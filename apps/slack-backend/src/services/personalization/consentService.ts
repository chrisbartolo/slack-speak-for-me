import { db, gdprConsent } from '@slack-speak/database';
import { eq, and, isNull, sql } from 'drizzle-orm';

/**
 * Consent types available for GDPR compliance
 */
export enum ConsentType {
  MESSAGE_HISTORY_ANALYSIS = 'message_history_analysis',
}

/**
 * Error thrown when consent is required but not granted
 */
export class ConsentRequiredError extends Error {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly consentType: ConsentType,
  ) {
    super(`Consent required: ${consentType} for user ${userId} in workspace ${workspaceId}`);
    this.name = 'ConsentRequiredError';
  }
}

/**
 * Consent status with full audit trail
 */
export interface ConsentStatus {
  hasConsent: boolean;
  consentedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Check if user has active consent for a specific type
 *
 * @param workspaceId - Workspace UUID
 * @param userId - Slack user ID
 * @param consentType - Type of consent to check
 * @returns true if user has granted and not revoked consent
 */
export async function hasConsent(
  workspaceId: string,
  userId: string,
  consentType: ConsentType,
): Promise<boolean> {
  const result = await db
    .select({
      consentedAt: gdprConsent.consentedAt,
      revokedAt: gdprConsent.revokedAt,
    })
    .from(gdprConsent)
    .where(
      and(
        eq(gdprConsent.workspaceId, workspaceId),
        eq(gdprConsent.userId, userId),
        eq(gdprConsent.consentType, consentType),
      ),
    )
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  const record = result[0];

  // Consent is active if consentedAt is set and revokedAt is null
  return record.consentedAt !== null && record.revokedAt === null;
}

/**
 * Grant consent for a user
 *
 * Creates a new consent record or updates existing revoked consent
 *
 * @param workspaceId - Workspace UUID
 * @param userId - Slack user ID
 * @param consentType - Type of consent to grant
 */
export async function grantConsent(
  workspaceId: string,
  userId: string,
  consentType: ConsentType,
): Promise<void> {
  await db
    .insert(gdprConsent)
    .values({
      workspaceId,
      userId,
      consentType,
      consentedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [gdprConsent.workspaceId, gdprConsent.userId, gdprConsent.consentType],
      set: {
        consentedAt: sql`now()`,
        revokedAt: sql`null`,
      },
    });
}

/**
 * Revoke consent for a user
 *
 * Sets revokedAt timestamp while preserving original consentedAt for audit trail
 *
 * @param workspaceId - Workspace UUID
 * @param userId - Slack user ID
 * @param consentType - Type of consent to revoke
 */
export async function revokeConsent(
  workspaceId: string,
  userId: string,
  consentType: ConsentType,
): Promise<void> {
  await db
    .update(gdprConsent)
    .set({
      revokedAt: sql`now()`,
    })
    .where(
      and(
        eq(gdprConsent.workspaceId, workspaceId),
        eq(gdprConsent.userId, userId),
        eq(gdprConsent.consentType, consentType),
      ),
    );
}

/**
 * Get full consent status with audit trail
 *
 * @param workspaceId - Workspace UUID
 * @param userId - Slack user ID
 * @param consentType - Type of consent to check
 * @returns Consent status or null if no record exists
 */
export async function getConsentStatus(
  workspaceId: string,
  userId: string,
  consentType: ConsentType,
): Promise<ConsentStatus | null> {
  const result = await db
    .select()
    .from(gdprConsent)
    .where(
      and(
        eq(gdprConsent.workspaceId, workspaceId),
        eq(gdprConsent.userId, userId),
        eq(gdprConsent.consentType, consentType),
      ),
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const record = result[0];

  return {
    hasConsent: record.consentedAt !== null && record.revokedAt === null,
    consentedAt: record.consentedAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt!,
  };
}

/**
 * Require consent or throw error
 *
 * Helper for service layer to enforce consent requirements
 *
 * @param workspaceId - Workspace UUID
 * @param userId - Slack user ID
 * @param consentType - Type of consent required
 * @throws ConsentRequiredError if consent not granted
 */
export async function requireConsent(
  workspaceId: string,
  userId: string,
  consentType: ConsentType,
): Promise<void> {
  const granted = await hasConsent(workspaceId, userId, consentType);

  if (!granted) {
    throw new ConsentRequiredError(workspaceId, userId, consentType);
  }
}
