import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@slack/bolt';
import { registerRefinementModalHandler } from './refinement-modal.js';

// Mock services and logger
vi.mock('../../services/index.js', () => ({
  refineSuggestion: vi.fn().mockResolvedValue({
    suggestion: 'Refined suggestion text',
    processingTimeMs: 500,
  }),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { refineSuggestion } from '../../services/index.js';

describe('Refinement Modal Handler', () => {
  let mockApp: Partial<App>;
  let viewHandler: Function;
  let mockViewsUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockViewsUpdate = vi.fn().mockResolvedValue({ ok: true, view: { id: 'V123' } });

    mockApp = {
      view: vi.fn((callbackId: string | RegExp | object, handler?: Function) => {
        const cbId = typeof callbackId === 'string' ? callbackId : '';
        const cb = typeof callbackId === 'function' ? callbackId : handler;
        if (cbId === 'refinement_modal' && cb) {
          viewHandler = cb;
        }
      }),
    };

    registerRefinementModalHandler(mockApp as App);
  });

  it('should register handler for refinement_modal callback', () => {
    expect(mockApp.view).toHaveBeenCalledWith('refinement_modal', expect.any(Function));
  });

  it('should parse private_metadata from view', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original suggestion',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it shorter' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    expect(refineSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        originalSuggestion: 'Original suggestion',
      })
    );
  });

  it('should get refinement text from input state', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it more formal' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    expect(refineSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        refinementRequest: 'Make it more formal',
      })
    );
  });

  it('should return error if refinement text empty', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: '' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    expect(ack).toHaveBeenCalledWith({
      response_action: 'errors',
      errors: {
        refinement_input: 'Please enter a refinement request',
      },
    });
    expect(refineSuggestion).not.toHaveBeenCalled();
  });

  it('should return error if refinement text is whitespace only', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: '   ' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    expect(ack).toHaveBeenCalledWith({
      response_action: 'errors',
      errors: {
        refinement_input: 'Please enter a refinement request',
      },
    });
    expect(refineSuggestion).not.toHaveBeenCalled();
  });

  it('should ack with loading state immediately', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it shorter' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    // First ack call should be the loading state
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        response_action: 'update',
        view: expect.objectContaining({
          title: expect.objectContaining({ text: 'Refining...' }),
          blocks: expect.arrayContaining([
            expect.objectContaining({
              text: expect.objectContaining({
                text: expect.stringContaining('Generating'),
              }),
            }),
          ]),
        }),
      })
    );
  });

  it('should call refineSuggestion with correct params', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original suggestion text',
      history: [{ suggestion: 'Previous', refinementRequest: 'First request' }],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it shorter' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    expect(refineSuggestion).toHaveBeenCalledWith({
      originalSuggestion: 'Original suggestion text',
      refinementRequest: 'Make it shorter',
      history: [{ suggestion: 'Previous', refinementRequest: 'First request' }],
    });
  });

  it('should update modal with refined suggestion', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it shorter' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    expect(mockViewsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        view_id: 'V123',
        view: expect.objectContaining({
          callback_id: 'refinement_modal',
          blocks: expect.arrayContaining([
            expect.objectContaining({
              text: expect.objectContaining({
                text: 'Refined suggestion text',
              }),
            }),
          ]),
        }),
      })
    );
  });

  it('should track history across refinement rounds', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Current suggestion',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it shorter' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    const updateCall = mockViewsUpdate.mock.calls[0][0];
    const updatedMetadata = JSON.parse(updateCall.view.private_metadata);

    expect(updatedMetadata.history).toEqual([
      {
        suggestion: 'Current suggestion',
        refinementRequest: 'Make it shorter',
      },
    ]);
    expect(updatedMetadata.currentSuggestion).toBe('Refined suggestion text');
  });

  it('should accumulate history with multiple rounds', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Second suggestion',
      history: [
        { suggestion: 'First suggestion', refinementRequest: 'Make it longer' },
      ],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Now make it formal' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    const updateCall = mockViewsUpdate.mock.calls[0][0];
    const updatedMetadata = JSON.parse(updateCall.view.private_metadata);

    expect(updatedMetadata.history).toEqual([
      { suggestion: 'First suggestion', refinementRequest: 'Make it longer' },
      { suggestion: 'Second suggestion', refinementRequest: 'Now make it formal' },
    ]);
  });

  it('should truncate history if approaching metadata limit', async () => {
    // Create a large history that would exceed limit
    const longSuggestion = 'A'.repeat(500);
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: longSuggestion,
      history: [
        { suggestion: longSuggestion, refinementRequest: 'req1' },
        { suggestion: longSuggestion, refinementRequest: 'req2' },
        { suggestion: longSuggestion, refinementRequest: 'req3' },
        { suggestion: longSuggestion, refinementRequest: 'req4' },
        { suggestion: longSuggestion, refinementRequest: 'req5' },
        { suggestion: longSuggestion, refinementRequest: 'req6' },
      ],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Another refinement' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    const updateCall = mockViewsUpdate.mock.calls[0][0];
    const updatedMetadata = JSON.parse(updateCall.view.private_metadata);

    // History should be truncated to stay under limit
    expect(JSON.stringify(updatedMetadata).length).toBeLessThanOrEqual(2800);
    // Oldest entries should have been removed
    expect(updatedMetadata.history.length).toBeLessThan(7);
  });

  it('should show error modal on refinement failure', async () => {
    const { logger } = await import('../../utils/logger.js');
    const mockRefineSuggestion = vi.mocked(refineSuggestion);
    mockRefineSuggestion.mockRejectedValueOnce(new Error('AI service error'));

    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it shorter' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Failed to generate refinement'
    );

    expect(mockViewsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        view: expect.objectContaining({
          title: expect.objectContaining({ text: 'Error' }),
          blocks: expect.arrayContaining([
            expect.objectContaining({
              text: expect.objectContaining({
                text: expect.stringContaining('Failed'),
              }),
            }),
          ]),
        }),
      })
    );
  });

  it('should include Copy Final button in refined view', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it shorter' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    const updateCall = mockViewsUpdate.mock.calls[0][0];
    const actionsBlock = updateCall.view.blocks.find(
      (block: any) => block.type === 'actions'
    );

    expect(actionsBlock).toBeDefined();
    const copyButton = actionsBlock.elements.find(
      (el: any) => el.action_id === 'copy_final_suggestion'
    );
    expect(copyButton).toBeDefined();
    expect(copyButton.style).toBe('primary');
  });

  it('should log refinement round number', async () => {
    const { logger } = await import('../../utils/logger.js');
    const metadata = {
      suggestionId: 'sug_789',
      currentSuggestion: 'Original',
      history: [
        { suggestion: 'First', refinementRequest: 'req1' },
        { suggestion: 'Second', refinementRequest: 'req2' },
      ],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Third refinement' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestionId: 'sug_789',
        roundNumber: 3, // history had 2 entries, this is round 3
      }),
      'Refinement generated'
    );
  });

  it('should handle empty private_metadata gracefully', async () => {
    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: '',
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it shorter' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    // Should still call refineSuggestion with parsed values (empty defaults)
    expect(refineSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        originalSuggestion: undefined,
        refinementRequest: 'Make it shorter',
        history: undefined,
      })
    );
  });

  it('should update modal with Refine More submit button after refinement', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original',
      history: [],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Make it shorter' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    expect(mockViewsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        view: expect.objectContaining({
          submit: expect.objectContaining({ text: 'Refine More' }),
        }),
      })
    );
  });

  it('should include round number in context element', async () => {
    const metadata = {
      suggestionId: 'sug_123',
      currentSuggestion: 'Original',
      history: [{ suggestion: 'First', refinementRequest: 'req1' }],
    };

    const ack = vi.fn().mockResolvedValue(undefined);
    const body = { view: { id: 'V123' } };
    const view = {
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          refinement_input: {
            refinement_text: { value: 'Second request' },
          },
        },
      },
    };
    const context = {
      client: {
        views: { update: mockViewsUpdate },
      },
    };

    await viewHandler({ ack, body, view, context });

    const updateCall = mockViewsUpdate.mock.calls[0][0];
    const contextBlock = updateCall.view.blocks.find(
      (block: any) => block.type === 'context'
    );

    expect(contextBlock.elements[0].text).toContain('Round 3');
  });
});
