import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App, MessageEvent } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';

// Mock dependencies before importing handler
vi.mock('../../jobs/queues.js', () => ({
  queueAIResponse: vi.fn().mockResolvedValue({ id: 'job_123', name: 'generate-suggestion' }),
}));

vi.mock('../../services/watch.js', () => ({
  isWatching: vi.fn().mockResolvedValue(false),
  recordThreadParticipation: vi.fn().mockResolvedValue(undefined),
  isParticipatingInThread: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../services/context.js', () => ({
  getContextForMessage: vi.fn().mockResolvedValue([]),
  getThreadContext: vi.fn().mockResolvedValue([
    { userId: 'U123', text: 'Thread message 1', ts: '1234567890.000001' },
    { userId: 'U456', text: 'Thread reply', ts: '1234567890.000002' },
  ]),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { registerMessageReplyHandler } from './message-reply.js';
import { queueAIResponse } from '../../jobs/queues.js';
import { isWatching, recordThreadParticipation, isParticipatingInThread } from '../../services/watch.js';
import { getThreadContext } from '../../services/context.js';
import { logger } from '../../utils/logger.js';

// Define a generic message type for testing
type TestMessage = {
  type: string;
  user?: string;
  text?: string;
  ts?: string;
  channel?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
};

describe('Message Reply Handler', () => {
  let mockApp: Partial<App>;
  let messageHandler: (args: {
    message: TestMessage;
    client: Partial<WebClient>;
  }) => Promise<void>;

  const createMockMessage = (overrides: Partial<TestMessage> = {}): TestMessage => ({
    type: 'message',
    user: 'U789',
    text: 'Reply to thread',
    ts: '1234567890.999999',
    channel: 'C456',
    ...overrides,
  });

  const createMockClient = (overrides: Record<string, unknown> = {}): Partial<WebClient> => ({
    auth: {
      test: vi.fn().mockResolvedValue({ ok: true, team_id: 'T123' }),
    },
    ...overrides,
  } as unknown as Partial<WebClient>);

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks to default behavior
    vi.mocked(isWatching).mockResolvedValue(false);
    vi.mocked(isParticipatingInThread).mockResolvedValue(false);

    // Capture the handler when registered
    mockApp = {
      message: vi.fn((handler: unknown) => {
        messageHandler = handler as typeof messageHandler;
      }),
    };

    registerMessageReplyHandler(mockApp as App);
  });

  it('should register handler for message event', () => {
    expect(mockApp.message).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should skip bot messages (has bot_id)', async () => {
    const mockMessage = createMockMessage({ bot_id: 'B123' });
    const mockClient = createMockClient();

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
    expect(recordThreadParticipation).not.toHaveBeenCalled();
  });

  it('should skip messages with subtype', async () => {
    const mockMessage = createMockMessage({ subtype: 'channel_join' });
    const mockClient = createMockClient();

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
    expect(recordThreadParticipation).not.toHaveBeenCalled();
  });

  it('should skip messages missing user field', async () => {
    const mockMessage = createMockMessage({ user: undefined });
    const mockClient = createMockClient();

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
  });

  it('should skip messages missing text field', async () => {
    const mockMessage = createMockMessage({ text: undefined });
    const mockClient = createMockClient();

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
  });

  it('should skip messages missing ts field', async () => {
    const mockMessage = createMockMessage({ ts: undefined });
    const mockClient = createMockClient();

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
  });

  it('should skip if workspaceId cannot be determined', async () => {
    const mockMessage = createMockMessage({ thread_ts: '1234567890.000001' });
    const mockClient = createMockClient({
      auth: { test: vi.fn().mockResolvedValue({ ok: true, team_id: undefined }) },
    });

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Could not determine workspace ID from auth.test');
  });

  it('should record thread participation for thread messages', async () => {
    const mockMessage = createMockMessage({ thread_ts: '1234567890.000001' });
    const mockClient = createMockClient();

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(recordThreadParticipation).toHaveBeenCalledWith(
      'T123',
      'U789',
      'C456',
      '1234567890.000001'
    );
  });

  it('should not record thread participation for non-thread messages', async () => {
    const mockMessage = createMockMessage(); // No thread_ts
    const mockClient = createMockClient();

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(recordThreadParticipation).not.toHaveBeenCalled();
  });

  it('should check watching status for thread participants', async () => {
    const mockMessage = createMockMessage({
      user: 'U789', // Current message author
      thread_ts: '1234567890.000001',
    });
    const mockClient = createMockClient();

    // Thread context returns different users
    vi.mocked(getThreadContext).mockResolvedValueOnce([
      { userId: 'U123', text: 'Original message', ts: '1234567890.000001' },
      { userId: 'U456', text: 'Another reply', ts: '1234567890.000002' },
    ]);

    await messageHandler({ message: mockMessage, client: mockClient });

    // Should check for U123 and U456 (excluding U789 who is the author)
    expect(isWatching).toHaveBeenCalledWith('T123', 'U123', 'C456');
    expect(isWatching).toHaveBeenCalledWith('T123', 'U456', 'C456');
  });

  it('should queue job only for watching + participating users', async () => {
    const mockMessage = createMockMessage({
      user: 'U789', // Current message author
      thread_ts: '1234567890.000001',
    });
    const mockClient = createMockClient();

    // Thread context shows U123 and U456 participated
    vi.mocked(getThreadContext).mockResolvedValueOnce([
      { userId: 'U123', text: 'Original message', ts: '1234567890.000001' },
      { userId: 'U456', text: 'Another reply', ts: '1234567890.000002' },
    ]);

    // U123 is watching
    vi.mocked(isWatching)
      .mockResolvedValueOnce(true) // U123 is watching
      .mockResolvedValueOnce(false); // U456 is not watching

    // U123 is also participating
    vi.mocked(isParticipatingInThread).mockResolvedValueOnce(true);

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).toHaveBeenCalledTimes(1);
    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'T123',
        userId: 'U123',
        channelId: 'C456',
        triggeredBy: 'thread',
      })
    );
  });

  it('should not queue job for user who is watching but not participating', async () => {
    const mockMessage = createMockMessage({
      user: 'U789',
      thread_ts: '1234567890.000001',
    });
    const mockClient = createMockClient();

    vi.mocked(getThreadContext).mockResolvedValueOnce([
      { userId: 'U123', text: 'Original message', ts: '1234567890.000001' },
    ]);

    // U123 is watching but not participating
    vi.mocked(isWatching).mockResolvedValueOnce(true);
    vi.mocked(isParticipatingInThread).mockResolvedValueOnce(false);

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
  });

  it('should not queue job for message author', async () => {
    const mockMessage = createMockMessage({
      user: 'U123', // Author is same as participant
      thread_ts: '1234567890.000001',
    });
    const mockClient = createMockClient();

    // Thread context includes the author
    vi.mocked(getThreadContext).mockResolvedValueOnce([
      { userId: 'U123', text: 'Original message', ts: '1234567890.000001' }, // Same as author
    ]);

    // U123 is watching and participating
    vi.mocked(isWatching).mockResolvedValueOnce(true);
    vi.mocked(isParticipatingInThread).mockResolvedValueOnce(true);

    await messageHandler({ message: mockMessage, client: mockClient });

    // Should not queue because U123 is filtered out as the message author
    expect(queueAIResponse).not.toHaveBeenCalled();
  });

  it('should skip non-thread messages (no thread_ts)', async () => {
    const mockMessage = createMockMessage(); // No thread_ts
    const mockClient = createMockClient();

    await messageHandler({ message: mockMessage, client: mockClient });

    // No job queued for non-thread messages
    expect(queueAIResponse).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'C456' }),
      'Non-thread message - skipping reply detection'
    );
  });

  it('should use thread root ts as messageTs in job data', async () => {
    const mockMessage = createMockMessage({
      user: 'U789',
      thread_ts: '1234567890.000001',
      ts: '1234567890.999999',
    });
    const mockClient = createMockClient();

    vi.mocked(getThreadContext).mockResolvedValueOnce([
      { userId: 'U123', text: 'Original message', ts: '1234567890.000001' },
    ]);

    vi.mocked(isWatching).mockResolvedValueOnce(true);
    vi.mocked(isParticipatingInThread).mockResolvedValueOnce(true);

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        messageTs: '1234567890.000001', // Thread root, not reply ts
      })
    );
  });

  it('should queue jobs for multiple watching participants', async () => {
    const mockMessage = createMockMessage({
      user: 'U789',
      thread_ts: '1234567890.000001',
    });
    const mockClient = createMockClient();

    vi.mocked(getThreadContext).mockResolvedValueOnce([
      { userId: 'U123', text: 'Original message', ts: '1234567890.000001' },
      { userId: 'U456', text: 'Another reply', ts: '1234567890.000002' },
    ]);

    // Both U123 and U456 are watching and participating
    vi.mocked(isWatching)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    vi.mocked(isParticipatingInThread)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).toHaveBeenCalledTimes(2);
    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'U123' })
    );
    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'U456' })
    );
  });

  it('should deduplicate participants with multiple messages', async () => {
    const mockMessage = createMockMessage({
      user: 'U789',
      thread_ts: '1234567890.000001',
    });
    const mockClient = createMockClient();

    // U123 has multiple messages in thread
    vi.mocked(getThreadContext).mockResolvedValueOnce([
      { userId: 'U123', text: 'First message', ts: '1234567890.000001' },
      { userId: 'U123', text: 'Second message', ts: '1234567890.000002' },
      { userId: 'U123', text: 'Third message', ts: '1234567890.000003' },
    ]);

    vi.mocked(isWatching).mockResolvedValueOnce(true);
    vi.mocked(isParticipatingInThread).mockResolvedValueOnce(true);

    await messageHandler({ message: mockMessage, client: mockClient });

    // Should only check and queue for U123 once
    expect(isWatching).toHaveBeenCalledTimes(1);
    expect(queueAIResponse).toHaveBeenCalledTimes(1);
  });

  it('should not throw on handler error (catches internally)', async () => {
    const mockMessage = createMockMessage({ thread_ts: '1234567890.000001' });
    const mockClient = createMockClient();
    const testError = new Error('Context fetch error');

    // Make getThreadContext throw to trigger the catch block
    vi.mocked(getThreadContext).mockRejectedValueOnce(testError);

    // Should not throw
    await expect(messageHandler({ message: mockMessage, client: mockClient })).resolves.not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: testError }),
      'Error handling message event'
    );
  });

  it('should include thread context messages in job data', async () => {
    const mockMessage = createMockMessage({
      user: 'U789',
      thread_ts: '1234567890.000001',
    });
    const mockClient = createMockClient();

    const contextMessages = [
      { userId: 'U123', text: 'Original message', ts: '1234567890.000001' },
    ];
    vi.mocked(getThreadContext).mockResolvedValueOnce(contextMessages);

    // U123 is watching and participating
    vi.mocked(isWatching).mockResolvedValueOnce(true);
    vi.mocked(isParticipatingInThread).mockResolvedValueOnce(true);

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        contextMessages,
      })
    );
  });

  it('should log detected reply info when queueing job', async () => {
    const mockMessage = createMockMessage({
      user: 'U789',
      thread_ts: '1234567890.000001',
    });
    const mockClient = createMockClient();

    vi.mocked(getThreadContext).mockResolvedValueOnce([
      { userId: 'U123', text: 'Original message', ts: '1234567890.000001' },
    ]);

    vi.mocked(isWatching).mockResolvedValueOnce(true);
    vi.mocked(isParticipatingInThread).mockResolvedValueOnce(true);

    await messageHandler({ message: mockMessage, client: mockClient });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'T123',
        watchingUser: 'U123',
        replyingUser: 'U789',
        channelId: 'C456',
        threadTs: '1234567890.000001',
      }),
      'Detected reply in watched thread'
    );
  });
});
