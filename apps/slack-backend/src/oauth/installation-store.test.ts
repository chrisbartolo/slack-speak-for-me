/**
 * Unit tests for OAuth installation store
 *
 * Tests verify:
 * - Token encryption before storage
 * - Token decryption on retrieval
 * - Workspace upsert behavior
 * - Error handling for missing data
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import type { Installation, InstallationQuery } from '@slack/bolt';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as schema from '@slack-speak/database';
import { encrypt, decrypt } from '@slack-speak/database';

// Test encryption key (32 bytes as hex)
const TEST_ENCRYPTION_KEY = Buffer.from('0'.repeat(64), 'hex');

// Mock the env module
vi.mock('../env.js', () => ({
  getEncryptionKey: () => TEST_ENCRYPTION_KEY,
  env: {
    ANTHROPIC_API_KEY: 'test-key',
  },
}));

// Create PGlite instance and drizzle db
let pgLite: PGlite;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

// Mock the @slack-speak/database module to use our test database
vi.mock('@slack-speak/database', async () => {
  const actual = await vi.importActual('@slack-speak/database');
  return {
    ...actual,
    get db() {
      return testDb;
    },
  };
});

// SQL schema for test database (using gen_random_uuid() which is built-in to PGlite/PG13+)
const createTablesSQL = `
  CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
    plan_id TEXT,
    seat_count INTEGER DEFAULT 1,
    trial_ends_at TIMESTAMP,
    billing_email TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL UNIQUE,
    enterprise_id TEXT,
    name TEXT,
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) UNIQUE,
    bot_token TEXT NOT NULL,
    bot_user_id TEXT,
    bot_scopes TEXT,
    user_token TEXT,
    user_id TEXT,
    user_scopes TEXT,
    installed_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX installations_workspace_id_idx ON installations(workspace_id);

  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    slack_user_id TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX users_workspace_id_idx ON users(workspace_id);
  CREATE INDEX users_slack_user_id_idx ON users(slack_user_id);
`;

// Import after mocks are set up
import { installationStore } from './installation-store.js';

describe('Installation Store', () => {
  beforeEach(async () => {
    // Create fresh PGlite instance for each test
    pgLite = new PGlite();
    testDb = drizzle(pgLite, { schema });
    await pgLite.exec(createTablesSQL);
  });

  afterEach(async () => {
    if (pgLite) {
      await pgLite.close();
    }
    vi.clearAllMocks();
  });

  // Helper to create a test installation
  const createTestInstallation = (overrides: Partial<Installation> = {}): Installation => ({
    team: { id: 'T123TEST', name: 'Test Team' },
    bot: {
      token: 'xoxb-secret-bot-token',
      userId: 'B123',
      scopes: ['chat:write', 'commands'],
      id: 'B123',
    },
    user: { id: 'U123', token: undefined, scopes: ['users:read'] },
    ...overrides,
  });

  // Helper to query raw installation from database
  const getRawInstallation = async (workspaceId: string) => {
    const result = await testDb
      .select()
      .from(schema.installations)
      .where(eq(schema.installations.workspaceId, workspaceId))
      .limit(1);
    return result[0];
  };

  // Helper to get workspace
  const getWorkspace = async (teamId: string) => {
    const result = await testDb
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.teamId, teamId))
      .limit(1);
    return result[0];
  };

  describe('storeInstallation', () => {
    it('should store new installation with encrypted bot token', async () => {
      const installation = createTestInstallation();

      await installationStore.storeInstallation(installation);

      // Verify workspace created
      const workspace = await getWorkspace('T123TEST');
      expect(workspace).toBeDefined();
      expect(workspace.teamId).toBe('T123TEST');
      expect(workspace.name).toBe('Test Team');

      // Verify installation created with encrypted token
      const rawInstallation = await getRawInstallation(workspace.id);
      expect(rawInstallation).toBeDefined();

      // Token should be encrypted (not plaintext)
      expect(rawInstallation.botToken).not.toBe('xoxb-secret-bot-token');
      expect(rawInstallation.botToken).toContain(':'); // Encrypted format contains colons

      // Decrypt and verify
      const decryptedToken = decrypt(rawInstallation.botToken, TEST_ENCRYPTION_KEY);
      expect(decryptedToken).toBe('xoxb-secret-bot-token');
    });

    it('should encrypt user token when provided', async () => {
      const installation = createTestInstallation({
        user: {
          id: 'U123',
          token: 'xoxp-secret-user-token',
          scopes: ['users:read'],
        },
      });

      await installationStore.storeInstallation(installation);

      const workspace = await getWorkspace('T123TEST');
      const rawInstallation = await getRawInstallation(workspace.id);

      // User token should be encrypted
      expect(rawInstallation.userToken).not.toBe('xoxp-secret-user-token');
      expect(rawInstallation.userToken).toContain(':');

      // Decrypt and verify
      const decryptedUserToken = decrypt(rawInstallation.userToken!, TEST_ENCRYPTION_KEY);
      expect(decryptedUserToken).toBe('xoxp-secret-user-token');
    });

    it('should create workspace on first installation', async () => {
      const installation = createTestInstallation({
        team: { id: 'TNEWTEAM', name: 'Brand New Team' },
      });

      await installationStore.storeInstallation(installation);

      const workspace = await getWorkspace('TNEWTEAM');
      expect(workspace).toBeDefined();
      expect(workspace.teamId).toBe('TNEWTEAM');
      expect(workspace.name).toBe('Brand New Team');
    });

    it('should update workspace on reinstallation', async () => {
      // First installation
      const installation1 = createTestInstallation({
        team: { id: 'TEXISTING', name: 'Original Name' },
      });
      await installationStore.storeInstallation(installation1);

      // Reinstall with different name
      const installation2 = createTestInstallation({
        team: { id: 'TEXISTING', name: 'Updated Name' },
      });
      await installationStore.storeInstallation(installation2);

      // Should only have one workspace with updated name
      const workspaces = await testDb.select().from(schema.workspaces);
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].name).toBe('Updated Name');
    });

    it('should update installation on reinstall (upsert)', async () => {
      // First installation
      const installation1 = createTestInstallation({
        bot: {
          token: 'xoxb-first-token',
          userId: 'B123',
          scopes: ['chat:write'],
          id: 'B123',
        },
      });
      await installationStore.storeInstallation(installation1);

      // Reinstall with new token
      const installation2 = createTestInstallation({
        bot: {
          token: 'xoxb-second-token',
          userId: 'B456',
          scopes: ['chat:write', 'commands'],
          id: 'B456',
        },
      });
      await installationStore.storeInstallation(installation2);

      // Should only have one installation with new token
      const installations = await testDb.select().from(schema.installations);
      expect(installations).toHaveLength(1);

      const decryptedToken = decrypt(installations[0].botToken, TEST_ENCRYPTION_KEY);
      expect(decryptedToken).toBe('xoxb-second-token');
      expect(installations[0].botUserId).toBe('B456');
    });

    it('should throw when neither teamId nor enterpriseId provided', async () => {
      const installation = createTestInstallation({
        team: undefined,
        enterprise: undefined,
      });

      await expect(installationStore.storeInstallation(installation)).rejects.toThrow(
        'Installation must have either teamId or enterpriseId'
      );
    });

    it('should handle enterprise installation', async () => {
      const installation = createTestInstallation({
        team: { id: 'TTEAM', name: 'Team in Enterprise' },
        enterprise: { id: 'E123ENTERPRISE', name: 'Enterprise Org' },
      });

      await installationStore.storeInstallation(installation);

      const workspace = await getWorkspace('TTEAM');
      expect(workspace).toBeDefined();
      expect(workspace.enterpriseId).toBe('E123ENTERPRISE');
    });

    it('should store bot scopes correctly', async () => {
      const installation = createTestInstallation({
        bot: {
          token: 'xoxb-token',
          userId: 'B123',
          scopes: ['chat:write', 'commands', 'users:read'],
          id: 'B123',
        },
      });

      await installationStore.storeInstallation(installation);

      const workspace = await getWorkspace('T123TEST');
      const rawInstallation = await getRawInstallation(workspace.id);
      expect(rawInstallation.botScopes).toBe('chat:write,commands,users:read');
    });

    it('should store user scopes correctly', async () => {
      const installation = createTestInstallation({
        user: {
          id: 'U123',
          token: 'xoxp-token',
          scopes: ['users:read', 'channels:history'],
        },
      });

      await installationStore.storeInstallation(installation);

      const workspace = await getWorkspace('T123TEST');
      const rawInstallation = await getRawInstallation(workspace.id);
      expect(rawInstallation.userScopes).toBe('users:read,channels:history');
    });

    it('should handle installation without bot token', async () => {
      const installation = createTestInstallation({
        bot: undefined,
      });

      await installationStore.storeInstallation(installation);

      const workspace = await getWorkspace('T123TEST');
      const rawInstallation = await getRawInstallation(workspace.id);

      // Bot token should be empty string when not provided
      expect(rawInstallation.botToken).toBe('');
    });
  });

  describe('fetchInstallation', () => {
    it('should fetch and decrypt bot token', async () => {
      const installation = createTestInstallation();
      await installationStore.storeInstallation(installation);

      const query: InstallationQuery<false> = {
        teamId: 'T123TEST',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      const fetched = await installationStore.fetchInstallation(query);

      expect(fetched.bot?.token).toBe('xoxb-secret-bot-token');
      expect(fetched.bot?.userId).toBe('B123');
      expect(fetched.bot?.scopes).toEqual(['chat:write', 'commands']);
    });

    it('should fetch and decrypt user token when present', async () => {
      const installation = createTestInstallation({
        user: {
          id: 'U123',
          token: 'xoxp-secret-user-token',
          scopes: ['users:read'],
        },
      });
      await installationStore.storeInstallation(installation);

      const query: InstallationQuery<false> = {
        teamId: 'T123TEST',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      const fetched = await installationStore.fetchInstallation(query);

      expect(fetched.user?.token).toBe('xoxp-secret-user-token');
      expect(fetched.user?.id).toBe('U123');
      expect(fetched.user?.scopes).toEqual(['users:read']);
    });

    it('should return workspace team/enterprise info', async () => {
      const installation = createTestInstallation({
        team: { id: 'TWORKSPACE', name: 'My Workspace' },
      });
      await installationStore.storeInstallation(installation);

      const query: InstallationQuery<false> = {
        teamId: 'TWORKSPACE',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      const fetched = await installationStore.fetchInstallation(query);

      expect(fetched.team?.id).toBe('TWORKSPACE');
      expect(fetched.team?.name).toBe('My Workspace');
    });

    it('should return enterprise info when applicable', async () => {
      const installation = createTestInstallation({
        team: { id: 'TENTTEAM', name: 'Enterprise Team' },
        enterprise: { id: 'E123ENT', name: 'Enterprise' },
      });
      await installationStore.storeInstallation(installation);

      const query: InstallationQuery<false> = {
        teamId: 'TENTTEAM',
        enterpriseId: 'E123ENT',
        isEnterpriseInstall: false,
      };

      const fetched = await installationStore.fetchInstallation(query);

      expect(fetched.enterprise?.id).toBe('E123ENT');
    });

    it('should throw when installation not found', async () => {
      const query: InstallationQuery<false> = {
        teamId: 'TNONEXISTENT',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      await expect(installationStore.fetchInstallation(query)).rejects.toThrow(
        'Installation not found'
      );
    });

    it('should throw when neither teamId nor enterpriseId in query', async () => {
      const query: InstallationQuery<false> = {
        isEnterpriseInstall: false,
      } as InstallationQuery<false>;

      await expect(installationStore.fetchInstallation(query)).rejects.toThrow(
        'InstallQuery must have either teamId or enterpriseId'
      );
    });

    it('should handle enterprise query correctly', async () => {
      const installation = createTestInstallation({
        team: { id: 'TENTERPRISE', name: 'Enterprise Team' },
        enterprise: { id: 'EENTERPRISE', name: 'Enterprise' },
      });
      await installationStore.storeInstallation(installation);

      const query: InstallationQuery<true> = {
        teamId: 'TENTERPRISE',
        enterpriseId: 'EENTERPRISE' as string | undefined,
        isEnterpriseInstall: true,
      };

      const fetched = await installationStore.fetchInstallation(query);

      expect(fetched.team?.id).toBe('TENTERPRISE');
      expect(fetched.enterprise?.id).toBe('EENTERPRISE');
    });

    it('should return user without token when not stored', async () => {
      const installation = createTestInstallation({
        user: { id: 'U123', token: undefined, scopes: ['users:read'] }, // No token
      });
      await installationStore.storeInstallation(installation);

      const query: InstallationQuery<false> = {
        teamId: 'T123TEST',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      const fetched = await installationStore.fetchInstallation(query);

      expect(fetched.user?.id).toBe('U123');
      expect(fetched.user?.token).toBeUndefined();
    });

    it('should return empty string for bot token when stored empty', async () => {
      // First store installation without bot token to get empty string in DB
      const installation = createTestInstallation({
        bot: undefined,
      });
      await installationStore.storeInstallation(installation);

      const query: InstallationQuery<false> = {
        teamId: 'T123TEST',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      const fetched = await installationStore.fetchInstallation(query);

      // Bot token should be empty string when stored as empty
      expect(fetched.bot?.token).toBe('');
    });
  });

  describe('deleteInstallation', () => {
    it('should delete installation for workspace', async () => {
      const installation = createTestInstallation();
      await installationStore.storeInstallation(installation);

      // Verify installation exists
      const query: InstallationQuery<false> = {
        teamId: 'T123TEST',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };
      const fetched = await installationStore.fetchInstallation(query);
      expect(fetched.team?.id).toBe('T123TEST');

      // Delete installation
      await installationStore.deleteInstallation(query);

      // Verify installation is gone
      await expect(installationStore.fetchInstallation(query)).rejects.toThrow(
        'Installation not found'
      );
    });

    it('should handle delete of non-existent installation (no-op)', async () => {
      const query: InstallationQuery<false> = {
        teamId: 'TNONEXISTENT',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      // Should not throw
      await expect(installationStore.deleteInstallation(query)).resolves.toBeUndefined();
    });

    it('should only delete installation, not workspace', async () => {
      const installation = createTestInstallation();
      await installationStore.storeInstallation(installation);

      const query: InstallationQuery<false> = {
        teamId: 'T123TEST',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      };

      await installationStore.deleteInstallation(query);

      // Workspace should still exist
      const workspace = await getWorkspace('T123TEST');
      expect(workspace).toBeDefined();
      expect(workspace.teamId).toBe('T123TEST');

      // But installation should be gone
      const installations = await testDb.select().from(schema.installations);
      expect(installations).toHaveLength(0);
    });

    it('should throw when neither teamId nor enterpriseId in query', async () => {
      const query: InstallationQuery<false> = {
        isEnterpriseInstall: false,
      } as InstallationQuery<false>;

      await expect(installationStore.deleteInstallation(query)).rejects.toThrow(
        'InstallQuery must have either teamId or enterpriseId'
      );
    });

    it('should delete enterprise installation correctly', async () => {
      const installation = createTestInstallation({
        team: { id: 'TENTDEL', name: 'Enterprise Team' },
        enterprise: { id: 'EENTDEL', name: 'Enterprise' },
      });
      await installationStore.storeInstallation(installation);

      const query: InstallationQuery<true> = {
        teamId: 'TENTDEL',
        enterpriseId: 'EENTDEL' as string | undefined,
        isEnterpriseInstall: true,
      };

      await installationStore.deleteInstallation(query);

      await expect(installationStore.fetchInstallation(query)).rejects.toThrow(
        'Installation not found'
      );
    });
  });

  describe('Encryption verification', () => {
    it('should verify encrypted token != plaintext', async () => {
      const plaintext = 'xoxb-my-plaintext-token';
      const encrypted = encrypt(plaintext, TEST_ENCRYPTION_KEY);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':'); // Format: iv:authTag:ciphertext
    });

    it('should verify decrypt(encrypt(x)) === x', async () => {
      const plaintext = 'xoxb-test-roundtrip-token';
      const encrypted = encrypt(plaintext, TEST_ENCRYPTION_KEY);
      const decrypted = decrypt(encrypted, TEST_ENCRYPTION_KEY);

      expect(decrypted).toBe(plaintext);
    });

    it('should use different IV for each encryption (non-deterministic)', async () => {
      const plaintext = 'xoxb-same-token';
      const encrypted1 = encrypt(plaintext, TEST_ENCRYPTION_KEY);
      const encrypted2 = encrypt(plaintext, TEST_ENCRYPTION_KEY);

      // Same plaintext should produce different ciphertext (different IV)
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decrypt(encrypted1, TEST_ENCRYPTION_KEY)).toBe(plaintext);
      expect(decrypt(encrypted2, TEST_ENCRYPTION_KEY)).toBe(plaintext);
    });

    it('should store tokens encrypted in database during installation', async () => {
      const installation = createTestInstallation({
        bot: {
          token: 'xoxb-verify-encryption',
          userId: 'B123',
          scopes: ['chat:write'],
          id: 'B123',
        },
      });

      await installationStore.storeInstallation(installation);

      const workspace = await getWorkspace('T123TEST');
      const rawInstallation = await getRawInstallation(workspace.id);

      // Raw database value should NOT contain the plaintext token
      expect(rawInstallation.botToken).not.toContain('xoxb-verify-encryption');

      // But decryption should reveal it
      expect(decrypt(rawInstallation.botToken, TEST_ENCRYPTION_KEY)).toBe(
        'xoxb-verify-encryption'
      );
    });
  });
});
