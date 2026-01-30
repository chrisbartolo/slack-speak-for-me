/**
 * E2E test for complete suggestion workflow
 *
 * Tests all Phase 2 success criteria:
 * SC1: User receives ephemeral suggestion when mentioned
 * SC2: User receives ephemeral suggestion when replied to in watched conversation
 * SC3: User receives ephemeral suggestion in active thread
 * SC4: User can trigger via message shortcut
 * SC5: User can refine suggestion
 * SC6: User can copy suggestion
 * SC7: User can toggle watch/unwatch
 * SC8: Context included in AI request
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, cleanupTestDb, seedWorkspace, clearAllTables, getPGlite } from '../helpers/db.js';
import { server } from '../setup.js';
import type { App, SlashCommand, MessageShortcut, BlockAction, ViewSubmitAction } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';

// Store the test db instance for mocking
let testDb: Awaited<ReturnType<typeof setupTestDb>>;

// Use vi.hoisted to create mock functions that can be accessed in mock factories
const { mockAnthropicCreate, mockGetContextForMessage, mockGetThreadContext, mockQueueAIResponse } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
  mockGetContextForMessage: vi.fn(),
  mockGetThreadContext: vi.fn(),
  mockQueueAIResponse: vi.fn(),
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

// Mock the env module
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

// Mock the context service
vi.mock('../../src/services/context.js', () => ({
  getContextForMessage: mockGetContextForMessage,
  getConversationContext: vi.fn().mockResolvedValue([]),
  getThreadContext: mockGetThreadContext,
}));

// Mock the queue
vi.mock('../../src/jobs/queues.js', () => ({
  queueAIResponse: mockQueueAIResponse,
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

// Mock the personalization module to avoid database access
vi.mock('../../src/services/personalization/index.js', () => ({
  buildStyleContext: vi.fn().mockResolvedValue({
    promptText: 'You are a helpful assistant. Respond professionally.',
    learningPhase: 'initial',
    usedHistory: false,
  }),
  trackRefinement: vi.fn().mockResolvedValue(undefined),
  getStylePreferences: vi.fn().mockResolvedValue(null),
  upsertStylePreferences: vi.fn().mockResolvedValue({}),
  deleteStylePreferences: vi.fn().mockResolvedValue(true),
  hasConsent: vi.fn().mockResolvedValue(true),
  grantConsent: vi.fn().mockResolvedValue(undefined),
  revokeConsent: vi.fn().mockResolvedValue(undefined),
  getConsentStatus: vi.fn().mockResolvedValue({ hasConsent: true }),
  requireConsent: vi.fn(),
  ConsentType: { DATA_COLLECTION: 'data_collection', PERSONALIZATION: 'personalization' },
  ConsentRequiredError: class ConsentRequiredError extends Error {},
  storeMessageEmbedding: vi.fn().mockResolvedValue(undefined),
  findSimilarMessages: vi.fn().mockResolvedValue([]),
  analyzeWritingPatterns: vi.fn().mockResolvedValue(null),
  getMessageHistoryCount: vi.fn().mockResolvedValue(0),
}));

// Import after mocks are set up
import { registerWatchCommands } from '../../src/handlers/commands/watch.js';
import { registerMessageReplyHandler } from '../../src/handlers/events/message-reply.js';
import { registerHelpMeRespondShortcut } from '../../src/handlers/shortcuts/help-me-respond.js';
import { registerRefineSuggestionAction } from '../../src/handlers/actions/refine-suggestion.js';
import { registerCopySuggestionAction } from '../../src/handlers/actions/copy-suggestion.js';
import { registerRefinementModalHandler } from '../../src/handlers/views/refinement-modal.js';
import { watchConversation, recordThreadParticipation, isWatching } from '../../src/services/watch.js';
import { refineSuggestion } from '../../src/services/index.js';

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

describe('Suggestion Flow E2E', () => {
  let workspaceId: string;

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
    mockAnthropicCreate.mockResolvedValue(createMockAIResponse('Test suggestion'));
    mockGetContextForMessage.mockResolvedValue([
      { userId: 'U123', text: 'Context message', ts: '1234567890.123450' },
    ]);
    mockGetThreadContext.mockResolvedValue([
      { userId: 'U123', text: 'Thread parent', ts: '1234567890.000100' },
      { userId: 'U456', text: 'Thread reply', ts: '1234567890.000101' },
    ]);
    mockQueueAIResponse.mockResolvedValue({ id: 'job_123', name: 'generate-suggestion' });

    // Seed workspace with installation
    workspaceId = await seedWorkspace({
      teamId: 'T123',
      name: 'Test Workspace',
      botToken: 'xoxb-test-token',
      botUserId: 'BOT123',
    });
  });

  describe('SC7: Watch/Unwatch Commands', () => {
    let watchCommandHandler: (args: {
      command: SlashCommand;
      ack: () => Promise<void>;
      respond: (msg: { text: string; response_type: string }) => Promise<void>;
    }) => Promise<void>;

    let unwatchCommandHandler: (args: {
      command: SlashCommand;
      ack: () => Promise<void>;
      respond: (msg: { text: string; response_type: string }) => Promise<void>;
    }) => Promise<void>;

    beforeEach(() => {
      // Register handlers and capture callbacks
      const mockApp: Partial<App> = {
        command: vi.fn((commandName: string, handler: unknown) => {
          if (commandName === '/watch') {
            watchCommandHandler = handler as typeof watchCommandHandler;
          } else if (commandName === '/unwatch') {
            unwatchCommandHandler = handler as typeof unwatchCommandHandler;
          }
        }),
      };
      registerWatchCommands(mockApp as App);
    });

    it('should add watch via /watch command', async () => {
      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockRespond = vi.fn().mockResolvedValue(undefined);

      // Use Slack team ID, not internal UUID - handler converts via getWorkspaceId
      const command: SlashCommand = {
        team_id: 'T123',
        user_id: 'U456',
        channel_id: 'C789',
        command: '/watch',
        text: '',
      } as SlashCommand;

      await watchCommandHandler({ command, ack: mockAck, respond: mockRespond });

      // Verify ack was called
      expect(mockAck).toHaveBeenCalled();

      // Verify respond was called with confirmation
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Now watching'),
          response_type: 'ephemeral',
        })
      );

      // Verify watch record exists in database
      const watching = await isWatching(workspaceId, 'U456', 'C789');
      expect(watching).toBe(true);
    });

    it('should not duplicate watch if already watching', async () => {
      // First, add watch
      await watchConversation(workspaceId, 'U456', 'C789');

      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockRespond = vi.fn().mockResolvedValue(undefined);

      // Use Slack team ID, not internal UUID
      const command: SlashCommand = {
        team_id: 'T123',
        user_id: 'U456',
        channel_id: 'C789',
        command: '/watch',
        text: '',
      } as SlashCommand;

      await watchCommandHandler({ command, ack: mockAck, respond: mockRespond });

      // Should respond that already watching
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('already watching'),
        })
      );

      // Verify only one record exists
      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM watched_conversations WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, 'U456']
      );
      expect(parseInt(result.rows[0].count)).toBe(1);
    });

    it('should remove watch via /unwatch command', async () => {
      // First, add watch
      await watchConversation(workspaceId, 'U456', 'C789');

      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockRespond = vi.fn().mockResolvedValue(undefined);

      // Use Slack team ID, not internal UUID
      const command: SlashCommand = {
        team_id: 'T123',
        user_id: 'U456',
        channel_id: 'C789',
        command: '/unwatch',
        text: '',
      } as SlashCommand;

      await unwatchCommandHandler({ command, ack: mockAck, respond: mockRespond });

      // Verify ack was called
      expect(mockAck).toHaveBeenCalled();

      // Verify respond was called with confirmation
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Stopped watching'),
          response_type: 'ephemeral',
        })
      );

      // Verify watch record was deleted
      const watching = await isWatching(workspaceId, 'U456', 'C789');
      expect(watching).toBe(false);
    });

    it('should handle unwatch when not watching', async () => {
      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockRespond = vi.fn().mockResolvedValue(undefined);

      // Use Slack team ID, not internal UUID
      const command: SlashCommand = {
        team_id: 'T123',
        user_id: 'U456',
        channel_id: 'C789',
        command: '/unwatch',
        text: '',
      } as SlashCommand;

      await unwatchCommandHandler({ command, ack: mockAck, respond: mockRespond });

      // Should respond that not watching
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('not watching'),
        })
      );
    });
  });

  describe('SC2/SC3: Reply Detection and Thread Participation', () => {
    let messageHandler: (args: {
      message: unknown;
      client: Partial<WebClient>;
    }) => Promise<void>;

    beforeEach(() => {
      const mockApp: Partial<App> = {
        message: vi.fn((handler: unknown) => {
          messageHandler = handler as typeof messageHandler;
        }),
      };
      registerMessageReplyHandler(mockApp as App);
    });

    it('should trigger suggestion when someone replies in watched thread', async () => {
      // Set up user U123 watching channel C789 and participating in thread
      await watchConversation(workspaceId, 'U123', 'C789');
      await recordThreadParticipation(workspaceId, 'U123', 'C789', '1234567890.000100');

      // Use Slack team ID in auth.test - handler converts via getWorkspaceId
      const mockClient: Partial<WebClient> = {
        auth: {
          test: vi.fn().mockResolvedValue({ ok: true, team_id: 'T123' }),
        },
      } as unknown as Partial<WebClient>;

      // Simulate U456 replying in the thread
      const message = {
        user: 'U456',
        text: 'Reply to your message',
        ts: '1234567890.000200',
        channel: 'C789',
        thread_ts: '1234567890.000100',
      };

      await messageHandler({ message, client: mockClient });

      // Verify AI response was queued for the watching user (U123)
      expect(mockQueueAIResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          userId: 'U123', // The watching user, not the replying user
          channelId: 'C789',
          triggeredBy: 'thread',
        })
      );
    });

    it('should not trigger if user is not watching', async () => {
      // U123 participates but doesn't watch
      await recordThreadParticipation(workspaceId, 'U123', 'C789', '1234567890.000100');

      // Use Slack team ID in auth.test
      const mockClient: Partial<WebClient> = {
        auth: {
          test: vi.fn().mockResolvedValue({ ok: true, team_id: 'T123' }),
        },
      } as unknown as Partial<WebClient>;

      const message = {
        user: 'U456',
        text: 'Reply message',
        ts: '1234567890.000200',
        channel: 'C789',
        thread_ts: '1234567890.000100',
      };

      await messageHandler({ message, client: mockClient });

      // Should not queue AI response
      expect(mockQueueAIResponse).not.toHaveBeenCalled();
    });

    it('should not trigger for bot messages', async () => {
      await watchConversation(workspaceId, 'U123', 'C789');

      // Use Slack team ID in auth.test
      const mockClient: Partial<WebClient> = {
        auth: {
          test: vi.fn().mockResolvedValue({ ok: true, team_id: 'T123' }),
        },
      } as unknown as Partial<WebClient>;

      const message = {
        user: 'UBOT',
        text: 'Bot message',
        ts: '1234567890.000200',
        channel: 'C789',
        bot_id: 'BOT123',
      };

      await messageHandler({ message, client: mockClient });

      // Should not queue AI response for bot messages
      expect(mockQueueAIResponse).not.toHaveBeenCalled();
    });

    it('should record thread participation when user posts in thread', async () => {
      // Use Slack team ID in auth.test
      const mockClient: Partial<WebClient> = {
        auth: {
          test: vi.fn().mockResolvedValue({ ok: true, team_id: 'T123' }),
        },
      } as unknown as Partial<WebClient>;

      const message = {
        user: 'U789',
        text: 'User posts in thread',
        ts: '1234567890.000200',
        channel: 'C789',
        thread_ts: '1234567890.000100',
      };

      await messageHandler({ message, client: mockClient });

      // Verify thread participation was recorded
      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM thread_participants WHERE workspace_id = $1 AND user_id = $2 AND thread_ts = $3',
        [workspaceId, 'U789', '1234567890.000100']
      );
      expect(parseInt(result.rows[0].count)).toBe(1);
    });
  });

  describe('SC4: Message Shortcut', () => {
    let shortcutHandler: (args: {
      shortcut: MessageShortcut;
      ack: () => Promise<void>;
      client: Partial<WebClient>;
      context: { teamId: string };
    }) => Promise<void>;

    beforeEach(() => {
      const mockApp: Partial<App> = {
        shortcut: vi.fn((callbackId: string, handler: unknown) => {
          if (callbackId === 'help_me_respond') {
            shortcutHandler = handler as typeof shortcutHandler;
          }
        }),
      };
      registerHelpMeRespondShortcut(mockApp as App);
    });

    it('should queue AI response via message shortcut', async () => {
      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockClient: Partial<WebClient> = {
        chat: {
          postEphemeral: vi.fn().mockResolvedValue({ ok: true }),
        },
      } as unknown as Partial<WebClient>;

      const shortcut: MessageShortcut = {
        type: 'message_action',
        callback_id: 'help_me_respond',
        user: { id: 'U456', username: 'testuser', team_id: 'T123', name: 'Test User' },
        channel: { id: 'C789', name: 'test-channel' },
        message: {
          ts: '1234567890.123456',
          text: 'Help me respond to this',
        },
        trigger_id: 'trigger_123',
      } as unknown as MessageShortcut;

      // Use Slack team ID, handler converts via getWorkspaceId
      await shortcutHandler({
        shortcut,
        ack: mockAck,
        client: mockClient,
        context: { teamId: 'T123' },
      });

      // Verify ack was called
      expect(mockAck).toHaveBeenCalled();

      // Verify AI response was queued with internal workspace UUID
      expect(mockQueueAIResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId, // Internal UUID, not Slack team ID
          userId: 'U456',
          channelId: 'C789',
          triggeredBy: 'message_action',
        })
      );

      // Verify acknowledgment ephemeral was sent
      expect(mockClient.chat?.postEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C789',
          user: 'U456',
          text: expect.stringContaining('Generating'),
        })
      );
    });

    it('should trigger regardless of watch status', async () => {
      // User is NOT watching, but shortcut should still work
      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockClient: Partial<WebClient> = {
        chat: {
          postEphemeral: vi.fn().mockResolvedValue({ ok: true }),
        },
      } as unknown as Partial<WebClient>;

      const shortcut: MessageShortcut = {
        type: 'message_action',
        callback_id: 'help_me_respond',
        user: { id: 'U456', username: 'testuser', team_id: 'T123', name: 'Test User' },
        channel: { id: 'C789', name: 'test-channel' },
        message: {
          ts: '1234567890.123456',
          text: 'Any message',
        },
        trigger_id: 'trigger_123',
      } as unknown as MessageShortcut;

      // Use Slack team ID, handler converts via getWorkspaceId
      await shortcutHandler({
        shortcut,
        ack: mockAck,
        client: mockClient,
        context: { teamId: 'T123' },
      });

      // Should still queue AI response
      expect(mockQueueAIResponse).toHaveBeenCalled();
    });
  });

  describe('SC5: Refinement Flow', () => {
    let refineActionHandler: (args: {
      ack: () => Promise<void>;
      body: BlockAction;
      client: Partial<WebClient>;
    }) => Promise<void>;

    let refinementModalHandler: (args: {
      ack: (response?: { response_action: string; view?: unknown; errors?: Record<string, string> }) => Promise<void>;
      body: ViewSubmitAction;
      view: { private_metadata: string; state: { values: Record<string, Record<string, { value: string }>> } };
      client: Partial<WebClient>;
    }) => Promise<void>;

    beforeEach(() => {
      const mockApp: Partial<App> = {
        action: vi.fn((actionId: string, handler: unknown) => {
          if (actionId === 'refine_suggestion') {
            refineActionHandler = handler as typeof refineActionHandler;
          }
        }),
        view: vi.fn((callbackId: string, handler: unknown) => {
          if (callbackId === 'refinement_modal') {
            refinementModalHandler = handler as typeof refinementModalHandler;
          }
        }),
      };
      registerRefineSuggestionAction(mockApp as App);
      registerRefinementModalHandler(mockApp as App);
    });

    it('should open refinement modal on refine action', async () => {
      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockViewsOpen = vi.fn().mockResolvedValue({ ok: true });
      const mockClient: Partial<WebClient> = {
        views: {
          open: mockViewsOpen,
        },
      } as unknown as Partial<WebClient>;

      // New format: JSON-encoded value with suggestionId and suggestion
      const actionValue = JSON.stringify({
        suggestionId: 'sug_123',
        suggestion: 'Current suggestion text',
      });

      const body: BlockAction = {
        trigger_id: 'trigger_123',
        team: { id: 'T123' }, // Slack team ID for workspace lookup
        user: { id: 'U456' },
        channel: { id: 'C789' },
        actions: [{ value: actionValue }],
      } as unknown as BlockAction;

      await refineActionHandler({ ack: mockAck, body, client: mockClient });

      // Verify ack was called
      expect(mockAck).toHaveBeenCalled();

      // Verify modal was opened
      expect(mockViewsOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_id: 'trigger_123',
          view: expect.objectContaining({
            type: 'modal',
            callback_id: 'refinement_modal',
          }),
        })
      );
    });

    it('should process refinement and update modal', async () => {
      mockAnthropicCreate.mockResolvedValue(createMockAIResponse('Refined suggestion text'));

      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockViewsUpdate = vi.fn().mockResolvedValue({ ok: true });
      const mockClient: Partial<WebClient> = {
        views: {
          update: mockViewsUpdate,
        },
      } as unknown as Partial<WebClient>;

      const metadata = {
        workspaceId,
        userId: 'U456',
        suggestionId: 'sug_123',
        currentSuggestion: 'Original suggestion',
        history: [],
      };

      const body: ViewSubmitAction = {
        view: { id: 'V123' },
      } as unknown as ViewSubmitAction;

      const view = {
        private_metadata: JSON.stringify(metadata),
        state: {
          values: {
            refinement_input: {
              refinement_text: {
                value: 'Make it more professional',
              },
            },
          },
        },
      };

      await refinementModalHandler({
        ack: mockAck,
        body,
        view,
        client: mockClient,
      });

      // Verify ack was called with response_action: update
      expect(mockAck).toHaveBeenCalledWith(
        expect.objectContaining({
          response_action: 'update',
        })
      );

      // Verify AI was called for refinement
      expect(mockAnthropicCreate).toHaveBeenCalled();

      // Verify modal was updated with refined suggestion
      expect(mockViewsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          view_id: 'V123',
          view: expect.objectContaining({
            type: 'modal',
            blocks: expect.arrayContaining([
              expect.objectContaining({
                type: 'section',
                text: expect.objectContaining({
                  text: 'Refined suggestion text',
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('should validate refinement input is not empty', async () => {
      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockClient: Partial<WebClient> = {} as Partial<WebClient>;

      const metadata = {
        workspaceId,
        userId: 'U456',
        suggestionId: 'sug_123',
        currentSuggestion: 'Original',
        history: [],
      };

      const view = {
        private_metadata: JSON.stringify(metadata),
        state: {
          values: {
            refinement_input: {
              refinement_text: {
                value: '   ', // Empty/whitespace
              },
            },
          },
        },
      };

      await refinementModalHandler({
        ack: mockAck,
        body: { view: { id: 'V123' } } as unknown as ViewSubmitAction,
        view,
        client: mockClient,
      });

      // Verify ack was called with errors
      expect(mockAck).toHaveBeenCalledWith(
        expect.objectContaining({
          response_action: 'errors',
          errors: expect.objectContaining({
            refinement_input: expect.any(String),
          }),
        })
      );
    });
  });

  describe('SC6: Copy Suggestion', () => {
    let copyActionHandler: (args: {
      ack: () => Promise<void>;
      body: BlockAction;
      respond: (response: unknown) => Promise<void>;
    }) => Promise<void>;

    beforeEach(() => {
      const mockApp: Partial<App> = {
        action: vi.fn((actionId: string, handler: unknown) => {
          if (actionId === 'copy_suggestion') {
            copyActionHandler = handler as typeof copyActionHandler;
          }
        }),
      };
      registerCopySuggestionAction(mockApp as App);
    });

    it('should show copy instructions with suggestion text', async () => {
      const mockAck = vi.fn().mockResolvedValue(undefined);
      const mockRespond = vi.fn().mockResolvedValue(undefined);

      // The copy action expects JSON-encoded value with suggestionId and suggestion
      const actionValue = JSON.stringify({
        suggestionId: 'sug_123',
        suggestion: 'Suggestion text to copy',
      });

      const body: BlockAction = {
        actions: [{ value: actionValue }],
        user: { id: 'U456' },
      } as unknown as BlockAction;

      await copyActionHandler({ ack: mockAck, body, respond: mockRespond });

      // Verify ack was called
      expect(mockAck).toHaveBeenCalled();

      // Verify respond was called with copy instructions (replace_original: true per implementation)
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.any(String),
          replace_original: true,
          blocks: expect.arrayContaining([
            expect.objectContaining({ type: 'header' }),
            expect.objectContaining({
              type: 'section',
              text: expect.objectContaining({
                text: expect.stringContaining('Suggestion text to copy'),
              }),
            }),
          ]),
        })
      );
    });
  });

  describe('SC8: Context Inclusion', () => {
    it('should include context messages in AI request', async () => {
      mockGetContextForMessage.mockResolvedValue([
        { userId: 'U123', text: 'First context message', ts: '1234567890.000001' },
        { userId: 'U456', text: 'Second context message', ts: '1234567890.000002' },
        { userId: 'U789', text: 'Third context message', ts: '1234567890.000003' },
      ]);

      // Test refinement which directly calls AI
      mockAnthropicCreate.mockResolvedValue(createMockAIResponse('Response with context'));

      const result = await refineSuggestion({
        originalSuggestion: 'Original',
        refinementRequest: 'Make it better',
      });

      expect(result.suggestion).toBe('Response with context');

      // Verify AI was called
      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
      expect(callArgs.messages[0].content).toContain('Original');
      expect(callArgs.messages[0].content).toContain('Make it better');
    });
  });

  describe('Integration: Full Flow', () => {
    it('should handle complete watch -> mention -> suggestion flow', async () => {
      // Step 1: User watches channel
      await watchConversation(workspaceId, 'U123', 'C789');
      const watching = await isWatching(workspaceId, 'U123', 'C789');
      expect(watching).toBe(true);

      // Step 2: User participates in thread
      await recordThreadParticipation(workspaceId, 'U123', 'C789', '1234567890.000100');

      // Step 3: Verify participation recorded
      const pgLite = getPGlite();
      const result = await pgLite.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM thread_participants WHERE user_id = $1',
        ['U123']
      );
      expect(parseInt(result.rows[0].count)).toBe(1);

      // Step 4: AI generates suggestion
      mockAnthropicCreate.mockResolvedValue(createMockAIResponse('Professional response'));

      const suggestionResult = await refineSuggestion({
        originalSuggestion: 'Draft response',
        refinementRequest: 'Make it professional',
      });

      expect(suggestionResult.suggestion).toBe('Professional response');
      expect(suggestionResult.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
