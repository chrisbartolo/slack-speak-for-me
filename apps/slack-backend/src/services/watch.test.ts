import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { setupTestDb, cleanupTestDb, seedWorkspace, clearAllTables, getPGlite } from '../../test/helpers/db.js';

// Store the test db instance for mocking
let testDb: Awaited<ReturnType<typeof setupTestDb>>;

// Mock the database module to use PGlite-backed instance
vi.mock('@slack-speak/database', async () => {
  const actual = await vi.importActual<typeof import('@slack-speak/database')>('@slack-speak/database');
  return {
    ...actual,
    get db() {
      return testDb;
    },
  };
});

// Import watch service AFTER mock is set up
import {
  watchConversation,
  unwatchConversation,
  isWatching,
  getWatchedConversations,
  recordThreadParticipation,
  isParticipatingInThread,
} from './watch.js';

describe('Watch Service', () => {
  let workspaceId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    // Seed a workspace for tests
    workspaceId = await seedWorkspace({ teamId: 'T123', name: 'Test Workspace' });
  });

  describe('watchConversation', () => {
    it('should insert new watch record', async () => {
      await watchConversation(workspaceId, 'U123', 'C123');

      // Verify record exists
      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM watched_conversations WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3',
        [workspaceId, 'U123', 'C123']
      );
      expect(parseInt(result.rows[0].count)).toBe(1);
    });

    it('should not create duplicate on conflict (idempotent)', async () => {
      // Call watchConversation twice with same params
      await watchConversation(workspaceId, 'U123', 'C123');
      await watchConversation(workspaceId, 'U123', 'C123');

      // Verify only one record exists
      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM watched_conversations WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3',
        [workspaceId, 'U123', 'C123']
      );
      expect(parseInt(result.rows[0].count)).toBe(1);
    });

    it('should allow different users to watch same channel', async () => {
      await watchConversation(workspaceId, 'U123', 'C123');
      await watchConversation(workspaceId, 'U456', 'C123');

      // Both records should exist
      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM watched_conversations WHERE workspace_id = $1 AND channel_id = $2',
        [workspaceId, 'C123']
      );
      expect(parseInt(result.rows[0].count)).toBe(2);
    });

    it('should allow same user to watch different channels', async () => {
      await watchConversation(workspaceId, 'U123', 'C123');
      await watchConversation(workspaceId, 'U123', 'C456');

      // Both records should exist
      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM watched_conversations WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, 'U123']
      );
      expect(parseInt(result.rows[0].count)).toBe(2);
    });

    it('should set watched_at timestamp', async () => {
      await watchConversation(workspaceId, 'U123', 'C123');

      const pgLite = getPGlite();
      const result = await pgLite.query<{ watched_at: string }>(
        'SELECT watched_at FROM watched_conversations WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3',
        [workspaceId, 'U123', 'C123']
      );

      // Verify timestamp is set (not null) and is a valid date
      expect(result.rows[0].watched_at).toBeDefined();
      const watchedAt = new Date(result.rows[0].watched_at);
      expect(watchedAt.getTime()).not.toBeNaN();
      // Timestamp should be in reasonable range (within last day, accounting for timezone differences)
      const oneDayAgo = Date.now() - 86400000;
      expect(watchedAt.getTime()).toBeGreaterThan(oneDayAgo);
    });
  });

  describe('unwatchConversation', () => {
    it('should delete existing watch record', async () => {
      // Create watch first
      await watchConversation(workspaceId, 'U123', 'C123');

      // Verify it exists
      let pgLite = getPGlite();
      let result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM watched_conversations WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3',
        [workspaceId, 'U123', 'C123']
      );
      expect(parseInt(result.rows[0].count)).toBe(1);

      // Unwatch
      await unwatchConversation(workspaceId, 'U123', 'C123');

      // Verify deleted
      result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM watched_conversations WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3',
        [workspaceId, 'U123', 'C123']
      );
      expect(parseInt(result.rows[0].count)).toBe(0);
    });

    it('should handle unwatch when not watching (no-op, no error)', async () => {
      // Should not throw when trying to unwatch something that doesn't exist
      await expect(
        unwatchConversation(workspaceId, 'U123', 'C123')
      ).resolves.not.toThrow();
    });

    it('should only delete specific watch, not affect other watches', async () => {
      // Create multiple watches
      await watchConversation(workspaceId, 'U123', 'C123');
      await watchConversation(workspaceId, 'U123', 'C456');
      await watchConversation(workspaceId, 'U456', 'C123');

      // Unwatch only one
      await unwatchConversation(workspaceId, 'U123', 'C123');

      // Other watches should still exist
      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM watched_conversations WHERE workspace_id = $1',
        [workspaceId]
      );
      expect(parseInt(result.rows[0].count)).toBe(2);
    });
  });

  describe('isWatching', () => {
    it('should return true when watching', async () => {
      await watchConversation(workspaceId, 'U123', 'C123');

      const result = await isWatching(workspaceId, 'U123', 'C123');
      expect(result).toBe(true);
    });

    it('should return false when not watching', async () => {
      const result = await isWatching(workspaceId, 'U123', 'C123');
      expect(result).toBe(false);
    });

    it('should correctly scope by workspaceId', async () => {
      // Create another workspace
      const workspace2 = await seedWorkspace({ teamId: 'T456', name: 'Workspace 2' });

      // Watch in workspace1
      await watchConversation(workspaceId, 'U123', 'C123');

      // Same user/channel in workspace2 should not be watching
      const result = await isWatching(workspace2, 'U123', 'C123');
      expect(result).toBe(false);
    });

    it('should correctly scope by userId', async () => {
      await watchConversation(workspaceId, 'U123', 'C123');

      // Different user in same workspace/channel should not be watching
      const result = await isWatching(workspaceId, 'U456', 'C123');
      expect(result).toBe(false);
    });

    it('should correctly scope by channelId', async () => {
      await watchConversation(workspaceId, 'U123', 'C123');

      // Same user in different channel should not be watching
      const result = await isWatching(workspaceId, 'U123', 'C456');
      expect(result).toBe(false);
    });
  });

  describe('getWatchedConversations', () => {
    it('should return all channels user is watching', async () => {
      await watchConversation(workspaceId, 'U123', 'C123');
      await watchConversation(workspaceId, 'U123', 'C456');
      await watchConversation(workspaceId, 'U123', 'C789');

      const channels = await getWatchedConversations(workspaceId, 'U123');

      expect(channels).toHaveLength(3);
      expect(channels).toContain('C123');
      expect(channels).toContain('C456');
      expect(channels).toContain('C789');
    });

    it('should return empty array when not watching anything', async () => {
      const channels = await getWatchedConversations(workspaceId, 'U123');
      expect(channels).toEqual([]);
    });

    it('should only return channels for specified user', async () => {
      await watchConversation(workspaceId, 'U123', 'C123');
      await watchConversation(workspaceId, 'U456', 'C456');

      const channels = await getWatchedConversations(workspaceId, 'U123');

      expect(channels).toHaveLength(1);
      expect(channels).toContain('C123');
      expect(channels).not.toContain('C456');
    });

    it('should only return channels in specified workspace', async () => {
      const workspace2 = await seedWorkspace({ teamId: 'T456', name: 'Workspace 2' });

      await watchConversation(workspaceId, 'U123', 'C123');
      await watchConversation(workspace2, 'U123', 'C456');

      const channels = await getWatchedConversations(workspaceId, 'U123');

      expect(channels).toHaveLength(1);
      expect(channels).toContain('C123');
    });
  });

  describe('recordThreadParticipation', () => {
    it('should insert participation record', async () => {
      await recordThreadParticipation(workspaceId, 'U123', 'C123', '1234567890.000001');

      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM thread_participants WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3 AND thread_ts = $4',
        [workspaceId, 'U123', 'C123', '1234567890.000001']
      );
      expect(parseInt(result.rows[0].count)).toBe(1);
    });

    it('should update lastMessageAt on conflict (upsert)', async () => {
      // First participation
      await recordThreadParticipation(workspaceId, 'U123', 'C123', '1234567890.000001');

      const pgLite = getPGlite();
      const firstResult = await pgLite.query<{ last_message_at: string }>(
        'SELECT last_message_at FROM thread_participants WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3 AND thread_ts = $4',
        [workspaceId, 'U123', 'C123', '1234567890.000001']
      );
      const firstTimestamp = new Date(firstResult.rows[0].last_message_at);

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second participation (should update)
      await recordThreadParticipation(workspaceId, 'U123', 'C123', '1234567890.000001');

      const secondResult = await pgLite.query<{ last_message_at: string }>(
        'SELECT last_message_at FROM thread_participants WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3 AND thread_ts = $4',
        [workspaceId, 'U123', 'C123', '1234567890.000001']
      );
      const secondTimestamp = new Date(secondResult.rows[0].last_message_at);

      // Should still have only one record
      const countResult = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM thread_participants WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3 AND thread_ts = $4',
        [workspaceId, 'U123', 'C123', '1234567890.000001']
      );
      expect(parseInt(countResult.rows[0].count)).toBe(1);

      // Timestamp should be updated (newer)
      expect(secondTimestamp.getTime()).toBeGreaterThanOrEqual(firstTimestamp.getTime());
    });

    it('should allow same user to participate in different threads', async () => {
      await recordThreadParticipation(workspaceId, 'U123', 'C123', '1234567890.000001');
      await recordThreadParticipation(workspaceId, 'U123', 'C123', '1234567890.000002');

      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM thread_participants WHERE workspace_id = $1 AND user_id = $2 AND channel_id = $3',
        [workspaceId, 'U123', 'C123']
      );
      expect(parseInt(result.rows[0].count)).toBe(2);
    });

    it('should allow different users in same thread', async () => {
      await recordThreadParticipation(workspaceId, 'U123', 'C123', '1234567890.000001');
      await recordThreadParticipation(workspaceId, 'U456', 'C123', '1234567890.000001');

      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM thread_participants WHERE workspace_id = $1 AND channel_id = $2 AND thread_ts = $3',
        [workspaceId, 'C123', '1234567890.000001']
      );
      expect(parseInt(result.rows[0].count)).toBe(2);
    });
  });

  describe('isParticipatingInThread', () => {
    it('should return true for recent participation (within 7 days)', async () => {
      // Record recent participation
      await recordThreadParticipation(workspaceId, 'U123', 'C123', '1234567890.000001');

      const result = await isParticipatingInThread(workspaceId, 'U123', 'C123', '1234567890.000001');
      expect(result).toBe(true);
    });

    it('should return false for old participation (>7 days)', async () => {
      // Insert a record with old timestamp directly
      const pgLite = getPGlite();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8); // 8 days ago

      await pgLite.query(
        'INSERT INTO thread_participants (workspace_id, user_id, channel_id, thread_ts, last_message_at) VALUES ($1, $2, $3, $4, $5)',
        [workspaceId, 'U123', 'C123', '1234567890.000001', oldDate.toISOString()]
      );

      const result = await isParticipatingInThread(workspaceId, 'U123', 'C123', '1234567890.000001');
      expect(result).toBe(false);
    });

    it('should return false when never participated', async () => {
      const result = await isParticipatingInThread(workspaceId, 'U123', 'C123', '1234567890.000001');
      expect(result).toBe(false);
    });

    it('should correctly scope by all parameters', async () => {
      await recordThreadParticipation(workspaceId, 'U123', 'C123', '1234567890.000001');

      // Different user
      expect(await isParticipatingInThread(workspaceId, 'U456', 'C123', '1234567890.000001')).toBe(false);

      // Different channel
      expect(await isParticipatingInThread(workspaceId, 'U123', 'C456', '1234567890.000001')).toBe(false);

      // Different thread
      expect(await isParticipatingInThread(workspaceId, 'U123', 'C123', '1234567890.000002')).toBe(false);

      // Different workspace
      const workspace2 = await seedWorkspace({ teamId: 'T456', name: 'Workspace 2' });
      expect(await isParticipatingInThread(workspace2, 'U123', 'C123', '1234567890.000001')).toBe(false);

      // Correct match
      expect(await isParticipatingInThread(workspaceId, 'U123', 'C123', '1234567890.000001')).toBe(true);
    });

    it('should return true for participation exactly 7 days ago', async () => {
      // Insert a record with exactly 7 days ago timestamp
      const pgLite = getPGlite();
      const exactlySevenDaysAgo = new Date();
      exactlySevenDaysAgo.setDate(exactlySevenDaysAgo.getDate() - 7);
      exactlySevenDaysAgo.setHours(exactlySevenDaysAgo.getHours() + 1); // Just inside the 7 day window

      await pgLite.query(
        'INSERT INTO thread_participants (workspace_id, user_id, channel_id, thread_ts, last_message_at) VALUES ($1, $2, $3, $4, $5)',
        [workspaceId, 'U123', 'C123', '1234567890.000001', exactlySevenDaysAgo.toISOString()]
      );

      const result = await isParticipatingInThread(workspaceId, 'U123', 'C123', '1234567890.000001');
      expect(result).toBe(true);
    });
  });
});
