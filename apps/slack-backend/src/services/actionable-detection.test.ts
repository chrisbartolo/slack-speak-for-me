import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../env.js', () => ({
  env: { ANTHROPIC_API_KEY: 'test-key', NODE_ENV: 'test' },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { detectActionable } from './actionable-detection.js';

function createMockResponse(json: object) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: JSON.stringify(json) }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

const baseContext = {
  workspaceId: 'W123',
  userId: 'U456',
  messageText: 'Can you review the pull request by Friday?',
  messageAuthorId: 'U789',
  currentDate: '2026-02-03',
};

describe('Actionable Detection Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect an action request with high confidence', async () => {
    mockCreate.mockResolvedValue(
      createMockResponse({
        hasActionable: true,
        actionable: {
          type: 'action_request',
          title: 'Review the pull request',
          description: 'Review PR by Friday',
          dueDate: '2026-02-07',
          dueDateConfidence: 'explicit',
          originalDueDateText: 'by Friday',
          confidenceScore: 90,
          reasoning: 'Clear request with deadline',
        },
      })
    );

    const result = await detectActionable(baseContext);

    expect(result.hasActionable).toBe(true);
    expect(result.actionable?.type).toBe('action_request');
    expect(result.actionable?.title).toBe('Review the pull request');
    expect(result.actionable?.confidenceScore).toBe(90);
  });

  it('should detect a commitment from the user', async () => {
    mockCreate.mockResolvedValue(
      createMockResponse({
        hasActionable: true,
        actionable: {
          type: 'commitment',
          title: 'Handle the deployment',
          description: 'User committed to handling deployment',
          dueDate: null,
          dueDateConfidence: null,
          originalDueDateText: null,
          confidenceScore: 85,
          reasoning: 'User explicitly committed',
        },
      })
    );

    const result = await detectActionable({
      ...baseContext,
      messageText: "I'll handle the deployment tomorrow",
      messageAuthorId: 'U456', // Same as userId - user's own message
    });

    expect(result.hasActionable).toBe(true);
    expect(result.actionable?.type).toBe('commitment');
  });

  it('should filter out low confidence results', async () => {
    mockCreate.mockResolvedValue(
      createMockResponse({
        hasActionable: true,
        actionable: {
          type: 'action_request',
          title: 'Maybe review something',
          description: 'Unclear request',
          dueDate: null,
          dueDateConfidence: null,
          originalDueDateText: null,
          confidenceScore: 30,
          reasoning: 'Very vague',
        },
      })
    );

    const result = await detectActionable(baseContext);

    expect(result.hasActionable).toBe(false);
    expect(result.actionable).toBeNull();
  });

  it('should return no actionable for non-actionable messages', async () => {
    mockCreate.mockResolvedValue(
      createMockResponse({
        hasActionable: false,
        actionable: null,
      })
    );

    const result = await detectActionable({
      ...baseContext,
      messageText: 'Thanks for the update, looks good!',
    });

    expect(result.hasActionable).toBe(false);
    expect(result.actionable).toBeNull();
  });

  it('should skip very short messages', async () => {
    const result = await detectActionable({
      ...baseContext,
      messageText: 'ok',
    });

    expect(result.hasActionable).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should handle JSON wrapped in markdown code blocks', async () => {
    mockCreate.mockResolvedValue({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '```json\n{"hasActionable": true, "actionable": {"type": "deadline", "title": "Submit report", "description": "Report due", "dueDate": "2026-02-05", "dueDateConfidence": "explicit", "originalDueDateText": "by Wednesday", "confidenceScore": 95, "reasoning": "Explicit deadline"}}\n```',
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await detectActionable(baseContext);

    expect(result.hasActionable).toBe(true);
    expect(result.actionable?.type).toBe('deadline');
  });

  it('should handle invalid JSON response gracefully', async () => {
    mockCreate.mockResolvedValue({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'I cannot determine actionables from this message.' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await detectActionable(baseContext);

    expect(result.hasActionable).toBe(false);
    expect(result.actionable).toBeNull();
  });

  it('should handle API errors gracefully', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limited'));

    const result = await detectActionable(baseContext);

    expect(result.hasActionable).toBe(false);
    expect(result.actionable).toBeNull();
  });

  it('should include thread context when provided', async () => {
    mockCreate.mockResolvedValue(
      createMockResponse({ hasActionable: false, actionable: null })
    );

    await detectActionable({
      ...baseContext,
      threadContext: 'U789: Can someone review this?\nU456: Sure, I can take a look',
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain('thread_context');
  });

  it('should include processing time in result', async () => {
    mockCreate.mockResolvedValue(
      createMockResponse({ hasActionable: false, actionable: null })
    );

    const result = await detectActionable(baseContext);

    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });
});
