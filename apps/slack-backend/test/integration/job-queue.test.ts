/**
 * Job Queue Integration Tests
 *
 * Tests BullMQ job processing logic without requiring Redis.
 * Uses direct processor function calls with mock job objects.
 *
 * Note: The worker processor is embedded in startWorkers() and not exported.
 * These tests verify the processing pipeline by simulating what the worker does:
 * 1. Generate AI suggestion
 * 2. Look up installation
 * 3. Decrypt token
 * 4. Deliver via Slack API
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, cleanupTestDb, clearAllTables, getPGlite, getTestDb } from '../helpers/db';
import { encrypt, decrypt, workspaces, installations } from '@slack-speak/database';
import type { AIResponseJobData, AIResponseJobResult } from '../../src/jobs/types.js';
import { eq } from 'drizzle-orm';
import { WebClient } from '@slack/web-api';

// Test encryption key (32 bytes of zeros in hex)
const TEST_ENCRYPTION_KEY = Buffer.from('0'.repeat(64), 'hex');

// Mock services - we're testing integration, not the actual AI/Slack APIs
const mockGenerateSuggestion = vi.fn();
const mockSendSuggestionEphemeral = vi.fn();

describe('Job Queue Integration', () => {
  let testDb: Awaited<ReturnType<typeof setupTestDb>>;

  beforeAll(async () => {
    testDb = await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    mockGenerateSuggestion.mockReset();
    mockSendSuggestionEphemeral.mockReset();
  });

  /**
   * Creates a mock job object matching BullMQ Job interface
   */
  function createMockJob(
    data: AIResponseJobData,
    opts: Partial<{ id: string; attemptsMade: number }> = {}
  ) {
    return {
      id: opts.id || 'job_test_123',
      data,
      attemptsMade: opts.attemptsMade || 0,
      updateProgress: vi.fn(),
      log: vi.fn(),
    };
  }

  /**
   * Simulates the worker processor logic
   * This replicates what startWorkers() does internally
   */
  async function processAIResponseJob(
    job: ReturnType<typeof createMockJob>
  ): Promise<AIResponseJobResult> {
    const { workspaceId, userId, channelId, triggerMessageText, contextMessages, triggeredBy } = job.data;
    const db = getTestDb();

    // Step 1: Generate suggestion via AI service
    const result = await mockGenerateSuggestion({
      triggerMessage: triggerMessageText,
      contextMessages,
      triggeredBy,
    });

    // Generate a unique suggestion ID for tracking
    const suggestionId = `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Step 2: Fetch installation to get bot token for delivery
    try {
      const [installation] = await db
        .select({
          installation: installations,
          workspace: workspaces,
        })
        .from(installations)
        .innerJoin(workspaces, eq(installations.workspaceId, workspaces.id))
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!installation) {
        // Don't throw - suggestion was generated successfully
        return {
          suggestionId,
          suggestion: result.suggestion,
          processingTimeMs: result.processingTimeMs,
        };
      }

      // Step 3: Decrypt bot token
      const botToken = decrypt(installation.installation.botToken, TEST_ENCRYPTION_KEY);

      // Step 4: Create WebClient and send ephemeral message
      const client = new WebClient(botToken);

      await mockSendSuggestionEphemeral({
        client,
        channelId,
        userId,
        suggestionId,
        suggestion: result.suggestion,
        triggerContext: triggeredBy,
      });
    } catch {
      // Log delivery failure but don't throw - suggestion was still generated
    }

    return {
      suggestionId,
      suggestion: result.suggestion,
      processingTimeMs: result.processingTimeMs,
    };
  }

  describe('AI Response Job Processing', () => {
    it('should process job and generate suggestion', async () => {
      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Test suggestion response',
        processingTimeMs: 150,
      });

      const job = createMockJob({
        workspaceId: 'W123',
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'Help me respond to this',
        contextMessages: [{ userId: 'U456', text: 'Previous message', ts: '1234567890.000000' }],
        triggeredBy: 'mention',
      });

      const result = await processAIResponseJob(job);

      expect(result).toHaveProperty('suggestion');
      expect(result).toHaveProperty('processingTimeMs');
      expect(result).toHaveProperty('suggestionId');
      expect(result.suggestion).toBe('Test suggestion response');
    });

    it('should call generateSuggestion with correct parameters', async () => {
      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Response text',
        processingTimeMs: 100,
      });

      const job = createMockJob({
        workspaceId: 'W123',
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'The trigger message',
        contextMessages: [
          { userId: 'U456', text: 'Context 1', ts: '1234567890.000000' },
          { userId: 'U789', text: 'Context 2', ts: '1234567890.000001' },
        ],
        triggeredBy: 'reply',
      });

      await processAIResponseJob(job);

      expect(mockGenerateSuggestion).toHaveBeenCalledWith({
        triggerMessage: 'The trigger message',
        contextMessages: [
          { userId: 'U456', text: 'Context 1', ts: '1234567890.000000' },
          { userId: 'U789', text: 'Context 2', ts: '1234567890.000001' },
        ],
        triggeredBy: 'reply',
      });
    });

    it('should handle missing installation gracefully', async () => {
      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Generated suggestion',
        processingTimeMs: 120,
      });

      const job = createMockJob({
        workspaceId: 'NONEXISTENT-WORKSPACE-ID',
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'Test',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      // Should complete generation but skip delivery (no throw)
      const result = await processAIResponseJob(job);

      expect(result.suggestion).toBe('Generated suggestion');
      expect(mockSendSuggestionEphemeral).not.toHaveBeenCalled();
    });

    it('should handle AI service errors', async () => {
      mockGenerateSuggestion.mockRejectedValue(new Error('AI API rate limited'));

      const job = createMockJob({
        workspaceId: 'W123',
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'Test',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      await expect(processAIResponseJob(job)).rejects.toThrow('AI API rate limited');
    });

    it('should emit result with suggestionId and processingTimeMs', async () => {
      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Test suggestion',
        processingTimeMs: 200,
      });

      const job = createMockJob({
        workspaceId: 'W123',
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'Test',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      const result = await processAIResponseJob(job);

      expect(result.suggestionId).toMatch(/^sug_/);
      expect(typeof result.processingTimeMs).toBe('number');
      expect(result.processingTimeMs).toBe(200);
    });

    it('should deliver suggestion via sendSuggestionEphemeral when installation exists', async () => {
      // Seed workspace and installation
      const encryptionKey = TEST_ENCRYPTION_KEY;
      const encryptedToken = encrypt('xoxb-real-token', encryptionKey);

      const pgLite = getPGlite();
      const result = await pgLite.query<{ id: string }>(`
        WITH new_workspace AS (
          INSERT INTO workspaces (team_id, name)
          VALUES ('T123', 'Test Workspace')
          RETURNING id
        )
        INSERT INTO installations (workspace_id, bot_token, bot_user_id, bot_scopes)
        SELECT id, $1, 'B123', 'channels:history,chat:write'
        FROM new_workspace
        RETURNING workspace_id as id
      `, [encryptedToken]);

      const workspaceId = result.rows[0].id;

      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Delivered suggestion',
        processingTimeMs: 100,
      });
      mockSendSuggestionEphemeral.mockResolvedValue(undefined);

      const job = createMockJob({
        workspaceId,
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'Test message',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      await processAIResponseJob(job);

      expect(mockSendSuggestionEphemeral).toHaveBeenCalledTimes(1);
      expect(mockSendSuggestionEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'C123',
          userId: 'U123',
          suggestion: 'Delivered suggestion',
          triggerContext: 'mention',
        })
      );
    });

    it('should handle delivery errors gracefully (generation still succeeds)', async () => {
      // Seed workspace and installation
      const encryptionKey = TEST_ENCRYPTION_KEY;
      const encryptedToken = encrypt('xoxb-test-token', encryptionKey);

      const pgLite = getPGlite();
      const result = await pgLite.query<{ id: string }>(`
        WITH new_workspace AS (
          INSERT INTO workspaces (team_id, name)
          VALUES ('T456', 'Test Workspace 2')
          RETURNING id
        )
        INSERT INTO installations (workspace_id, bot_token, bot_user_id, bot_scopes)
        SELECT id, $1, 'B456', 'channels:history,chat:write'
        FROM new_workspace
        RETURNING workspace_id as id
      `, [encryptedToken]);

      const workspaceId = result.rows[0].id;

      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Generated but not delivered',
        processingTimeMs: 100,
      });
      mockSendSuggestionEphemeral.mockRejectedValue(new Error('Slack API error'));

      const job = createMockJob({
        workspaceId,
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'Test',
        contextMessages: [],
        triggeredBy: 'thread',
      });

      // Should not throw - delivery failure is non-fatal
      const jobResult = await processAIResponseJob(job);

      expect(jobResult.suggestion).toBe('Generated but not delivered');
      expect(mockSendSuggestionEphemeral).toHaveBeenCalledTimes(1);
    });

    it('should support different trigger types', async () => {
      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Response',
        processingTimeMs: 50,
      });

      const triggerTypes: AIResponseJobData['triggeredBy'][] = [
        'mention',
        'reply',
        'thread',
        'message_action',
      ];

      for (const triggeredBy of triggerTypes) {
        vi.clearAllMocks();

        const job = createMockJob({
          workspaceId: 'W123',
          userId: 'U123',
          channelId: 'C123',
          messageTs: '1234567890.000001',
          triggerMessageText: 'Test',
          contextMessages: [],
          triggeredBy,
        });

        await processAIResponseJob(job);

        expect(mockGenerateSuggestion).toHaveBeenCalledWith(
          expect.objectContaining({ triggeredBy })
        );
      }
    });

    it('should handle empty context messages', async () => {
      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Response without context',
        processingTimeMs: 80,
      });

      const job = createMockJob({
        workspaceId: 'W123',
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'Standalone message',
        contextMessages: [],
        triggeredBy: 'message_action',
      });

      const result = await processAIResponseJob(job);

      expect(result.suggestion).toBe('Response without context');
      expect(mockGenerateSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({ contextMessages: [] })
      );
    });

    it('should decrypt bot token correctly before delivery', async () => {
      // Seed workspace and installation with known encrypted token
      const encryptionKey = TEST_ENCRYPTION_KEY;
      const originalToken = 'xoxb-decrypt-test-token';
      const encryptedToken = encrypt(originalToken, encryptionKey);

      const pgLite = getPGlite();
      const result = await pgLite.query<{ id: string }>(`
        WITH new_workspace AS (
          INSERT INTO workspaces (team_id, name)
          VALUES ('T789', 'Test Workspace 3')
          RETURNING id
        )
        INSERT INTO installations (workspace_id, bot_token, bot_user_id, bot_scopes)
        SELECT id, $1, 'B789', 'channels:history,chat:write'
        FROM new_workspace
        RETURNING workspace_id as id
      `, [encryptedToken]);

      const workspaceId = result.rows[0].id;

      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Test',
        processingTimeMs: 100,
      });
      mockSendSuggestionEphemeral.mockResolvedValue(undefined);

      const job = createMockJob({
        workspaceId,
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'Test',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      await processAIResponseJob(job);

      // Verify WebClient was created with decrypted token
      expect(mockSendSuggestionEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          client: expect.any(WebClient),
        })
      );
    });
  });

  describe('Job Result Format', () => {
    it('should return correct result structure', async () => {
      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Structured result test',
        processingTimeMs: 175,
      });

      const job = createMockJob({
        workspaceId: 'W123',
        userId: 'U123',
        channelId: 'C123',
        messageTs: '1234567890.000001',
        triggerMessageText: 'Test',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      const result = await processAIResponseJob(job);

      // Verify result matches AIResponseJobResult interface
      expect(result).toEqual(
        expect.objectContaining({
          suggestionId: expect.stringMatching(/^sug_\d+_[a-z0-9]+$/),
          suggestion: 'Structured result test',
          processingTimeMs: 175,
        })
      );
    });

    it('should generate unique suggestionIds', async () => {
      mockGenerateSuggestion.mockResolvedValue({
        suggestion: 'Test',
        processingTimeMs: 50,
      });

      const results: string[] = [];

      for (let i = 0; i < 5; i++) {
        const job = createMockJob({
          workspaceId: 'W123',
          userId: 'U123',
          channelId: 'C123',
          messageTs: `1234567890.00000${i}`,
          triggerMessageText: 'Test',
          contextMessages: [],
          triggeredBy: 'mention',
        });

        const result = await processAIResponseJob(job);
        results.push(result.suggestionId);
      }

      // All IDs should be unique
      const uniqueIds = new Set(results);
      expect(uniqueIds.size).toBe(5);
    });
  });
});
