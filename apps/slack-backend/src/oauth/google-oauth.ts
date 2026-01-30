import { google } from 'googleapis';
import { db, googleIntegrations, encrypt, decrypt } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { createHmac, randomBytes } from 'crypto';
import { getEncryptionKey, getGoogleClientId, getGoogleClientSecret, getGoogleRedirectUri, env } from '../env.js';
import { logger } from '../utils/logger.js';

const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// State parameter expiration (10 minutes)
const STATE_EXPIRATION_MS = 10 * 60 * 1000;

/**
 * Creates an OAuth2 client with the configured credentials
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    getGoogleClientId(),
    getGoogleClientSecret(),
    getGoogleRedirectUri()
  );
}

/**
 * Generate a secure, HMAC-signed state parameter
 * Includes timestamp for expiration and nonce to prevent replay attacks
 */
function generateSecureState(workspaceId: string, userId: string): string {
  const payload = {
    workspaceId,
    userId,
    ts: Date.now(),
    nonce: randomBytes(8).toString('hex'),
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', env.SLACK_STATE_SECRET)
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Validate and decode the HMAC-signed state parameter
 * @throws Error if signature is invalid or state has expired
 */
function validateSecureState(state: string): { workspaceId: string; userId: string } {
  const parts = state.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid state format');
  }

  const [payloadStr, providedSignature] = parts;

  // Verify HMAC signature
  const expectedSignature = createHmac('sha256', env.SLACK_STATE_SECRET)
    .update(payloadStr)
    .digest('base64url');

  if (providedSignature !== expectedSignature) {
    throw new Error('Invalid state signature');
  }

  // Decode and parse payload
  const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));

  // Check expiration
  if (Date.now() - payload.ts > STATE_EXPIRATION_MS) {
    throw new Error('State parameter has expired');
  }

  if (!payload.workspaceId || !payload.userId) {
    throw new Error('Invalid state parameter: missing workspaceId or userId');
  }

  return { workspaceId: payload.workspaceId, userId: payload.userId };
}

/**
 * Generate Google OAuth consent URL with secure state parameter
 *
 * @param workspaceId - Workspace ID for state tracking
 * @param userId - Slack user ID for state tracking
 * @returns OAuth consent URL
 */
export function getGoogleAuthUrl(workspaceId: string, userId: string): string {
  const oauth2Client = createOAuth2Client();

  // Generate HMAC-signed state parameter with expiration
  const state = generateSecureState(workspaceId, userId);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request refresh token
    scope: GOOGLE_SCOPES,
    state,
    prompt: 'consent', // Force consent screen to ensure refresh token
  });
}

/**
 * Handle OAuth callback and store encrypted tokens
 *
 * @param code - Authorization code from OAuth callback
 * @param state - State parameter from OAuth callback
 * @returns Object containing workspaceId and userId from state
 * @throws Error if code exchange fails, state is invalid, or state has expired
 */
export async function handleGoogleCallback(code: string, state: string): Promise<{ workspaceId: string; userId: string }> {
  // Validate HMAC signature and check expiration
  const stateData = validateSecureState(state);

  const oauth2Client = createOAuth2Client();

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error('No access token received from Google');
  }

  const encryptionKey = getEncryptionKey();

  // Encrypt tokens before storage
  const encryptedAccessToken = encrypt(tokens.access_token, encryptionKey);
  const encryptedRefreshToken = tokens.refresh_token
    ? encrypt(tokens.refresh_token, encryptionKey)
    : null;

  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  // Store tokens in database (upsert)
  await db
    .insert(googleIntegrations)
    .values({
      workspaceId: stateData.workspaceId,
      userId: stateData.userId,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt,
      scope: tokens.scope || GOOGLE_SCOPES.join(' '),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [googleIntegrations.workspaceId, googleIntegrations.userId],
      set: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        scope: tokens.scope || GOOGLE_SCOPES.join(' '),
        updatedAt: new Date(),
      },
    });

  return stateData;
}

/**
 * Get authenticated OAuth2 client for making API calls
 * Automatically handles token refresh
 *
 * @param workspaceId - Workspace ID
 * @param userId - Slack user ID
 * @returns Authenticated OAuth2Client
 * @throws Error if integration not found or tokens are invalid
 */
export async function getGoogleClient(workspaceId: string, userId: string) {
  // Fetch integration from database
  const [integration] = await db
    .select()
    .from(googleIntegrations)
    .where(
      and(
        eq(googleIntegrations.workspaceId, workspaceId),
        eq(googleIntegrations.userId, userId)
      )
    )
    .limit(1);

  if (!integration) {
    throw new Error('Google integration not found for this user');
  }

  const encryptionKey = getEncryptionKey();

  // Decrypt tokens
  const accessToken = decrypt(integration.accessToken, encryptionKey);
  const refreshToken = integration.refreshToken
    ? decrypt(integration.refreshToken, encryptionKey)
    : null;

  const oauth2Client = createOAuth2Client();

  // Set credentials
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
    expiry_date: integration.expiresAt?.getTime(),
    scope: integration.scope || undefined,
  });

  // Set up automatic token refresh handler
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      // Update stored tokens when auto-refreshed
      const encryptedAccessToken = encrypt(tokens.access_token, encryptionKey);
      const encryptedRefreshToken = tokens.refresh_token
        ? encrypt(tokens.refresh_token, encryptionKey)
        : integration.refreshToken; // Keep existing refresh token if not provided

      const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

      await db
        .update(googleIntegrations)
        .set({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(googleIntegrations.workspaceId, workspaceId),
            eq(googleIntegrations.userId, userId)
          )
        );
    }
  });

  return oauth2Client;
}

/**
 * Force refresh of Google OAuth tokens
 *
 * @param workspaceId - Workspace ID
 * @param userId - Slack user ID
 * @throws Error if integration not found or refresh fails
 */
export async function refreshGoogleTokens(workspaceId: string, userId: string): Promise<void> {
  const oauth2Client = await getGoogleClient(workspaceId, userId);

  // Force token refresh
  await oauth2Client.refreshAccessToken();
}

/**
 * Revoke Google OAuth access and remove stored tokens
 *
 * @param workspaceId - Workspace ID
 * @param userId - Slack user ID
 * @throws Error if integration not found or revocation fails
 */
export async function revokeGoogleAccess(workspaceId: string, userId: string): Promise<void> {
  // Get client to revoke tokens
  const oauth2Client = await getGoogleClient(workspaceId, userId);

  try {
    // Revoke the token with Google
    await oauth2Client.revokeCredentials();
  } catch (error) {
    // Log but don't fail - we still want to remove from our DB
    logger.warn({ error }, 'Failed to revoke Google token');
  }

  // Remove from database
  await db
    .delete(googleIntegrations)
    .where(
      and(
        eq(googleIntegrations.workspaceId, workspaceId),
        eq(googleIntegrations.userId, userId)
      )
    );
}
