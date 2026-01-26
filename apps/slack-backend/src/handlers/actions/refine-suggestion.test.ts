import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@slack/bolt';
import { registerRefineSuggestionAction } from './refine-suggestion.js';

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Refine Suggestion Action', () => {
  let mockApp: Partial<App>;
  let actionHandler: Function;
  let mockViewsOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockViewsOpen = vi.fn().mockResolvedValue({ ok: true, view: { id: 'V123' } });

    mockApp = {
      action: vi.fn((actionId: string, handler: Function) => {
        if (actionId === 'refine_suggestion') {
          actionHandler = handler;
        }
      }),
    };

    registerRefineSuggestionAction(mockApp as App);
  });

  it('should register handler for refine_suggestion action', () => {
    expect(mockApp.action).toHaveBeenCalledWith('refine_suggestion', expect.any(Function));
  });

  it('should call ack() to acknowledge action', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_123' }],
      message: {
        blocks: [
          { type: 'section', text: { text: 'Current suggestion' } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    expect(ack).toHaveBeenCalled();
  });

  it('should open views.open modal', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_123' }],
      message: {
        blocks: [
          { type: 'section', text: { text: 'Current suggestion' } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    expect(mockViewsOpen).toHaveBeenCalled();
  });

  it('should include current suggestion in modal private_metadata', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const suggestionText = 'This is the current suggestion text';
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_456' }],
      message: {
        blocks: [
          { type: 'section', text: { text: suggestionText } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    const viewsOpenCall = mockViewsOpen.mock.calls[0][0];
    const metadata = JSON.parse(viewsOpenCall.view.private_metadata);

    expect(metadata).toEqual({
      suggestionId: 'sug_456',
      currentSuggestion: suggestionText,
      history: [],
    });
  });

  it('should set callback_id to refinement_modal', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_123' }],
      message: {
        blocks: [
          { type: 'section', text: { text: 'Suggestion' } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    expect(mockViewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        view: expect.objectContaining({
          callback_id: 'refinement_modal',
        }),
      })
    );
  });

  it('should include refinement input block', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_123' }],
      message: {
        blocks: [
          { type: 'section', text: { text: 'Suggestion' } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    const viewsOpenCall = mockViewsOpen.mock.calls[0][0];
    const inputBlock = viewsOpenCall.view.blocks.find(
      (block: any) => block.type === 'input' && block.block_id === 'refinement_input'
    );

    expect(inputBlock).toBeDefined();
    expect(inputBlock.element.action_id).toBe('refinement_text');
    expect(inputBlock.element.multiline).toBe(true);
  });

  it('should use trigger_id from body', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'specific_trigger_789',
      actions: [{ value: 'sug_123' }],
      message: {
        blocks: [
          { type: 'section', text: { text: 'Suggestion' } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    expect(mockViewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_id: 'specific_trigger_789',
      })
    );
  });

  it('should log error when message blocks not found', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_123' }],
      // No message field
    };

    await actionHandler({ ack, body, context });

    expect(logger.error).toHaveBeenCalledWith('Message blocks not found for refine action');
    expect(mockViewsOpen).not.toHaveBeenCalled();
  });

  it('should log error when trigger_id not found', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      // No trigger_id
      actions: [{ value: 'sug_123' }],
      message: {
        blocks: [
          { type: 'section', text: { text: 'Suggestion' } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    expect(logger.error).toHaveBeenCalledWith('trigger_id not found in action body');
    expect(mockViewsOpen).not.toHaveBeenCalled();
  });

  it('should handle views.open failure gracefully', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    mockViewsOpen.mockRejectedValue(new Error('API error'));
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_123' }],
      message: {
        blocks: [
          { type: 'section', text: { text: 'Suggestion' } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Failed to open refinement modal'
    );
  });

  it('should log info when modal opened successfully', async () => {
    const { logger } = await import('../../utils/logger.js');
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_abc' }],
      message: {
        blocks: [
          { type: 'section', text: { text: 'Suggestion' } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    expect(logger.info).toHaveBeenCalledWith(
      { suggestionId: 'sug_abc' },
      'Refinement modal opened'
    );
  });

  it('should display modal with correct title and buttons', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_123' }],
      message: {
        blocks: [
          { type: 'section', text: { text: 'Suggestion' } },
        ],
      },
    };

    await actionHandler({ ack, body, context });

    expect(mockViewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        view: expect.objectContaining({
          type: 'modal',
          title: expect.objectContaining({ text: 'Refine Suggestion' }),
          submit: expect.objectContaining({ text: 'Refine' }),
          close: expect.objectContaining({ text: 'Cancel' }),
        }),
      })
    );
  });

  it('should handle missing suggestion text with fallback', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const context = {
      client: {
        views: { open: mockViewsOpen },
      },
    };
    const body = {
      trigger_id: 'trigger_123',
      actions: [{ value: 'sug_123' }],
      message: {
        blocks: [
          { type: 'header', text: { text: 'Header' } },
          // No section with text
        ],
      },
    };

    await actionHandler({ ack, body, context });

    const viewsOpenCall = mockViewsOpen.mock.calls[0][0];
    const metadata = JSON.parse(viewsOpenCall.view.private_metadata);

    expect(metadata.currentSuggestion).toBe('');
  });
});
