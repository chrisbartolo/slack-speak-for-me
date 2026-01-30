/**
 * Unit tests for Google OAuth module
 *
 * Tests verify:
 * - OAuth URL generation with correct state encoding
 * - Token exchange and encryption on callback
 * - Client retrieval with token decryption
 * - Token refresh handling
 * - Access revocation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoist test constants that are used in mocks
const { TEST_ENCRYPTION_KEY, TEST_STATE_SECRET } = vi.hoisted(() => ({
  TEST_ENCRYPTION_KEY: Buffer.from('0'.repeat(64), 'hex'),
  TEST_STATE_SECRET: 'test-state-secret-for-oauth-state-signing',
}));

// Create hoisted mock functions for googleapis
const { mockGenerateAuthUrl, mockGetToken, mockSetCredentials, mockOn, mockRefreshAccessToken, mockRevokeCredentials } = vi.hoisted(() => ({
  mockGenerateAuthUrl: vi.fn(),
  mockGetToken: vi.fn(),
  mockSetCredentials: vi.fn(),
  mockOn: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
  mockRevokeCredentials: vi.fn(),
}));

// Create hoisted mock functions for database operations
const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
}));

// Mock the env module
vi.mock('../env.js', () => ({
  getEncryptionKey: () => TEST_ENCRYPTION_KEY,
  getGoogleClientId: () => 'test-google-client-id',
  getGoogleClientSecret: () => 'test-google-client-secret',
  getGoogleRedirectUri: () => 'http://localhost:3000/oauth/google/callback',
  env: {
    ANTHROPIC_API_KEY: 'test-key',
    SLACK_STATE_SECRET: TEST_STATE_SECRET,
  },
}));

// Import crypto for generating test states
import { createHmac, randomBytes } from 'crypto';

// Helper to create valid HMAC-signed state (mirrors production logic)
function createValidState(workspaceId: string, userId: string): string {
  const payload = {
    workspaceId,
    userId,
    ts: Date.now(),
    nonce: randomBytes(8).toString('hex'),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', TEST_STATE_SECRET)
    .update(payloadStr)
    .digest('base64url');
  return `${payloadStr}.${signature}`;
}

// Helper to create expired state
function createExpiredState(workspaceId: string, userId: string): string {
  const payload = {
    workspaceId,
    userId,
    ts: Date.now() - 15 * 60 * 1000, // 15 minutes ago (expired)
    nonce: randomBytes(8).toString('hex'),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', TEST_STATE_SECRET)
    .update(payloadStr)
    .digest('base64url');
  return `${payloadStr}.${signature}`;
}

// Helper to create state with invalid signature
function createTamperedState(workspaceId: string, userId: string): string {
  const payload = {
    workspaceId,
    userId,
    ts: Date.now(),
    nonce: randomBytes(8).toString('hex'),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadStr}.invalidsignature`;
}

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        setCredentials: mockSetCredentials,
        on: mockOn,
        refreshAccessToken: mockRefreshAccessToken,
        revokeCredentials: mockRevokeCredentials,
      })),
    },
  },
}));

// Mock the database module
vi.mock('@slack-speak/database', () => {
  // Simple mock encryption functions
  const mockEncrypt = (text: string) => `encrypted:${text}`;
  const mockDecrypt = (text: string) => text.replace('encrypted:', '');

  return {
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      update: mockDbUpdate,
      delete: mockDbDelete,
    },
    googleIntegrations: {
      workspaceId: 'workspaceId',
      userId: 'userId',
    },
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
  };
});

// Import after mocks are set up
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getGoogleClient,
  refreshGoogleTokens,
  revokeGoogleAccess,
} from './google-oauth.js';

describe('Google OAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations to defaults
    mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock=true');
    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expiry_date: Date.now() + 3600000,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
      },
    });
  });

  describe('getGoogleAuthUrl', () => {
    it('should generate OAuth consent URL with HMAC-signed state', () => {
      const workspaceId = 'W123456789';
      const userId = 'U123456789';

      const url = getGoogleAuthUrl(workspaceId, userId);

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets'],
        state: expect.any(String),
        prompt: 'consent',
      });

      // Verify state is in the new format: payload.signature
      const callArgs = mockGenerateAuthUrl.mock.calls[0][0];
      const stateParts = callArgs.state.split('.');
      expect(stateParts).toHaveLength(2);

      // Verify payload contains correct data
      const payload = JSON.parse(Buffer.from(stateParts[0], 'base64url').toString('utf-8'));
      expect(payload.workspaceId).toBe('W123456789');
      expect(payload.userId).toBe('U123456789');
      expect(payload.ts).toBeDefined();
      expect(payload.nonce).toBeDefined();

      expect(url).toBe('https://accounts.google.com/o/oauth2/auth?mock=true');
    });

    it('should request offline access for refresh token', () => {
      getGoogleAuthUrl('W123', 'U123');

      const callArgs = mockGenerateAuthUrl.mock.calls[0][0];
      expect(callArgs.access_type).toBe('offline');
    });

    it('should force consent prompt to ensure refresh token', () => {
      getGoogleAuthUrl('W123', 'U123');

      const callArgs = mockGenerateAuthUrl.mock.calls[0][0];
      expect(callArgs.prompt).toBe('consent');
    });

    it('should request spreadsheets scope', () => {
      getGoogleAuthUrl('W123', 'U123');

      const callArgs = mockGenerateAuthUrl.mock.calls[0][0];
      expect(callArgs.scope).toContain('https://www.googleapis.com/auth/spreadsheets');
    });

    it('should encode different workspaceId/userId pairs uniquely', () => {
      getGoogleAuthUrl('W111', 'U111');
      getGoogleAuthUrl('W222', 'U222');

      const state1 = mockGenerateAuthUrl.mock.calls[0][0].state;
      const state2 = mockGenerateAuthUrl.mock.calls[1][0].state;

      expect(state1).not.toBe(state2);
    });
  });

  describe('handleGoogleCallback', () => {
    beforeEach(() => {
      // Mock the database insert chain
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      });
    });

    it('should exchange code for tokens and store encrypted', async () => {
      const code = 'auth-code-123';
      const state = createValidState('W123', 'U456');

      const result = await handleGoogleCallback(code, state);

      expect(mockGetToken).toHaveBeenCalledWith(code);
      expect(result).toEqual({
        workspaceId: 'W123',
        userId: 'U456',
      });
    });

    it('should decode and validate state parameter', async () => {
      const state = createValidState('WWORKSPACE', 'UUSER');

      const result = await handleGoogleCallback('code', state);

      expect(result.workspaceId).toBe('WWORKSPACE');
      expect(result.userId).toBe('UUSER');
    });

    it('should throw on invalid state format (no signature)', async () => {
      await expect(handleGoogleCallback('code', 'not-valid-format')).rejects.toThrow(
        'Invalid state format'
      );
    });

    it('should throw on tampered state (invalid signature)', async () => {
      const tamperedState = createTamperedState('W123', 'U123');

      await expect(handleGoogleCallback('code', tamperedState)).rejects.toThrow(
        'Invalid state signature'
      );
    });

    it('should throw on expired state', async () => {
      const expiredState = createExpiredState('W123', 'U123');

      await expect(handleGoogleCallback('code', expiredState)).rejects.toThrow(
        'State parameter has expired'
      );
    });

    it('should throw on state missing workspaceId', async () => {
      // Create a state with missing workspaceId
      const payload = { userId: 'U123', ts: Date.now(), nonce: randomBytes(8).toString('hex') };
      const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = createHmac('sha256', TEST_STATE_SECRET).update(payloadStr).digest('base64url');
      const invalidState = `${payloadStr}.${signature}`;

      await expect(handleGoogleCallback('code', invalidState)).rejects.toThrow(
        'Invalid state parameter: missing workspaceId or userId'
      );
    });

    it('should throw on state missing userId', async () => {
      // Create a state with missing userId
      const payload = { workspaceId: 'W123', ts: Date.now(), nonce: randomBytes(8).toString('hex') };
      const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = createHmac('sha256', TEST_STATE_SECRET).update(payloadStr).digest('base64url');
      const invalidState = `${payloadStr}.${signature}`;

      await expect(handleGoogleCallback('code', invalidState)).rejects.toThrow(
        'Invalid state parameter: missing workspaceId or userId'
      );
    });

    it('should throw when no access token received', async () => {
      mockGetToken.mockResolvedValueOnce({
        tokens: {
          access_token: null,
          refresh_token: 'refresh',
        },
      });

      const state = createValidState('W123', 'U123');

      await expect(handleGoogleCallback('code', state)).rejects.toThrow(
        'No access token received from Google'
      );
    });

    it('should store tokens with upsert (insert on conflict update)', async () => {
      const state = createValidState('W123', 'U456');

      await handleGoogleCallback('code', state);

      expect(mockDbInsert).toHaveBeenCalled();

      // Verify the chain was called correctly
      const insertReturn = mockDbInsert.mock.results[0].value;
      expect(insertReturn.values).toHaveBeenCalled();

      const valuesReturn = insertReturn.values.mock.results[0].value;
      expect(valuesReturn.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should handle tokens without refresh token', async () => {
      mockGetToken.mockResolvedValueOnce({
        tokens: {
          access_token: 'access-only',
          refresh_token: null,
          expiry_date: Date.now() + 3600000,
        },
      });

      const state = createValidState('W123', 'U123');

      // Should not throw
      const result = await handleGoogleCallback('code', state);

      expect(result.workspaceId).toBe('W123');
    });

    it('should handle tokens without expiry date', async () => {
      mockGetToken.mockResolvedValueOnce({
        tokens: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expiry_date: null,
        },
      });

      const state = createValidState('W123', 'U123');

      // Should not throw
      await expect(handleGoogleCallback('code', state)).resolves.not.toThrow();
    });

    it('should propagate token exchange errors', async () => {
      const apiError = new Error('Invalid authorization code');
      mockGetToken.mockRejectedValueOnce(apiError);

      const state = createValidState('W123', 'U123');

      await expect(handleGoogleCallback('code', state)).rejects.toThrow(
        'Invalid authorization code'
      );
    });
  });

  describe('getGoogleClient', () => {
    const mockIntegration = {
      accessToken: 'encrypted:test-access-token',
      refreshToken: 'encrypted:test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      scope: 'https://www.googleapis.com/auth/spreadsheets',
    };

    beforeEach(() => {
      // Set up database select chain
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockIntegration]),
          }),
        }),
      });
    });

    it('should fetch integration from database', async () => {
      await getGoogleClient('W123', 'U456');

      expect(mockDbSelect).toHaveBeenCalled();
    });

    it('should throw when integration not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // Empty result
          }),
        }),
      });

      await expect(getGoogleClient('W123', 'U456')).rejects.toThrow(
        'Google integration not found for this user'
      );
    });

    it('should set credentials on OAuth2 client', async () => {
      await getGoogleClient('W123', 'U456');

      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: 'test-access-token', // Decrypted
        refresh_token: 'test-refresh-token', // Decrypted
        expiry_date: expect.any(Number),
        scope: 'https://www.googleapis.com/auth/spreadsheets',
      });
    });

    it('should handle integration without refresh token', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                ...mockIntegration,
                refreshToken: null,
              },
            ]),
          }),
        }),
      });

      await getGoogleClient('W123', 'U456');

      expect(mockSetCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh_token: undefined,
        })
      );
    });

    it('should handle integration without expiry date', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                ...mockIntegration,
                expiresAt: null,
              },
            ]),
          }),
        }),
      });

      await getGoogleClient('W123', 'U456');

      expect(mockSetCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          expiry_date: undefined,
        })
      );
    });

    it('should set up token refresh handler', async () => {
      await getGoogleClient('W123', 'U456');

      expect(mockOn).toHaveBeenCalledWith('tokens', expect.any(Function));
    });

    it('should update database when tokens are auto-refreshed', async () => {
      // Set up update chain
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await getGoogleClient('W123', 'U456');

      // Get the token refresh handler
      const tokenHandler = mockOn.mock.calls[0][1];

      // Simulate token refresh event
      await tokenHandler({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 7200000,
      });

      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('should keep existing refresh token if not provided in refresh', async () => {
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await getGoogleClient('W123', 'U456');

      const tokenHandler = mockOn.mock.calls[0][1];

      // Token refresh without new refresh_token
      await tokenHandler({
        access_token: 'new-access-token',
        // No refresh_token
      });

      const setCall = mockDbUpdate.mock.results[0].value.set.mock.calls[0][0];
      expect(setCall.refreshToken).toBe('encrypted:test-refresh-token'); // Original encrypted value
    });

    it('should return the OAuth2 client', async () => {
      const client = await getGoogleClient('W123', 'U456');

      expect(client).toBeDefined();
      expect(client.setCredentials).toBeDefined();
      expect(client.on).toBeDefined();
    });

    it('should handle integration without scope', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                ...mockIntegration,
                scope: null,
              },
            ]),
          }),
        }),
      });

      await getGoogleClient('W123', 'U456');

      expect(mockSetCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: undefined,
        })
      );
    });
  });

  describe('refreshGoogleTokens', () => {
    beforeEach(() => {
      // Set up getGoogleClient mock chain
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                accessToken: 'encrypted:test-access-token',
                refreshToken: 'encrypted:test-refresh-token',
                expiresAt: new Date(Date.now() + 3600000),
                scope: 'https://www.googleapis.com/auth/spreadsheets',
              },
            ]),
          }),
        }),
      });

      mockRefreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'refreshed-access-token',
          refresh_token: 'refreshed-refresh-token',
          expiry_date: Date.now() + 7200000,
        },
      });
    });

    it('should get client and force token refresh', async () => {
      await refreshGoogleTokens('W123', 'U456');

      expect(mockDbSelect).toHaveBeenCalled();
      expect(mockRefreshAccessToken).toHaveBeenCalled();
    });

    it('should propagate errors when integration not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(refreshGoogleTokens('W123', 'U456')).rejects.toThrow(
        'Google integration not found for this user'
      );
    });

    it('should propagate refresh errors', async () => {
      mockRefreshAccessToken.mockRejectedValueOnce(new Error('Token refresh failed'));

      await expect(refreshGoogleTokens('W123', 'U456')).rejects.toThrow('Token refresh failed');
    });
  });

  describe('revokeGoogleAccess', () => {
    beforeEach(() => {
      // Set up getGoogleClient mock chain
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                accessToken: 'encrypted:test-access-token',
                refreshToken: 'encrypted:test-refresh-token',
                expiresAt: new Date(Date.now() + 3600000),
                scope: 'https://www.googleapis.com/auth/spreadsheets',
              },
            ]),
          }),
        }),
      });

      mockRevokeCredentials.mockResolvedValue({ success: true });

      // Set up delete chain
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
    });

    it('should revoke token with Google', async () => {
      await revokeGoogleAccess('W123', 'U456');

      expect(mockRevokeCredentials).toHaveBeenCalled();
    });

    it('should delete integration from database', async () => {
      await revokeGoogleAccess('W123', 'U456');

      expect(mockDbDelete).toHaveBeenCalled();
    });

    it('should delete from database even if revoke fails', async () => {
      mockRevokeCredentials.mockRejectedValueOnce(new Error('Revoke API failed'));

      // Should not throw
      await revokeGoogleAccess('W123', 'U456');

      // Database deletion should still happen
      expect(mockDbDelete).toHaveBeenCalled();
    });

    it('should propagate error when integration not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(revokeGoogleAccess('W123', 'U456')).rejects.toThrow(
        'Google integration not found for this user'
      );
    });

    it('should use correct workspaceId and userId for deletion', async () => {
      await revokeGoogleAccess('WTEST', 'UTEST');

      expect(mockDbDelete).toHaveBeenCalled();
      // The where clause is called with the query conditions
      const whereCall = mockDbDelete.mock.results[0].value.where;
      expect(whereCall).toHaveBeenCalled();
    });
  });
});
