import { google } from 'googleapis';
import { db, googleIntegrations, encrypt, decrypt } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { getEncryptionKey, getGoogleClientId, getGoogleClientSecret, getGoogleRedirectUri } from '../env.js';

const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

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
 * Generate Google OAuth consent URL with state parameter
 *
 * @param workspaceId - Workspace ID for state tracking
 * @param userId - Slack user ID for state tracking
 * @returns OAuth consent URL
 */
export function getGoogleAuthUrl(workspaceId: string, userId: string): string {
  const oauth2Client = createOAuth2Client();

  // Encode state parameter with workspace and user info
  const state = Buffer.from(JSON.stringify({ workspaceId, userId })).toString('base64');

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
 * @throws Error if code exchange fails or state is invalid
 */
export async function handleGoogleCallback(code: string, state: string): Promise<{ workspaceId: string; userId: string }> {
  // Decode and validate state parameter
  let stateData: { workspaceId: string; userId: string };
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8');
    stateData = JSON.parse(decoded);

    if (!stateData.workspaceId || !stateData.userId) {
      throw new Error('Invalid state parameter: missing workspaceId or userId');
    }
  } catch (error) {
    throw new Error('Invalid state parameter');
  }

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
    console.warn('Failed to revoke Google token:', error);
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
