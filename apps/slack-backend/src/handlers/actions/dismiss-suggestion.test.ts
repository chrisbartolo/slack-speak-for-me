import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@slack/bolt';
import { registerDismissSuggestionAction } from './dismiss-suggestion.js';

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Dismiss Suggestion Action', () => {
  let mockApp: Partial<App>;
  let actionHandler: Function;

  beforeEach(() => {
    vi.clearAllMocks();

    mockApp = {
      action: vi.fn((actionId: string, handler: Function) => {
        if (actionId === 'dismiss_suggestion') {
          actionHandler = handler;
        }
      }),
    };

    registerDismissSuggestionAction(mockApp as App);
  });

  it('should register handler for dismiss_suggestion action', () => {
    expect(mockApp.action).toHaveBeenCalledWith('dismiss_suggestion', expect.any(Function));
  });

  it('should call ack() to acknowledge action', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{ value: 'sug_123' }],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    expect(ack).toHaveBeenCalled();
  });

  it('should respond with delete_original: true', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{ value: 'sug_123' }],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'ephemeral',
        replace_original: true,
        delete_original: true,
        text: 'Suggestion dismissed.',
      })
    );
  });

  it('should log suggestion dismissal with user and suggestion ID', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{ value: 'sug_456' }],
      user: { id: 'U_DISMISS_USER' },
    };

    await actionHandler({ ack, body, respond });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestionId: 'sug_456',
        userId: 'U_DISMISS_USER',
      }),
      'Suggestion dismissed'
    );
  });

  it('should handle missing suggestion ID gracefully', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{}],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    // Should still log (with empty suggestionId) and respond
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestionId: '',
        userId: 'U123',
      }),
      'Suggestion dismissed'
    );
    expect(respond).toHaveBeenCalled();
  });

  it('should use empty string for user ID when user not in body', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{ value: 'sug_123' }],
      // No user field
    };

    await actionHandler({ ack, body, respond });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '',
      }),
      'Suggestion dismissed'
    );
  });

  it('should call respond after ack', async () => {
    const callOrder: string[] = [];
    const ack = vi.fn().mockImplementation(() => {
      callOrder.push('ack');
      return Promise.resolve();
    });
    const respond = vi.fn().mockImplementation(() => {
      callOrder.push('respond');
      return Promise.resolve();
    });
    const body = {
      actions: [{ value: 'sug_123' }],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    expect(callOrder).toEqual(['ack', 'respond']);
  });
});
