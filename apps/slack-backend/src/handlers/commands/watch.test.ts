import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App, SlashCommand, AckFn, RespondFn } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';

// Mock dependencies before importing handler
vi.mock('../../services/watch.js', () => ({
  watchConversation: vi.fn().mockResolvedValue(undefined),
  unwatchConversation: vi.fn().mockResolvedValue(undefined),
  isWatching: vi.fn().mockResolvedValue(false),
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

import { registerWatchCommands } from './watch.js';
import { watchConversation, unwatchConversation, isWatching, getWorkspaceId } from '../../services/watch.js';
import { logger } from '../../utils/logger.js';

describe('Watch Commands', () => {
  let mockApp: Partial<App>;
  let watchHandler: (args: {
    command: Partial<SlashCommand>;
    ack: AckFn<void>;
    respond: RespondFn;
    client: Partial<WebClient>;
  }) => Promise<void>;
  let unwatchHandler: (args: {
    command: Partial<SlashCommand>;
    ack: AckFn<void>;
    respond: RespondFn;
    client: Partial<WebClient>;
  }) => Promise<void>;

  const createMockCommand = (overrides: Partial<SlashCommand> = {}): Partial<SlashCommand> => ({
    team_id: 'T123',
    user_id: 'U456',
    channel_id: 'C789',
    command: '/watch',
    text: '',
    response_url: 'https://hooks.slack.com/commands/T123/456/abc',
    trigger_id: 'trigger_123',
    ...overrides,
  });

  const createMockClient = (): Partial<WebClient> => ({
    conversations: {
      info: vi.fn().mockResolvedValue({
        ok: true,
        channel: {
          id: 'C789',
          name: 'test-channel',
          is_im: false,
          is_mpim: false,
          is_private: false,
        },
      }),
    },
  } as unknown as Partial<WebClient>);

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks to default behavior
    vi.mocked(isWatching).mockResolvedValue(false);

    // Capture handlers when registered
    mockApp = {
      command: vi.fn((commandName: string, handler: unknown) => {
        if (commandName === '/watch') {
          watchHandler = handler as typeof watchHandler;
        }
        if (commandName === '/unwatch') {
          unwatchHandler = handler as typeof unwatchHandler;
        }
      }),
    };

    registerWatchCommands(mockApp as App);
  });

  describe('/watch', () => {
    it('should register handler for /watch command', () => {
      expect(mockApp.command).toHaveBeenCalledWith('/watch', expect.any(Function));
    });

    it('should call ack() immediately (3-second requirement)', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();
      const client = createMockClient();

      await watchHandler({ command, ack, respond, client });

      expect(ack).toHaveBeenCalled();
      // ack should be called before any other async operations
      expect(ack.mock.invocationCallOrder[0]).toBeLessThan(
        respond.mock.invocationCallOrder[0] || Infinity
      );
    });

    it('should add watch when not already watching', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();
      const client = createMockClient();

      vi.mocked(isWatching).mockResolvedValueOnce(false);

      await watchHandler({ command, ack, respond, client });

      expect(getWorkspaceId).toHaveBeenCalledWith('T123');
      expect(isWatching).toHaveBeenCalledWith('workspace_123', 'U456', 'C789');
      // watchConversation now takes 5 params: workspaceId, userId, channelId, channelName?, channelType?
      expect(watchConversation).toHaveBeenCalledWith(
        'workspace_123',
        'U456',
        'C789',
        expect.anything(), // channelName (may be undefined)
        expect.anything()  // channelType (may be undefined)
      );
      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          response_type: 'ephemeral',
          text: expect.stringContaining('Now watching'),
        })
      );
    });

    it('should not add watch if already watching', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();
      const client = createMockClient();

      vi.mocked(isWatching).mockResolvedValueOnce(true);

      await watchHandler({ command, ack, respond, client });

      expect(getWorkspaceId).toHaveBeenCalledWith('T123');
      expect(isWatching).toHaveBeenCalledWith('workspace_123', 'U456', 'C789');
      expect(watchConversation).not.toHaveBeenCalled();
      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          response_type: 'ephemeral',
          text: expect.stringContaining('already watching'),
        })
      );
    });

    it('should use team_id, user_id, channel_id from command', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({
        team_id: 'TWORKSPACE',
        user_id: 'UUSER',
        channel_id: 'CCHANNEL',
      });
      const client = createMockClient();

      await watchHandler({ command, ack, respond, client });

      expect(getWorkspaceId).toHaveBeenCalledWith('TWORKSPACE');
      expect(isWatching).toHaveBeenCalledWith('workspace_123', 'UUSER', 'CCHANNEL');
      // watchConversation now takes 5 params: workspaceId, userId, channelId, channelName?, channelType?
      expect(watchConversation).toHaveBeenCalledWith(
        'workspace_123',
        'UUSER',
        'CCHANNEL',
        expect.anything(), // channelName
        expect.anything()  // channelType
      );
    });

    it('should respond with error message on failure', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();
      const client = createMockClient();
      const testError = new Error('Database error');

      vi.mocked(watchConversation).mockRejectedValueOnce(testError);

      await watchHandler({ command, ack, respond, client });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          response_type: 'ephemeral',
          text: expect.stringContaining('Failed'),
        })
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: testError }),
        'Failed to process /watch command'
      );
    });

    it('should log success when watch is added', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();
      const client = createMockClient();

      await watchHandler({ command, ack, respond, client });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace_123',
          userId: 'U456',
          channelId: 'C789',
        }),
        'User enabled watch for conversation'
      );
    });

    it('should handle respond failure gracefully', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn()
        .mockRejectedValueOnce(new Error('Respond failed'))
        .mockResolvedValueOnce(undefined);
      const command = createMockCommand();
      const client = createMockClient();

      vi.mocked(watchConversation).mockRejectedValueOnce(new Error('Watch error'));

      // Should not throw even if respond fails
      await expect(watchHandler({ command, ack, respond, client })).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to send error response'
      );
    });
  });

  describe('/unwatch', () => {
    it('should register handler for /unwatch command', () => {
      expect(mockApp.command).toHaveBeenCalledWith('/unwatch', expect.any(Function));
    });

    it('should call ack() immediately (3-second requirement)', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({ command: '/unwatch' });
      const client = createMockClient();

      vi.mocked(isWatching).mockResolvedValueOnce(true);

      await unwatchHandler({ command, ack, respond, client });

      expect(ack).toHaveBeenCalled();
      expect(ack.mock.invocationCallOrder[0]).toBeLessThan(
        respond.mock.invocationCallOrder[0] || Infinity
      );
    });

    it('should remove watch when currently watching', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({ command: '/unwatch' });
      const client = createMockClient();

      vi.mocked(isWatching).mockResolvedValueOnce(true);

      await unwatchHandler({ command, ack, respond, client });

      expect(getWorkspaceId).toHaveBeenCalledWith('T123');
      expect(isWatching).toHaveBeenCalledWith('workspace_123', 'U456', 'C789');
      expect(unwatchConversation).toHaveBeenCalledWith('workspace_123', 'U456', 'C789');
      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          response_type: 'ephemeral',
          text: expect.stringContaining('Stopped watching'),
        })
      );
    });

    it('should not remove watch if not watching', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({ command: '/unwatch' });
      const client = createMockClient();

      vi.mocked(isWatching).mockResolvedValueOnce(false);

      await unwatchHandler({ command, ack, respond, client });

      expect(getWorkspaceId).toHaveBeenCalledWith('T123');
      expect(isWatching).toHaveBeenCalledWith('workspace_123', 'U456', 'C789');
      expect(unwatchConversation).not.toHaveBeenCalled();
      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          response_type: 'ephemeral',
          text: expect.stringContaining('not watching'),
        })
      );
    });

    it('should use team_id, user_id, channel_id from command', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({
        command: '/unwatch',
        team_id: 'TWORKSPACE',
        user_id: 'UUSER',
        channel_id: 'CCHANNEL',
      });
      const client = createMockClient();

      vi.mocked(isWatching).mockResolvedValueOnce(true);

      await unwatchHandler({ command, ack, respond, client });

      expect(getWorkspaceId).toHaveBeenCalledWith('TWORKSPACE');
      expect(isWatching).toHaveBeenCalledWith('workspace_123', 'UUSER', 'CCHANNEL');
      expect(unwatchConversation).toHaveBeenCalledWith('workspace_123', 'UUSER', 'CCHANNEL');
    });

    it('should respond with error message on failure', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({ command: '/unwatch' });
      const client = createMockClient();
      const testError = new Error('Database error');

      vi.mocked(isWatching).mockResolvedValueOnce(true);
      vi.mocked(unwatchConversation).mockRejectedValueOnce(testError);

      await unwatchHandler({ command, ack, respond, client });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          response_type: 'ephemeral',
          text: expect.stringContaining('Failed'),
        })
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: testError }),
        'Failed to process /unwatch command'
      );
    });

    it('should log success when watch is removed', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({ command: '/unwatch' });
      const client = createMockClient();

      vi.mocked(isWatching).mockResolvedValueOnce(true);

      await unwatchHandler({ command, ack, respond, client });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace_123',
          userId: 'U456',
          channelId: 'C789',
        }),
        'User disabled watch for conversation'
      );
    });

    it('should handle respond failure gracefully', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn()
        .mockRejectedValueOnce(new Error('Respond failed'))
        .mockResolvedValueOnce(undefined);
      const command = createMockCommand({ command: '/unwatch' });
      const client = createMockClient();

      vi.mocked(isWatching).mockResolvedValueOnce(true);
      vi.mocked(unwatchConversation).mockRejectedValueOnce(new Error('Unwatch error'));

      // Should not throw even if respond fails
      await expect(unwatchHandler({ command, ack, respond, client })).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to send error response'
      );
    });
  });
});
