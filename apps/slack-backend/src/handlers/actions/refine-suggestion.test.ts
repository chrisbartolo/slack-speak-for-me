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

// Mock getWorkspaceId
vi.mock('../../services/watch.js', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue('workspace_123'),
}));

import { logger } from '../../utils/logger.js';
import { getWorkspaceId } from '../../services/watch.js';

describe('Refine Suggestion Action', () => {
  let mockApp: Partial<App>;
  let actionHandler: Function;
  let mockViewsOpen: ReturnType<typeof vi.fn>;

  const createActionPayload = (overrides: Record<string, any> = {}) => {
    const suggestion = overrides.suggestion ?? 'This is the current suggestion text';
    const suggestionId = overrides.suggestionId ?? 'sug_123';

    return {
      ack: vi.fn().mockResolvedValue(undefined),
      client: {
        views: { open: mockViewsOpen },
      },
      body: {
        trigger_id: overrides.trigger_id ?? 'trigger_123',
        team: overrides.team ?? { id: 'T123' },
        user: overrides.user ?? { id: 'U456' },
        channel: overrides.channel ?? { id: 'C789' },
        actions: [{ value: JSON.stringify({ suggestionId, suggestion }) }],
        ...overrides.bodyOverrides,
      },
    };
  };

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
    const payload = createActionPayload();

    await actionHandler(payload);

    expect(payload.ack).toHaveBeenCalled();
  });

  it('should look up workspace ID from team ID', async () => {
    const payload = createActionPayload({ team: { id: 'T_MY_TEAM' } });

    await actionHandler(payload);

    expect(getWorkspaceId).toHaveBeenCalledWith('T_MY_TEAM');
  });

  it('should open views.open modal', async () => {
    const payload = createActionPayload();

    await actionHandler(payload);

    expect(mockViewsOpen).toHaveBeenCalled();
  });

  it('should include current suggestion in modal private_metadata', async () => {
    const suggestionText = 'This is the current suggestion text';
    const payload = createActionPayload({
      suggestionId: 'sug_456',
      suggestion: suggestionText,
    });

    await actionHandler(payload);

    const viewsOpenCall = mockViewsOpen.mock.calls[0][0];
    const metadata = JSON.parse(viewsOpenCall.view.private_metadata);

    expect(metadata).toMatchObject({
      workspaceId: 'workspace_123',
      userId: 'U456',
      suggestionId: 'sug_456',
      currentSuggestion: suggestionText,
      history: [],
    });
  });

  it('should set callback_id to refinement_modal', async () => {
    const payload = createActionPayload();

    await actionHandler(payload);

    expect(mockViewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        view: expect.objectContaining({
          callback_id: 'refinement_modal',
        }),
      })
    );
  });

  it('should include refinement input block', async () => {
    const payload = createActionPayload();

    await actionHandler(payload);

    const viewsOpenCall = mockViewsOpen.mock.calls[0][0];
    const inputBlock = viewsOpenCall.view.blocks.find(
      (block: any) => block.type === 'input' && block.block_id === 'refinement_input'
    );

    expect(inputBlock).toBeDefined();
    expect(inputBlock.element.action_id).toBe('refinement_text');
    expect(inputBlock.element.multiline).toBe(true);
  });

  it('should use trigger_id from body', async () => {
    const payload = createActionPayload({ trigger_id: 'specific_trigger_789' });

    await actionHandler(payload);

    expect(mockViewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_id: 'specific_trigger_789',
      })
    );
  });

  it('should log error when action value cannot be parsed', async () => {
    const payload = {
      ack: vi.fn().mockResolvedValue(undefined),
      client: { views: { open: mockViewsOpen } },
      body: {
        trigger_id: 'trigger_123',
        team: { id: 'T123' },
        user: { id: 'U456' },
        actions: [{ value: 'not valid json' }],
      },
    };

    await actionHandler(payload);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ actionValue: 'not valid json' }),
      'Failed to parse refine action value'
    );
    expect(mockViewsOpen).not.toHaveBeenCalled();
  });

  it('should log error when suggestion is missing', async () => {
    const payload = {
      ack: vi.fn().mockResolvedValue(undefined),
      client: { views: { open: mockViewsOpen } },
      body: {
        trigger_id: 'trigger_123',
        team: { id: 'T123' },
        user: { id: 'U456' },
        actions: [{ value: JSON.stringify({ suggestionId: 'sug_123' }) }],
      },
    };

    await actionHandler(payload);

    expect(logger.error).toHaveBeenCalledWith('No suggestion in refine action value');
    expect(mockViewsOpen).not.toHaveBeenCalled();
  });

  it('should log error when trigger_id not found', async () => {
    const payload = {
      ack: vi.fn().mockResolvedValue(undefined),
      client: { views: { open: mockViewsOpen } },
      body: {
        // No trigger_id
        team: { id: 'T123' },
        user: { id: 'U456' },
        actions: [{ value: JSON.stringify({ suggestionId: 'sug_123', suggestion: 'Test' }) }],
      },
    };

    await actionHandler(payload);

    expect(logger.error).toHaveBeenCalledWith('trigger_id not found in action body');
    expect(mockViewsOpen).not.toHaveBeenCalled();
  });

  it('should log error when workspace not found', async () => {
    vi.mocked(getWorkspaceId).mockResolvedValueOnce(null);
    const payload = createActionPayload({ team: { id: 'T_UNKNOWN' } });

    await actionHandler(payload);

    expect(logger.error).toHaveBeenCalledWith(
      { teamId: 'T_UNKNOWN' },
      'Workspace not found for refine action'
    );
    expect(mockViewsOpen).not.toHaveBeenCalled();
  });

  it('should handle views.open failure gracefully', async () => {
    mockViewsOpen.mockRejectedValueOnce(new Error('API error'));
    const payload = createActionPayload();

    await actionHandler(payload);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'API error' }),
      'Failed to open refinement modal'
    );
  });

  it('should log info when modal opened successfully', async () => {
    const payload = createActionPayload({ suggestionId: 'sug_abc' });

    await actionHandler(payload);

    expect(logger.info).toHaveBeenCalledWith(
      { suggestionId: 'sug_abc' },
      'Refinement modal opened'
    );
  });

  it('should display modal with correct title and buttons', async () => {
    const payload = createActionPayload();

    await actionHandler(payload);

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

  it('should truncate very long suggestions in metadata', async () => {
    const longSuggestion = 'A'.repeat(3000);
    const payload = createActionPayload({ suggestion: longSuggestion });

    await actionHandler(payload);

    const viewsOpenCall = mockViewsOpen.mock.calls[0][0];
    const metadata = JSON.parse(viewsOpenCall.view.private_metadata);

    // Should be truncated to 2500 chars + '...'
    expect(metadata.currentSuggestion.length).toBeLessThanOrEqual(2503);
    expect(metadata.currentSuggestion.endsWith('...')).toBe(true);
  });
});
