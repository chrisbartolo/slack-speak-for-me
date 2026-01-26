import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@slack/bolt';
import { registerCopySuggestionAction } from './copy-suggestion.js';

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Copy Suggestion Action', () => {
  let mockApp: Partial<App>;
  let actionHandler: Function;

  beforeEach(() => {
    vi.clearAllMocks();

    mockApp = {
      action: vi.fn((actionId: string, handler: Function) => {
        if (actionId === 'copy_suggestion') {
          actionHandler = handler;
        }
      }),
    };

    registerCopySuggestionAction(mockApp as App);
  });

  it('should register handler for copy_suggestion action', () => {
    expect(mockApp.action).toHaveBeenCalledWith('copy_suggestion', expect.any(Function));
  });

  it('should call ack() to acknowledge action', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{ value: JSON.stringify({ suggestionId: 'sug_123', suggestion: 'Test suggestion' }) }],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    expect(ack).toHaveBeenCalled();
  });

  it('should respond with suggestion in code block format', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const suggestionText = 'This is the test suggestion text';
    const body = {
      actions: [{ value: JSON.stringify({ suggestionId: 'sug_123', suggestion: suggestionText }) }],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        response_type: 'ephemeral',
        replace_original: true,
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('```'),
            }),
          }),
        ]),
      })
    );
  });

  it('should include triple-click copy instructions', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{ value: JSON.stringify({ suggestionId: 'sug_123', suggestion: 'Test' }) }],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'context',
            elements: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('Triple-click'),
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('should include original suggestion text in code block', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const suggestionText = 'My original suggestion text here';
    const body = {
      actions: [{ value: JSON.stringify({ suggestionId: 'sug_123', suggestion: suggestionText }) }],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    const respondCall = respond.mock.calls[0][0];
    const sectionBlock = respondCall.blocks.find(
      (block: any) => block.type === 'section' && block.text?.text?.includes('```')
    );

    expect(sectionBlock.text.text).toContain(suggestionText);
  });

  it('should include dismiss button in response', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{ value: JSON.stringify({ suggestionId: 'sug_123', suggestion: 'Test' }) }],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'actions',
            elements: expect.arrayContaining([
              expect.objectContaining({
                action_id: 'dismiss_suggestion',
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('should log warning if action value is missing', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{}],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ body }),
      'Copy action missing value'
    );
    expect(respond).not.toHaveBeenCalled();
  });

  it('should handle JSON parse errors gracefully', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{ value: 'invalid-json' }],
      user: { id: 'U123' },
    };

    await actionHandler({ ack, body, respond });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error handling copy action'
    );
  });

  it('should extract user ID from body when available', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn().mockResolvedValue(undefined);
    const body = {
      actions: [{ value: JSON.stringify({ suggestionId: 'sug_123', suggestion: 'Test' }) }],
      user: { id: 'U_TEST_USER' },
    };

    await actionHandler({ ack, body, respond });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestionId: 'sug_123',
        userId: 'U_TEST_USER',
      }),
      'Copy button clicked'
    );
  });
});
