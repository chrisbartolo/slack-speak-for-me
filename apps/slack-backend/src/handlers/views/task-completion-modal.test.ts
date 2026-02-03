import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@slack/bolt';

vi.mock('../../services/actionables.js', () => ({
  updateActionableStatus: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../services/task-completion-ai.js', () => ({
  generateTaskCompletionReply: vi.fn().mockResolvedValue({
    reply: "Hey! Got that done for you, all sorted",
    processingTimeMs: 800,
  }),
}));

vi.mock('@slack-speak/database', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { userToken: 'encrypted_token', userId: 'U456' },
          ]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  installations: { workspaceId: 'workspace_id', userToken: 'user_token', userId: 'user_id' },
  actionableItems: { id: 'id', workspaceId: 'workspace_id', completionReplyTs: 'completion_reply_ts' },
  decrypt: vi.fn().mockReturnValue('decrypted_user_token'),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: {
      postMessage: vi.fn().mockResolvedValue({ ok: true, ts: '999.888' }),
    },
  })),
}));

vi.mock('../../env.js', () => ({
  getEncryptionKey: vi.fn().mockReturnValue(Buffer.alloc(32)),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { registerTaskCompletionModalHandler } from './task-completion-modal.js';
import { updateActionableStatus } from '../../services/actionables.js';
import { generateTaskCompletionReply } from '../../services/task-completion-ai.js';
import { WebClient } from '@slack/web-api';

describe('Task Completion Modal Handler', () => {
  let mockApp: Partial<App>;
  let viewHandler: Function;

  const metadata = {
    taskId: 'task-1',
    workspaceId: 'workspace_123',
    userId: 'U456',
    channelId: 'C789',
    messageTs: '100.200',
    threadTs: '100.100',
    messageText: 'Can you review this PR?',
    taskTitle: 'Review the PR',
    taskDescription: 'Review pull request #42',
    actionableType: 'action_request',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApp = {
      view: vi.fn((callbackId: string | RegExp | object, handler?: Function) => {
        const cbId = typeof callbackId === 'string' ? callbackId : '';
        const cb = typeof callbackId === 'function' ? callbackId : handler;
        if (cbId === 'task_completion_modal' && cb) {
          viewHandler = cb;
        }
      }),
    };

    registerTaskCompletionModalHandler(mockApp as App);
  });

  it('should register handler for task_completion_modal', () => {
    expect(mockApp.view).toHaveBeenCalledWith('task_completion_modal', expect.any(Function));
  });

  it('should complete task and post reply when checkbox is checked', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          completion_note_block: {
            completion_note: { value: 'Fixed the auth issue' },
          },
          reply_in_thread_block: {
            reply_in_thread: {
              selected_options: [{ value: 'reply' }],
            },
          },
        },
      },
    };
    const body = { user: { id: 'U456' } };

    await viewHandler({ ack, view, body });

    expect(ack).toHaveBeenCalled();
    expect(updateActionableStatus).toHaveBeenCalledWith(
      'workspace_123', 'U456', 'task-1', 'completed', undefined, 'Fixed the auth issue'
    );
    expect(generateTaskCompletionReply).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace_123',
        userId: 'U456',
        taskTitle: 'Review the PR',
        completionNote: 'Fixed the auth issue',
      })
    );
    expect(WebClient).toHaveBeenCalledWith('decrypted_user_token');
  });

  it('should complete task without reply when checkbox unchecked', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          completion_note_block: {
            completion_note: { value: null },
          },
          reply_in_thread_block: {
            reply_in_thread: {
              selected_options: [],
            },
          },
        },
      },
    };
    const body = { user: { id: 'U456' } };

    await viewHandler({ ack, view, body });

    expect(updateActionableStatus).toHaveBeenCalledWith(
      'workspace_123', 'U456', 'task-1', 'completed', undefined, undefined
    );
    expect(generateTaskCompletionReply).not.toHaveBeenCalled();
  });

  it('should handle missing completion note gracefully', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          completion_note_block: {
            completion_note: { value: '' },
          },
          reply_in_thread_block: {
            reply_in_thread: {
              selected_options: [{ value: 'reply' }],
            },
          },
        },
      },
    };
    const body = { user: { id: 'U456' } };

    await viewHandler({ ack, view, body });

    expect(updateActionableStatus).toHaveBeenCalled();
    expect(generateTaskCompletionReply).toHaveBeenCalled();
  });

  it('should use messageTs as thread_ts when threadTs is missing', async () => {
    const metadataNoThread = { ...metadata, threadTs: undefined };
    const ack = vi.fn().mockResolvedValue(undefined);
    const view = {
      private_metadata: JSON.stringify(metadataNoThread),
      state: {
        values: {
          completion_note_block: {
            completion_note: { value: null },
          },
          reply_in_thread_block: {
            reply_in_thread: {
              selected_options: [{ value: 'reply' }],
            },
          },
        },
      },
    };
    const body = { user: { id: 'U456' } };

    await viewHandler({ ack, view, body });

    // The WebClient postMessage should be called with messageTs as thread_ts
    const mockClientInstance = vi.mocked(WebClient).mock.results[0]?.value;
    if (mockClientInstance) {
      expect(mockClientInstance.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: '100.200', // Falls back to messageTs
        })
      );
    }
  });
});
