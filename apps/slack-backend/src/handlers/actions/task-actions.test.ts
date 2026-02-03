import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@slack/bolt';

vi.mock('../../services/watch.js', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue('workspace_123'),
}));

vi.mock('../../services/actionables.js', () => ({
  updateActionableStatus: vi.fn().mockResolvedValue(true),
  getActionableById: vi.fn().mockResolvedValue({
    id: 'task-1',
    title: 'Review PR',
    description: 'Review pull request #42',
    channelId: 'C789',
    messageTs: '100.200',
    threadTs: '100.100',
    messageText: 'Can you review this?',
    actionableType: 'action_request',
    status: 'pending',
  }),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { registerTaskActionHandlers } from './task-actions.js';
import { updateActionableStatus, getActionableById } from '../../services/actionables.js';
import { getWorkspaceId } from '../../services/watch.js';

describe('Task Action Handlers', () => {
  let mockApp: Partial<App>;
  let actionHandler: Function;
  let mockViewsOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockViewsOpen = vi.fn().mockResolvedValue({ ok: true });

    mockApp = {
      action: vi.fn((pattern: RegExp, handler: Function) => {
        actionHandler = handler;
      }),
    };

    registerTaskActionHandlers(mockApp as App);
  });

  it('should register handler for task_actions_ pattern', () => {
    expect(mockApp.action).toHaveBeenCalledWith(
      expect.any(RegExp),
      expect.any(Function)
    );
  });

  const createActionArgs = (selectedValue: string, overrides = {}) => ({
    action: {
      selected_option: { value: selectedValue },
    },
    ack: vi.fn().mockResolvedValue(undefined),
    body: {
      team: { id: 'T123' },
      user: { id: 'U456' },
      trigger_id: 'trigger_123',
      ...overrides,
    },
    respond: vi.fn().mockResolvedValue(undefined),
    client: {
      views: { open: mockViewsOpen },
    },
  });

  describe('Complete action', () => {
    it('should open a modal when completing a task', async () => {
      const args = createActionArgs('complete_task-1');

      await actionHandler(args);

      expect(args.ack).toHaveBeenCalled();
      expect(getActionableById).toHaveBeenCalledWith('workspace_123', 'U456', 'task-1');
      expect(mockViewsOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_id: 'trigger_123',
          view: expect.objectContaining({
            type: 'modal',
            callback_id: 'task_completion_modal',
          }),
        })
      );
    });

    it('should show error if task not found', async () => {
      vi.mocked(getActionableById).mockResolvedValueOnce(null);
      const args = createActionArgs('complete_task-999');

      await actionHandler(args);

      expect(args.respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Task not found'),
        })
      );
    });

    it('should fall back to direct complete if no trigger_id', async () => {
      const args = createActionArgs('complete_task-1', { trigger_id: undefined });

      await actionHandler(args);

      expect(updateActionableStatus).toHaveBeenCalledWith(
        'workspace_123', 'U456', 'task-1', 'completed'
      );
      expect(args.respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Task marked as complete'),
        })
      );
    });
  });

  describe('Snooze action', () => {
    it('should snooze task for 1 day', async () => {
      const args = createActionArgs('snooze_1d_task-1');

      await actionHandler(args);

      expect(updateActionableStatus).toHaveBeenCalledWith(
        'workspace_123',
        'U456',
        'task-1',
        'snoozed',
        expect.any(Date)
      );
      expect(args.respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('snoozed'),
        })
      );
    });
  });

  describe('Dismiss action', () => {
    it('should dismiss task', async () => {
      const args = createActionArgs('dismiss_task-1');

      await actionHandler(args);

      expect(updateActionableStatus).toHaveBeenCalledWith(
        'workspace_123', 'U456', 'task-1', 'dismissed'
      );
      expect(args.respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('dismissed'),
        })
      );
    });
  });

  describe('View action', () => {
    it('should return a deep link to the message', async () => {
      const args = createActionArgs('view_C789_100.200');

      await actionHandler(args);

      expect(args.respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('slack://channel'),
        })
      );
    });
  });

  it('should handle workspace not found', async () => {
    vi.mocked(getWorkspaceId).mockResolvedValueOnce(undefined as any);
    const args = createActionArgs('complete_task-1');

    await actionHandler(args);

    expect(args.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Workspace not found'),
      })
    );
  });
});
