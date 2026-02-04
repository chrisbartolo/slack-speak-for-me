import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@slack/bolt';
import { registerHelpMeRespondShortcut } from './help-me-respond.js';

// Mock services
vi.mock('../../jobs/queues.js', () => ({
  queueAIResponse: vi.fn().mockResolvedValue({ id: 'job_123', name: 'generate-suggestion' }),
}));

vi.mock('../../services/context.js', () => ({
  getContextForMessage: vi.fn().mockResolvedValue([
    { userId: 'U123', text: 'Hello', ts: '1234567890.123456' },
    { userId: 'U456', text: 'Hi there', ts: '1234567890.123457' },
  ]),
}));

vi.mock('../../services/watch.js', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue('workspace_123'),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { queueAIResponse } from '../../jobs/queues.js';
import { getContextForMessage } from '../../services/context.js';
import { getWorkspaceId } from '../../services/watch.js';

describe('Help Me Respond Shortcut', () => {
  let mockApp: Partial<App>;
  let shortcutHandler: Function;
  let mockPostEphemeral: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPostEphemeral = vi.fn().mockResolvedValue({ ok: true });

    mockApp = {
      shortcut: vi.fn((callbackId: string, handler: Function) => {
        if (callbackId === 'help_me_respond') {
          shortcutHandler = handler;
        }
      }),
    };

    registerHelpMeRespondShortcut(mockApp as App);
  });

  it('should register handler for help_me_respond shortcut', () => {
    expect(mockApp.shortcut).toHaveBeenCalledWith('help_me_respond', expect.any(Function));
  });

  it('should call ack() immediately', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Help me respond to this', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(ack).toHaveBeenCalled();
  });

  it('should queue AI response job', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Help me respond to this', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(queueAIResponse).toHaveBeenCalled();
  });

  it('should queue job with triggeredBy: message_action', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Help me', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        triggeredBy: 'message_action',
      })
    );
  });

  it('should get context for the selected message', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C_TARGET' },
      message: { text: 'Target message', ts: '1234567890.999999' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(getContextForMessage).toHaveBeenCalledWith(
      client,
      'C_TARGET',
      '1234567890.999999',
      undefined
    );
  });

  it('should use message text as trigger', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'This is the trigger message text', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerMessageText: 'This is the trigger message text',
      })
    );
  });

  it('should get workspaceId from context.teamId and look up internal ID', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Message', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T_WORKSPACE_ABC' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(getWorkspaceId).toHaveBeenCalledWith('T_WORKSPACE_ABC');
    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_123',
      })
    );
  });

  it('should respond with confirmation message', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U_REQUESTER' },
      channel: { id: 'C_CHANNEL' },
      message: { text: 'Message', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(getWorkspaceId).toHaveBeenCalledWith('T123');
    expect(mockPostEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C_CHANNEL',
        user: 'U_REQUESTER',
        text: expect.stringContaining('Generating'),
      })
    );
  });

  it('should handle errors gracefully with error message to user', async () => {
    const { logger } = await import('../../utils/logger.js');
    const mockQueueAIResponse = vi.mocked(queueAIResponse);
    mockQueueAIResponse.mockRejectedValueOnce(new Error('Queue error'));

    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Message', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      expect.stringContaining('Error processing')
    );

    expect(mockPostEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('wrong'),
      })
    );
  });

  it('should include channel and message info in job data', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U_USER' },
      channel: { id: 'C_CHAN' },
      message: { text: 'Message', ts: '1234.5678' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_123',
        userId: 'U_USER',
        channelId: 'C_CHAN',
        messageTs: '1234.5678',
      })
    );
  });

  it('should pass thread_ts to getContextForMessage when in thread', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Thread reply', ts: '1234567890.123456', thread_ts: '1234567890.000001' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(getWorkspaceId).toHaveBeenCalledWith('T123');
    expect(getContextForMessage).toHaveBeenCalledWith(
      client,
      'C123',
      '1234567890.123456',
      '1234567890.000001'
    );
  });

  it('should log shortcut trigger with user, channel, and message info', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U_LOG' },
      channel: { id: 'C_LOG' },
      message: { text: 'Message', ts: '9999.8888' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'U_LOG',
        channel: 'C_LOG',
        messageTs: '9999.8888',
      }),
      'Help me respond shortcut triggered'
    );
  });

  it('should warn and return early when teamId is missing', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Message', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: undefined };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ shortcut }),
      'No team ID in context'
    );
    expect(queueAIResponse).not.toHaveBeenCalled();
    expect(mockPostEphemeral).not.toHaveBeenCalled();
  });

  it('should show error when workspace not found for team ID', async () => {
    const { logger } = await import('../../utils/logger.js');
    vi.mocked(getWorkspaceId).mockResolvedValueOnce(null);
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Message', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T_UNKNOWN' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(logger.error).toHaveBeenCalledWith({ teamId: 'T_UNKNOWN' }, 'Workspace not found for team ID');
    expect(queueAIResponse).not.toHaveBeenCalled();
    expect(mockPostEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Workspace not found'),
      })
    );
  });

  it('should include context messages in job data', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Message', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(getWorkspaceId).toHaveBeenCalledWith('T123');
    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_123',
        contextMessages: [
          { userId: 'U123', text: 'Hello', ts: '1234567890.123456' },
          { userId: 'U456', text: 'Hi there', ts: '1234567890.123457' },
        ],
      })
    );
  });

  it('should log job queued success info', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U_JOB' },
      channel: { id: 'C_JOB' },
      message: { text: 'Message', ts: '1111.2222' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(getWorkspaceId).toHaveBeenCalledWith('T123');
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C_JOB',
        user: 'U_JOB',
        messageTs: '1111.2222',
        jobQueued: true,
      }),
      'AI response job queued for message shortcut'
    );
  });

  it('should handle empty message text gracefully', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { ts: '1234567890.123456' }, // No text field
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    await shortcutHandler({ shortcut, ack, client, context });

    expect(getWorkspaceId).toHaveBeenCalledWith('T123');
    expect(queueAIResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_123',
        triggerMessageText: '',
      })
    );
  });

  it('should ignore ephemeral send failure on error path', async () => {
    const mockQueueAIResponse = vi.mocked(queueAIResponse);
    mockQueueAIResponse.mockRejectedValueOnce(new Error('Queue error'));
    mockPostEphemeral.mockRejectedValueOnce(new Error('Ephemeral send failed'));

    const ack = vi.fn().mockResolvedValue(undefined);
    const shortcut = {
      user: { id: 'U123' },
      channel: { id: 'C123' },
      message: { text: 'Message', ts: '1234567890.123456' },
    };
    const client = {
      chat: { postEphemeral: mockPostEphemeral },
    };
    const context = { teamId: 'T123' };

    // Should not throw even if ephemeral fails
    await expect(
      shortcutHandler({ shortcut, ack, client, context })
    ).resolves.toBeUndefined();
  });
});
