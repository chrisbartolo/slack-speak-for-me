/**
 * E2E test for app mention flow
 *
 * Tests the complete flow from app_mention event to suggestion delivery:
 * 1. User mentions bot in channel
 * 2. Event received and processed
 * 3. Context fetched from Slack
 * 4. AI generates suggestion
 * 5. Ephemeral message delivered to user
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupTestDb, cleanupTestDb, seedWorkspace, clearAllTables } from '../helpers/db.js';
import { server } from '../setup.js';
import type { App, AppMentionEvent } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';

// Store the test db instance for mocking
let testDb: Awaited<ReturnType<typeof setupTestDb>>;

// Use vi.hoisted to create mock functions that can be accessed in mock factories
const { mockAnthropicCreate, mockGetContextForMessage } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
  mockGetContextForMessage: vi.fn(),
}));

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

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate,
      },
    })),
  };
});

// Mock the env module for encryption key
vi.mock('../../src/env.js', () => ({
  env: {
    SLACK_SIGNING_SECRET: 'test-signing-secret',
    SLACK_CLIENT_ID: 'test-client-id',
    SLACK_CLIENT_SECRET: 'test-client-secret',
    SLACK_STATE_SECRET: 'test-state-secret-32-chars-minimum',
    ANTHROPIC_API_KEY: 'test-api-key',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    NODE_ENV: 'test',
    PORT: 3000,
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
  getEncryptionKey: () => Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
}));

// Mock the context service to avoid rate limiting issues
vi.mock('../../src/services/context.js', () => ({
  getContextForMessage: mockGetContextForMessage,
  getConversationContext: vi.fn().mockResolvedValue([
    { userId: 'U123', text: 'Context message 1', ts: '1234567890.123450' },
    { userId: 'U456', text: 'Context message 2', ts: '1234567890.123451' },
  ]),
  getThreadContext: vi.fn().mockResolvedValue([
    { userId: 'U123', text: 'Thread parent', ts: '1234567890.000100' },
    { userId: 'U456', text: 'Thread reply', ts: '1234567890.000101' },
  ]),
}));

// Mock the queue to process synchronously (simulates worker inline)
vi.mock('../../src/jobs/queues.js', () => ({
  queueAIResponse: vi.fn(),
  aiResponseQueue: {
    add: vi.fn(),
  },
}));

// Mock the logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    fatal: vi.fn(),
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

// Import after mocks are set up
import { registerAppMentionHandler } from '../../src/handlers/events/app-mention.js';
import { queueAIResponse } from '../../src/jobs/queues.js';
import { generateSuggestion, sendSuggestionEphemeral } from '../../src/services/index.js';
import { getContextForMessage } from '../../src/services/context.js';

// Helper to create a standard successful AI response
function createMockAIResponse(text: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

describe('App Mention E2E', () => {
  let workspaceId: string;
  let eventHandler: (args: {
    event: AppMentionEvent;
    client: Partial<WebClient>;
  }) => Promise<void>;

  beforeAll(async () => {
    testDb = await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    server.resetHandlers();
    await clearAllTables();

    // Set up default mock responses
    mockAnthropicCreate.mockResolvedValue(createMockAIResponse('Here is a professional response suggestion.'));
    mockGetContextForMessage.mockResolvedValue([
      { userId: 'U123', text: 'Context message 1', ts: '1234567890.123450' },
      { userId: 'U456', text: 'Context message 2', ts: '1234567890.123451' },
    ]);

    // Seed workspace with installation
    workspaceId = await seedWorkspace({
      teamId: 'T123',
      name: 'Test Workspace',
      botToken: 'xoxb-test-token',
      botUserId: 'BOT123',
    });

    // Register handler and capture the callback
    const mockApp: Partial<App> = {
      event: vi.fn((eventType: string, handler: unknown) => {
        if (eventType === 'app_mention') {
          eventHandler = handler as typeof eventHandler;
        }
      }),
    };
    registerAppMentionHandler(mockApp as App);
  });

  const createMockEvent = (overrides: Partial<AppMentionEvent> = {}): AppMentionEvent => ({
    type: 'app_mention',
    user: 'U456',
    channel: 'C789',
    ts: '1234567890.123456',
    text: '<@BOT123> help me respond to this difficult message',
    event_ts: '1234567890.123456',
    ...overrides,
  } as AppMentionEvent);

  const createMockClient = (): Partial<WebClient> => ({
    auth: {
      test: vi.fn().mockResolvedValue({ ok: true, team_id: 'T123' }),
    },
    conversations: {
      history: vi.fn().mockResolvedValue({
        ok: true,
        messages: [
          { type: 'message', user: 'U123', text: 'Previous message 1', ts: '1234567890.123450' },
          { type: 'message', user: 'U456', text: 'Previous message 2', ts: '1234567890.123451' },
        ],
      }),
      replies: vi.fn().mockResolvedValue({
        ok: true,
        messages: [
          { type: 'message', user: 'U123', text: 'Thread parent', ts: '1234567890.000100', thread_ts: '1234567890.000100' },
          { type: 'message', user: 'U456', text: 'Thread reply', ts: '1234567890.000101', thread_ts: '1234567890.000100' },
        ],
      }),
    },
    chat: {
      postEphemeral: vi.fn().mockResolvedValue({ ok: true, message_ts: '1234567890.999999' }),
    },
  } as unknown as Partial<WebClient>);

  describe('Complete app_mention flow', () => {
    it('should queue AI response job when bot is mentioned', async () => {
      const mockEvent = createMockEvent();
      const mockClient = createMockClient();

      await eventHandler({ event: mockEvent, client: mockClient });

      // Verify auth.test was called to get workspace ID
      expect(mockClient.auth?.test).toHaveBeenCalled();

      // Verify AI response job was queued with correct data
      expect(queueAIResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'T123',
          userId: 'U456',
          channelId: 'C789',
          messageTs: '1234567890.123456',
          triggerMessageText: '<@BOT123> help me respond to this difficult message',
          triggeredBy: 'mention',
        })
      );
    });

    it('should fetch context messages from conversation history', async () => {
      const mockEvent = createMockEvent();
      const mockClient = createMockClient();

      await eventHandler({ event: mockEvent, client: mockClient });

      // Verify getContextForMessage was called
      expect(getContextForMessage).toHaveBeenCalledWith(
        mockClient,
        'C789',
        '1234567890.123456',
        undefined // No thread_ts
      );

      // Verify context messages were included in job data
      expect(queueAIResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          contextMessages: expect.arrayContaining([
            expect.objectContaining({ userId: 'U123', text: 'Context message 1' }),
            expect.objectContaining({ userId: 'U456', text: 'Context message 2' }),
          ]),
        })
      );
    });

    it('should fetch thread context when mention is in a thread', async () => {
      mockGetContextForMessage.mockResolvedValue([
        { userId: 'U123', text: 'Thread parent', ts: '1234567890.000100' },
        { userId: 'U456', text: 'Thread reply', ts: '1234567890.000101' },
      ]);

      const mockEvent = createMockEvent({
        thread_ts: '1234567890.000100',
      });
      const mockClient = createMockClient();

      await eventHandler({ event: mockEvent, client: mockClient });

      // Verify getContextForMessage was called with thread_ts
      expect(getContextForMessage).toHaveBeenCalledWith(
        mockClient,
        'C789',
        '1234567890.123456',
        '1234567890.000100'
      );

      // Verify thread context was used
      expect(queueAIResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          contextMessages: expect.arrayContaining([
            expect.objectContaining({ text: 'Thread parent' }),
            expect.objectContaining({ text: 'Thread reply' }),
          ]),
        })
      );
    });

    it('should handle missing user gracefully', async () => {
      const mockEvent = createMockEvent({ user: undefined as unknown as string });
      const mockClient = createMockClient();

      await eventHandler({ event: mockEvent, client: mockClient });

      // Should not queue job when user is missing
      expect(queueAIResponse).not.toHaveBeenCalled();
    });

    it('should handle auth.test failure gracefully', async () => {
      const mockEvent = createMockEvent();
      const mockClient = {
        ...createMockClient(),
        auth: {
          test: vi.fn().mockResolvedValue({ ok: true, team_id: undefined }),
        },
      } as unknown as Partial<WebClient>;

      await eventHandler({ event: mockEvent, client: mockClient });

      // Should not queue job when workspace ID cannot be determined
      expect(queueAIResponse).not.toHaveBeenCalled();
    });

    it('should not throw on internal errors (catches and logs)', async () => {
      const mockEvent = createMockEvent();
      const mockClient = createMockClient();

      // Make queueAIResponse throw
      vi.mocked(queueAIResponse).mockRejectedValueOnce(new Error('Queue error'));

      // Should not throw, just log the error
      await expect(
        eventHandler({ event: mockEvent, client: mockClient })
      ).resolves.not.toThrow();
    });
  });

  describe('AI suggestion generation integration', () => {
    it('should generate suggestion with correct format', async () => {
      mockAnthropicCreate.mockResolvedValue(createMockAIResponse('Here is a professional response suggestion.'));

      // Call AI service directly to verify integration
      const result = await generateSuggestion({
        triggerMessage: 'Help me respond to this angry customer',
        contextMessages: [
          { userId: 'U123', text: 'Customer complaint about service', ts: '1234567890.000001' },
        ],
        triggeredBy: 'mention',
      });

      expect(result.suggestion).toBe('Here is a professional response suggestion.');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    });

    it('should include context messages in AI request', async () => {
      await generateSuggestion({
        triggerMessage: 'Help me respond',
        contextMessages: [
          { userId: 'U123', text: 'First message in context', ts: '1234567890.000001' },
          { userId: 'U456', text: 'Second message in context', ts: '1234567890.000002' },
        ],
        triggeredBy: 'mention',
      });

      // Verify the AI was called with context
      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('First message in context');
      expect(callArgs.messages[0].content).toContain('Second message in context');
    });

    it('should send ephemeral message with suggestion blocks', async () => {
      const mockClient = {
        chat: {
          postEphemeral: vi.fn().mockResolvedValue({ ok: true }),
        },
      } as unknown as WebClient;

      await sendSuggestionEphemeral({
        client: mockClient,
        channelId: 'C789',
        userId: 'U456',
        suggestionId: 'sug_123',
        suggestion: 'Test suggestion text',
        triggerContext: 'mention',
      });

      expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C789',
          user: 'U456',
          blocks: expect.arrayContaining([
            expect.objectContaining({ type: 'header' }),
            expect.objectContaining({ type: 'context' }),
            expect.objectContaining({ type: 'section' }),
            expect.objectContaining({ type: 'actions' }),
          ]),
        })
      );
    });

    it('should include action buttons in ephemeral message', async () => {
      let sentBlocks: unknown[] = [];
      const mockClient = {
        chat: {
          postEphemeral: vi.fn().mockImplementation(async (payload: { blocks: unknown[] }) => {
            sentBlocks = payload.blocks;
            return { ok: true };
          }),
        },
      } as unknown as WebClient;

      await sendSuggestionEphemeral({
        client: mockClient,
        channelId: 'C789',
        userId: 'U456',
        suggestionId: 'sug_123',
        suggestion: 'Test suggestion',
        triggerContext: 'mention',
      });

      // Find the actions block
      const actionsBlock = sentBlocks.find((b: unknown) => (b as { type: string }).type === 'actions') as {
        type: string;
        elements: Array<{ action_id: string; text: { text: string } }>;
      };
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock.elements).toHaveLength(3);

      // Verify action IDs
      const actionIds = actionsBlock.elements.map((e) => e.action_id);
      expect(actionIds).toContain('copy_suggestion');
      expect(actionIds).toContain('refine_suggestion');
      expect(actionIds).toContain('dismiss_suggestion');
    });
  });

  describe('Error handling', () => {
    it('should handle context fetch errors gracefully', async () => {
      mockGetContextForMessage.mockRejectedValueOnce(new Error('Slack API error'));

      const mockEvent = createMockEvent();
      const mockClient = createMockClient();

      // Should not throw, error is caught internally
      await expect(
        eventHandler({ event: mockEvent, client: mockClient })
      ).resolves.not.toThrow();
    });

    it('should handle AI API errors gracefully', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('AI API error'));

      await expect(
        generateSuggestion({
          triggerMessage: 'Test',
          contextMessages: [],
          triggeredBy: 'mention',
        })
      ).rejects.toThrow('AI API error');
    });
  });
});
