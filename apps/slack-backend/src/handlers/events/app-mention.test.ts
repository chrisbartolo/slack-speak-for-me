import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App, AppMentionEvent } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';

// Mock dependencies before importing handler
vi.mock('../../jobs/queues.js', () => ({
  queueAIResponse: vi.fn().mockResolvedValue({ id: 'job_123', name: 'generate-suggestion' }),
}));

vi.mock('../../services/context.js', () => ({
  getContextForMessage: vi.fn().mockResolvedValue([
    { userId: 'U123', text: 'Context message 1', ts: '1234567890.000001' },
    { userId: 'U456', text: 'Context message 2', ts: '1234567890.000002' },
  ]),
}));

vi.mock('../../services/watch.js', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue('workspace_123'),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { registerAppMentionHandler } from './app-mention.js';
import { queueAIResponse } from '../../jobs/queues.js';
import { getContextForMessage } from '../../services/context.js';
import { getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';

describe('App Mention Handler', () => {
  let mockApp: Partial<App>;
  let eventHandler: (args: {
    event: AppMentionEvent;
    client: Partial<WebClient>;
  }) => Promise<void>;

  const createMockEvent = (overrides: Partial<AppMentionEvent> = {}): AppMentionEvent => ({
    type: 'app_mention',
    user: 'U123',
    channel: 'C456',
    ts: '1234567890.123456',
    text: '<@BOT123> help me with this',
    event_ts: '1234567890.123456',
    ...overrides,
  } as AppMentionEvent);

  const createMockClient = (overrides: Record<string, unknown> = {}): Partial<WebClient> => ({
    auth: {
      test: vi.fn().mockResolvedValue({ ok: true, team_id: 'T789' }),
    },
    ...overrides,
  } as unknown as Partial<WebClient>);

  beforeEach(() => {
    vi.clearAllMocks();

    // Capture the handler when registered
    mockApp = {
      event: vi.fn((eventType: string, handler: unknown) => {
        if (eventType === 'app_mention') {
          eventHandler = handler as typeof eventHandler;
        }
      }),
    };

    registerAppMentionHandler(mockApp as App);
  });

  it('should register handler for app_mention event', () => {
    expect(mockApp.event).toHaveBeenCalledWith('app_mention', expect.any(Function));
  });

  it('should queue AI response job when mentioned', async () => {
    const mockEvent = createMockEvent();
    const mockClient = createMockClient();

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(getWorkspaceId).toHaveBeenCalledWith('T789');
    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_123',
        userId: 'U123',
        channelId: 'C456',
        messageTs: '1234567890.123456',
        triggerMessageText: '<@BOT123> help me with this',
        triggeredBy: 'mention',
      })
    );
  });

  it('should fetch context before queueing job', async () => {
    const mockEvent = createMockEvent();
    const mockClient = createMockClient();

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(getContextForMessage).toHaveBeenCalledWith(
      mockClient,
      'C456',
      '1234567890.123456',
      undefined // No thread_ts
    );
  });

  it('should use thread context when thread_ts provided', async () => {
    const mockEvent = createMockEvent({
      thread_ts: '1234567890.000100',
    });
    const mockClient = createMockClient();

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(getContextForMessage).toHaveBeenCalledWith(
      mockClient,
      'C456',
      '1234567890.123456',
      '1234567890.000100'
    );
  });

  it('should include context messages in job data', async () => {
    const mockEvent = createMockEvent();
    const mockClient = createMockClient();

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        contextMessages: [
          { userId: 'U123', text: 'Context message 1', ts: '1234567890.000001' },
          { userId: 'U456', text: 'Context message 2', ts: '1234567890.000002' },
        ],
      })
    );
  });

  it('should get workspaceId from auth.test and look up internal ID', async () => {
    const mockEvent = createMockEvent();
    const authTestMock = vi.fn().mockResolvedValue({ ok: true, team_id: 'TWORKSPACE' });
    const mockClient = createMockClient({
      auth: { test: authTestMock },
    });

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(authTestMock).toHaveBeenCalled();
    expect(getWorkspaceId).toHaveBeenCalledWith('TWORKSPACE');
    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_123',
      })
    );
  });

  it('should skip if teamId cannot be determined', async () => {
    const mockEvent = createMockEvent();
    const mockClient = createMockClient({
      auth: { test: vi.fn().mockResolvedValue({ ok: true, team_id: undefined }) },
    });

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Could not determine team ID from auth.test');
  });

  it('should skip if workspace not found for team ID', async () => {
    vi.mocked(getWorkspaceId).mockResolvedValueOnce(null);
    const mockEvent = createMockEvent();
    const mockClient = createMockClient();

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({ teamId: 'T789' }, 'Workspace not found for team ID');
  });

  it('should skip if user is missing from event', async () => {
    const mockEvent = createMockEvent({ user: undefined as unknown as string });
    const mockClient = createMockClient();

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(queueAIResponse).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('app_mention event missing user ID');
  });

  it('should not throw on handler error (catches internally)', async () => {
    const mockEvent = createMockEvent();
    const mockClient = createMockClient();
    const testError = new Error('Queue error');

    vi.mocked(queueAIResponse).mockRejectedValueOnce(testError);

    // Should not throw
    await expect(eventHandler({ event: mockEvent, client: mockClient })).resolves.not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: testError }),
      'Error handling app_mention event'
    );
  });

  it('should log job queued info on success', async () => {
    const mockEvent = createMockEvent();
    const mockClient = createMockClient();

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job_123',
        channel: 'C456',
        user: 'U123',
      }),
      'AI response job queued for app mention'
    );
  });

  it('should log event received with all relevant fields', async () => {
    const mockEvent = createMockEvent({
      thread_ts: '1234567890.000100',
    });
    const mockClient = createMockClient();

    await eventHandler({ event: mockEvent, client: mockClient });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C456',
        user: 'U123',
        ts: '1234567890.123456',
        threadTs: '1234567890.000100',
      }),
      'app_mention event received'
    );
  });
});
