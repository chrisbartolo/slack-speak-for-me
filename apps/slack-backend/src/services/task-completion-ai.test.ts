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

vi.mock('./personalization/index.js', () => ({
  buildStyleContext: vi.fn().mockResolvedValue({
    promptText: '# Style Context\nCasual, friendly tone. Uses emoji occasionally.',
    learningPhase: 'personalized',
    usedHistory: true,
    sources: { hasExplicitPrefs: true, historyCount: 100, feedbackCount: 20 },
  }),
}));

import { generateTaskCompletionReply } from './task-completion-ai.js';
import { buildStyleContext } from './personalization/index.js';

function createMockResponse(text: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 30 },
  };
}

const baseContext = {
  workspaceId: 'W123',
  userId: 'U456',
  taskTitle: 'Review the pull request',
  taskDescription: 'Review PR #42 for the authentication feature',
  actionableType: 'action_request',
  originalMessageText: 'Hey, can you review PR #42 when you get a chance?',
};

describe('Task Completion AI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a reply without a completion note', async () => {
    mockCreate.mockResolvedValue(
      createMockResponse("Hey! All reviewed and approved, you're good to merge")
    );

    const result = await generateTaskCompletionReply(baseContext);

    expect(result.reply).toBe("Hey! All reviewed and approved, you're good to merge");
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(buildStyleContext).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'W123',
        userId: 'U456',
      })
    );
  });

  it('should generate a reply incorporating the completion note', async () => {
    mockCreate.mockResolvedValue(
      createMockResponse('Done! Left a few comments on the auth middleware but overall looks solid')
    );

    const result = await generateTaskCompletionReply({
      ...baseContext,
      completionNote: 'Left comments on auth middleware, looks good overall',
    });

    expect(result.reply).toContain('comments');
    // Verify the completion note was included in the prompt
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain('completion_note');
  });

  it('should include style context in system messages', async () => {
    mockCreate.mockResolvedValue(createMockResponse('Done!'));

    await generateTaskCompletionReply(baseContext);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toHaveLength(2); // Base prompt + style context
    expect(callArgs.system[1].text).toContain('Style Context');
  });

  it('should handle commitment type tasks', async () => {
    mockCreate.mockResolvedValue(
      createMockResponse('Got it done!')
    );

    await generateTaskCompletionReply({
      ...baseContext,
      actionableType: 'commitment',
      taskTitle: 'Deploy the hotfix',
      originalMessageText: "I'll deploy the hotfix after lunch",
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain('committed to doing something');
  });

  it('should handle deadline type tasks', async () => {
    mockCreate.mockResolvedValue(createMockResponse('Submitted!'));

    await generateTaskCompletionReply({
      ...baseContext,
      actionableType: 'deadline',
      taskTitle: 'Submit the report',
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain('deadline');
  });

  it('should handle API errors by throwing', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limited'));

    await expect(generateTaskCompletionReply(baseContext)).rejects.toThrow('API rate limited');
  });

  it('should skip style context if promptText is empty', async () => {
    vi.mocked(buildStyleContext).mockResolvedValueOnce({
      promptText: '',
      learningPhase: 'cold_start',
      usedHistory: false,
      sources: { hasExplicitPrefs: false, historyCount: 0, feedbackCount: 0 },
    });

    mockCreate.mockResolvedValue(createMockResponse('Done!'));

    await generateTaskCompletionReply(baseContext);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toHaveLength(1); // Only base prompt
  });
});
