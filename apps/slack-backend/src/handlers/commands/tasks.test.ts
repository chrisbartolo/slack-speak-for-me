import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App, SlashCommand, AckFn, RespondFn } from '@slack/bolt';

vi.mock('../../services/watch.js', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue('workspace_123'),
}));

vi.mock('../../services/actionables.js', () => ({
  getPendingActionables: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { registerTasksCommand } from './tasks.js';
import { getWorkspaceId } from '../../services/watch.js';
import { getPendingActionables } from '../../services/actionables.js';

describe('/tasks Command', () => {
  let mockApp: Partial<App>;
  let handler: (args: {
    command: Partial<SlashCommand>;
    ack: AckFn<void>;
    respond: RespondFn;
  }) => Promise<void>;

  const createMockCommand = (overrides: Partial<SlashCommand> = {}): Partial<SlashCommand> => ({
    team_id: 'T123',
    user_id: 'U456',
    channel_id: 'C789',
    command: '/speakforme-tasks',
    text: '',
    response_url: 'https://hooks.slack.com/commands/T123/456/abc',
    trigger_id: 'trigger_123',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockApp = {
      command: vi.fn((commandName: string, h: unknown) => {
        if (commandName === '/speakforme-tasks') {
          handler = h as typeof handler;
        }
      }),
    };

    registerTasksCommand(mockApp as App);
  });

  it('should register handler for /tasks command', () => {
    expect(mockApp.command).toHaveBeenCalledWith('/speakforme-tasks', expect.any(Function));
  });

  it('should acknowledge the command immediately', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);

    await handler({
      command: createMockCommand(),
      ack,
      respond,
    });

    expect(ack).toHaveBeenCalled();
  });

  it('should show empty state when no tasks', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);

    await handler({
      command: createMockCommand(),
      ack,
      respond,
    });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('No pending tasks'),
            }),
          }),
        ]),
      })
    );
  });

  it('should display tasks grouped by urgency', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    vi.mocked(getPendingActionables).mockResolvedValue([
      {
        id: 'task-1',
        workspaceId: 'workspace_123',
        userId: 'U456',
        title: 'Overdue task',
        description: 'This is overdue',
        status: 'pending',
        channelId: 'C789',
        messageTs: '100.200',
        threadTs: null,
        messageText: 'Do this',
        actionableType: 'action_request',
        dueDate: yesterday,
        dueDateConfidence: 'explicit',
        originalDueDateText: 'yesterday',
        confidenceScore: 90,
        aiMetadata: null,
        snoozedUntil: null,
        completionNote: null,
        completionReplyTs: null,
        detectedAt: now,
        completedAt: null,
        dismissedAt: null,
        updatedAt: now,
      },
    ] as any);

    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);

    await handler({
      command: createMockCommand(),
      ack,
      respond,
    });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'ephemeral',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: expect.stringContaining('Your Tasks'),
            }),
          }),
        ]),
      })
    );
  });

  it('should handle workspace not found', async () => {
    vi.mocked(getWorkspaceId).mockResolvedValueOnce(undefined as any);

    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);

    await handler({
      command: createMockCommand(),
      ack,
      respond,
    });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Workspace not found'),
      })
    );
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(getPendingActionables).mockRejectedValue(new Error('DB error'));

    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);

    await handler({
      command: createMockCommand(),
      ack,
      respond,
    });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Failed to fetch tasks'),
      })
    );
  });

  describe('Help text', () => {
    it('should respond with help text when text is help', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);

      await handler({
        command: createMockCommand({ text: 'help' }),
        ack,
        respond,
      });

      expect(ack).toHaveBeenCalled();
      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('/speakforme-tasks'),
          response_type: 'ephemeral',
        })
      );
      expect(getPendingActionables).not.toHaveBeenCalled();
    });
  });

});
