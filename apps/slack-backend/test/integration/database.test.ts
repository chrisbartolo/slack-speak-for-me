/**
 * Database Integration Tests
 *
 * Tests database operations with real PostgreSQL via PGlite.
 * Verifies CRUD operations, constraints, and complex queries.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { eq, and, gt, sql } from 'drizzle-orm';
import { setupTestDb, cleanupTestDb, getTestDb, getPGlite, clearAllTables } from '../helpers/db';
import * as schema from '@slack-speak/database';

describe('Database Integration', () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
  });

  describe('Workspaces', () => {
    it('should insert and query workspace', async () => {
      await db.insert(schema.workspaces).values({
        teamId: 'T123',
        name: 'Test Workspace',
      });

      const results = await db.select()
        .from(schema.workspaces)
        .where(eq(schema.workspaces.teamId, 'T123'));

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test Workspace');
      expect(results[0].teamId).toBe('T123');
      expect(results[0].id).toBeDefined();
    });

    it('should enforce workspace.team_id uniqueness', async () => {
      await db.insert(schema.workspaces).values({
        teamId: 'T123',
        name: 'Test Workspace',
      });

      // Attempt duplicate should fail
      await expect(
        db.insert(schema.workspaces).values({
          teamId: 'T123',
          name: 'Duplicate Workspace',
        })
      ).rejects.toThrow();
    });

    it('should allow enterprise_id to be null', async () => {
      await db.insert(schema.workspaces).values({
        teamId: 'T123',
        name: 'Test Workspace',
        enterpriseId: null,
      });

      const results = await db.select()
        .from(schema.workspaces)
        .where(eq(schema.workspaces.teamId, 'T123'));

      expect(results[0].enterpriseId).toBeNull();
    });

    it('should set timestamps automatically', async () => {
      await db.insert(schema.workspaces).values({
        teamId: 'T123',
        name: 'Test Workspace',
      });

      const results = await db.select()
        .from(schema.workspaces)
        .where(eq(schema.workspaces.teamId, 'T123'));

      expect(results[0].createdAt).toBeDefined();
      expect(results[0].updatedAt).toBeDefined();
    });
  });

  describe('Installations', () => {
    it('should create workspace and installation together', async () => {
      // Insert workspace first
      const [workspace] = await db.insert(schema.workspaces)
        .values({
          teamId: 'T123',
          name: 'Test Workspace',
        })
        .returning();

      // Insert installation referencing workspace
      const [installation] = await db.insert(schema.installations)
        .values({
          workspaceId: workspace.id,
          botToken: 'xoxb-test-token',
          botUserId: 'B123',
          botScopes: 'channels:history,chat:write',
        })
        .returning();

      // Verify both records exist
      expect(workspace.id).toBeDefined();
      expect(installation.workspaceId).toBe(workspace.id);
      expect(installation.botToken).toBe('xoxb-test-token');
    });

    it('should enforce foreign key constraint on workspace_id', async () => {
      // Try to insert installation with non-existent workspace_id
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        db.insert(schema.installations).values({
          workspaceId: fakeId,
          botToken: 'xoxb-test-token',
        })
      ).rejects.toThrow();
    });

    it('should join installations with workspaces', async () => {
      // Create workspace and installation
      const [workspace] = await db.insert(schema.workspaces)
        .values({
          teamId: 'T123',
          name: 'Test Workspace',
        })
        .returning();

      await db.insert(schema.installations).values({
        workspaceId: workspace.id,
        botToken: 'xoxb-test-token',
        botUserId: 'B123',
      });

      // Query with join
      const results = await db
        .select({
          installation: schema.installations,
          workspace: schema.workspaces,
        })
        .from(schema.installations)
        .innerJoin(
          schema.workspaces,
          eq(schema.installations.workspaceId, schema.workspaces.id)
        )
        .where(eq(schema.workspaces.teamId, 'T123'));

      expect(results).toHaveLength(1);
      expect(results[0].workspace.teamId).toBe('T123');
      expect(results[0].installation.botToken).toBe('xoxb-test-token');
    });
  });

  describe('Watched Conversations', () => {
    let workspaceId: string;

    beforeEach(async () => {
      // Create workspace for watched conversations tests
      const [workspace] = await db.insert(schema.workspaces)
        .values({
          teamId: 'T123',
          name: 'Test Workspace',
        })
        .returning();
      workspaceId = workspace.id;
    });

    it('should insert watched conversation', async () => {
      await db.insert(schema.watchedConversations).values({
        workspaceId,
        userId: 'U123',
        channelId: 'C123',
      });

      const results = await db.select()
        .from(schema.watchedConversations)
        .where(
          and(
            eq(schema.watchedConversations.workspaceId, workspaceId),
            eq(schema.watchedConversations.userId, 'U123')
          )
        );

      expect(results).toHaveLength(1);
      expect(results[0].channelId).toBe('C123');
    });

    it('should enforce unique constraint on (workspace_id, user_id, channel_id)', async () => {
      await db.insert(schema.watchedConversations).values({
        workspaceId,
        userId: 'U123',
        channelId: 'C123',
      });

      // Attempt duplicate should fail
      await expect(
        db.insert(schema.watchedConversations).values({
          workspaceId,
          userId: 'U123',
          channelId: 'C123',
        })
      ).rejects.toThrow();
    });

    it('should allow multiple watches per user (different channels)', async () => {
      await db.insert(schema.watchedConversations).values([
        { workspaceId, userId: 'U123', channelId: 'C123' },
        { workspaceId, userId: 'U123', channelId: 'C456' },
      ]);

      const results = await db.select()
        .from(schema.watchedConversations)
        .where(
          and(
            eq(schema.watchedConversations.workspaceId, workspaceId),
            eq(schema.watchedConversations.userId, 'U123')
          )
        );

      expect(results).toHaveLength(2);
      expect(results.map(r => r.channelId).sort()).toEqual(['C123', 'C456']);
    });

    it('should allow multiple users to watch same channel', async () => {
      await db.insert(schema.watchedConversations).values([
        { workspaceId, userId: 'U123', channelId: 'C123' },
        { workspaceId, userId: 'U456', channelId: 'C123' },
      ]);

      const results = await db.select()
        .from(schema.watchedConversations)
        .where(
          and(
            eq(schema.watchedConversations.workspaceId, workspaceId),
            eq(schema.watchedConversations.channelId, 'C123')
          )
        );

      expect(results).toHaveLength(2);
      expect(results.map(r => r.userId).sort()).toEqual(['U123', 'U456']);
    });

    it('should delete watch correctly', async () => {
      const [watch] = await db.insert(schema.watchedConversations)
        .values({
          workspaceId,
          userId: 'U123',
          channelId: 'C123',
        })
        .returning();

      // Delete the watch
      await db.delete(schema.watchedConversations)
        .where(eq(schema.watchedConversations.id, watch.id));

      // Verify record is gone
      const results = await db.select()
        .from(schema.watchedConversations)
        .where(eq(schema.watchedConversations.id, watch.id));

      expect(results).toHaveLength(0);
    });

    it('should set watchedAt timestamp automatically', async () => {
      await db.insert(schema.watchedConversations).values({
        workspaceId,
        userId: 'U123',
        channelId: 'C123',
      });

      const results = await db.select()
        .from(schema.watchedConversations)
        .where(
          and(
            eq(schema.watchedConversations.workspaceId, workspaceId),
            eq(schema.watchedConversations.userId, 'U123')
          )
        );

      expect(results[0].watchedAt).toBeDefined();
    });
  });

  describe('Thread Participants', () => {
    let workspaceId: string;

    beforeEach(async () => {
      // Create workspace for thread participants tests
      const [workspace] = await db.insert(schema.workspaces)
        .values({
          teamId: 'T123',
          name: 'Test Workspace',
        })
        .returning();
      workspaceId = workspace.id;
    });

    it('should insert thread participation', async () => {
      await db.insert(schema.threadParticipants).values({
        workspaceId,
        userId: 'U123',
        channelId: 'C123',
        threadTs: '1234567890.000001',
      });

      const results = await db.select()
        .from(schema.threadParticipants)
        .where(
          and(
            eq(schema.threadParticipants.workspaceId, workspaceId),
            eq(schema.threadParticipants.threadTs, '1234567890.000001')
          )
        );

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('U123');
    });

    it('should update lastMessageAt on conflict using raw SQL upsert', async () => {
      const pgLite = getPGlite();

      // Insert initial participation
      await pgLite.exec(`
        INSERT INTO thread_participants (workspace_id, user_id, channel_id, thread_ts)
        VALUES ('${workspaceId}', 'U123', 'C123', '1234567890.000001')
      `);

      // Get initial timestamp
      const initial = await db.select()
        .from(schema.threadParticipants)
        .where(
          and(
            eq(schema.threadParticipants.workspaceId, workspaceId),
            eq(schema.threadParticipants.userId, 'U123'),
            eq(schema.threadParticipants.threadTs, '1234567890.000001')
          )
        );

      // Wait a moment to ensure timestamp differs
      await new Promise(resolve => setTimeout(resolve, 10));

      // Upsert with ON CONFLICT
      await pgLite.exec(`
        INSERT INTO thread_participants (workspace_id, user_id, channel_id, thread_ts, last_message_at)
        VALUES ('${workspaceId}', 'U123', 'C123', '1234567890.000001', NOW())
        ON CONFLICT (workspace_id, user_id, channel_id, thread_ts)
        DO UPDATE SET last_message_at = EXCLUDED.last_message_at
      `);

      // Get updated record
      const updated = await db.select()
        .from(schema.threadParticipants)
        .where(
          and(
            eq(schema.threadParticipants.workspaceId, workspaceId),
            eq(schema.threadParticipants.userId, 'U123'),
            eq(schema.threadParticipants.threadTs, '1234567890.000001')
          )
        );

      // Should still be one record (upserted, not duplicated)
      expect(updated).toHaveLength(1);
      // Timestamp should be updated (or at least not earlier)
      expect(updated[0].lastMessageAt!.getTime()).toBeGreaterThanOrEqual(
        initial[0].lastMessageAt!.getTime()
      );
    });

    it('should query by thread correctly (multiple participants)', async () => {
      await db.insert(schema.threadParticipants).values([
        { workspaceId, userId: 'U123', channelId: 'C123', threadTs: '1234567890.000001' },
        { workspaceId, userId: 'U456', channelId: 'C123', threadTs: '1234567890.000001' },
        { workspaceId, userId: 'U789', channelId: 'C123', threadTs: '1234567890.000001' },
      ]);

      const results = await db.select()
        .from(schema.threadParticipants)
        .where(
          and(
            eq(schema.threadParticipants.workspaceId, workspaceId),
            eq(schema.threadParticipants.channelId, 'C123'),
            eq(schema.threadParticipants.threadTs, '1234567890.000001')
          )
        );

      expect(results).toHaveLength(3);
      expect(results.map(r => r.userId).sort()).toEqual(['U123', 'U456', 'U789']);
    });

    it('should filter by time window (7 days)', async () => {
      const pgLite = getPGlite();

      // Insert recent participation (should be included)
      await db.insert(schema.threadParticipants).values({
        workspaceId,
        userId: 'U123',
        channelId: 'C123',
        threadTs: '1234567890.000001',
      });

      // Insert old participation (8 days ago - should be excluded)
      await pgLite.exec(`
        INSERT INTO thread_participants (workspace_id, user_id, channel_id, thread_ts, last_message_at)
        VALUES ('${workspaceId}', 'U456', 'C123', '1234567890.000002', NOW() - INTERVAL '8 days')
      `);

      // Query with 7-day filter
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const results = await db.select()
        .from(schema.threadParticipants)
        .where(
          and(
            eq(schema.threadParticipants.workspaceId, workspaceId),
            eq(schema.threadParticipants.channelId, 'C123'),
            gt(schema.threadParticipants.lastMessageAt, sevenDaysAgo)
          )
        );

      // Only recent participant should be returned
      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('U123');
    });

    it('should enforce unique participation constraint', async () => {
      await db.insert(schema.threadParticipants).values({
        workspaceId,
        userId: 'U123',
        channelId: 'C123',
        threadTs: '1234567890.000001',
      });

      // Duplicate should fail
      await expect(
        db.insert(schema.threadParticipants).values({
          workspaceId,
          userId: 'U123',
          channelId: 'C123',
          threadTs: '1234567890.000001',
        })
      ).rejects.toThrow();
    });

    it('should allow same user in different threads', async () => {
      await db.insert(schema.threadParticipants).values([
        { workspaceId, userId: 'U123', channelId: 'C123', threadTs: '1234567890.000001' },
        { workspaceId, userId: 'U123', channelId: 'C123', threadTs: '1234567890.000002' },
      ]);

      const results = await db.select()
        .from(schema.threadParticipants)
        .where(
          and(
            eq(schema.threadParticipants.workspaceId, workspaceId),
            eq(schema.threadParticipants.userId, 'U123')
          )
        );

      expect(results).toHaveLength(2);
    });
  });

  describe('Users Table', () => {
    let workspaceId: string;

    beforeEach(async () => {
      const [workspace] = await db.insert(schema.workspaces)
        .values({
          teamId: 'T123',
          name: 'Test Workspace',
        })
        .returning();
      workspaceId = workspace.id;
    });

    it('should insert and query user', async () => {
      await db.insert(schema.users).values({
        workspaceId,
        slackUserId: 'U123',
        email: 'test@example.com',
      });

      const results = await db.select()
        .from(schema.users)
        .where(eq(schema.users.slackUserId, 'U123'));

      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('test@example.com');
    });

    it('should enforce foreign key on workspace_id', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await expect(
        db.insert(schema.users).values({
          workspaceId: fakeId,
          slackUserId: 'U123',
        })
      ).rejects.toThrow();
    });
  });
});
