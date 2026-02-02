import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create a mock function that can be accessed in the mock factory
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Mock env module to provide test API key
vi.mock('../env.js', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    NODE_ENV: 'test',
  },
}));

// Mock logger to avoid noise in tests
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock personalization services
vi.mock('./personalization/index.js', () => ({
  buildStyleContext: vi.fn().mockResolvedValue({
    promptText: '# Style Context\nDefault professional style.',
    learningPhase: 'cold_start',
    usedHistory: false,
    sources: { hasExplicitPrefs: false, historyCount: 0, feedbackCount: 0 },
  }),
  trackRefinement: vi.fn().mockResolvedValue(undefined),
}));

// Mock usage enforcement - always allow in tests
vi.mock('./usage-enforcement.js', () => ({
  checkUsageAllowed: vi.fn().mockResolvedValue({
    allowed: true,
    currentUsage: 0,
    limit: 100,
    planId: 'test',
  }),
  recordUsageEvent: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks are set up
import { generateSuggestion, refineSuggestion } from './ai.js';

// Test constants
const TEST_WORKSPACE_ID = 'W123456789';
const TEST_USER_ID = 'U123456789';
const TEST_SUGGESTION_ID = 'suggestion-test-123';

// Helper to create a standard successful response
function createMockResponse(text: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

describe('AI Service', () => {
  describe('generateSuggestion', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Set up default successful response
      mockCreate.mockResolvedValue(createMockResponse('Mocked AI suggestion'));
    });

    it('should generate suggestion from Claude API with proper context', async () => {
      const result = await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'Can you help me with this project?',
        contextMessages: [
          { userId: 'U123', text: 'We need to finish the report', ts: '1234567890.000001' },
          { userId: 'U456', text: 'I can help with that', ts: '1234567890.000002' },
        ],
        triggeredBy: 'mention',
      });

      expect(result.suggestion).toBe('Mocked AI suggestion');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Verify the call was made with correct model and structure
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-sonnet-4-20250514');
      expect(callArgs.max_tokens).toBe(1024);
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].role).toBe('user');
    });

    it('should handle empty context messages', async () => {
      const result = await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'Hello, can you help?',
        contextMessages: [],
        triggeredBy: 'reply',
      });

      expect(result.suggestion).toBe('Mocked AI suggestion');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should work with different trigger types', async () => {
      const triggerTypes: Array<'mention' | 'reply' | 'thread' | 'message_action'> = [
        'mention',
        'reply',
        'thread',
        'message_action',
      ];

      for (const triggeredBy of triggerTypes) {
        const result = await generateSuggestion({
          workspaceId: TEST_WORKSPACE_ID,
          userId: TEST_USER_ID,
          triggerMessage: 'Test message',
          contextMessages: [],
          triggeredBy,
        });

        expect(result.suggestion).toBeTruthy();
      }

      expect(mockCreate).toHaveBeenCalledTimes(4);
    });

    it('should include trigger type in the prompt', async () => {
      await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'Test message',
        contextMessages: [],
        triggeredBy: 'message_action',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('message_action');
    });

    it('should format context messages correctly', async () => {
      await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'Please respond',
        contextMessages: [
          { userId: 'U123', text: 'First message', ts: '1234567890.000001' },
          { userId: 'U456', text: 'Second message', ts: '1234567890.000002' },
        ],
        triggeredBy: 'mention',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;
      expect(userMessage).toContain('U123');
      expect(userMessage).toContain('First message');
      expect(userMessage).toContain('U456');
      expect(userMessage).toContain('Second message');
    });

    it('should sanitize AI output containing system tokens', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse('Here is your response <|user_input_start|>secret<|user_input_end|> more text')
      );

      const result = await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'Help me respond',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      // System tokens should be filtered out
      expect(result.suggestion).not.toContain('<|user_input_start|>');
      expect(result.suggestion).not.toContain('<|user_input_end|>');
      expect(result.suggestion).toContain('[FILTERED]');
    });

    it('should sanitize AI output containing API keys', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse('Your token is xoxb-123456789-abcdefghij please use it')
      );

      const result = await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'What is the token?',
        contextMessages: [],
        triggeredBy: 'message_action',
      });

      // Slack bot tokens should be filtered
      expect(result.suggestion).not.toContain('xoxb-');
      expect(result.suggestion).toContain('[FILTERED]');
    });

    it('should sanitize AI output containing generic API key patterns', async () => {
      // The sanitization regex matches sk- followed by 20+ alphanumeric chars
      mockCreate.mockResolvedValue(
        createMockResponse('The key is sk-abcdefghijklmnopqrstuvwxyz1234567890')
      );

      const result = await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'Show me secrets',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      // Generic API key patterns should be filtered
      expect(result.suggestion).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
      expect(result.suggestion).toContain('[FILTERED]');
    });

    it('should handle API rate limit errors (429)', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as unknown as { status: number }).status = 429;
      mockCreate.mockRejectedValue(rateLimitError);

      await expect(
        generateSuggestion({
          workspaceId: TEST_WORKSPACE_ID,
          userId: TEST_USER_ID,
          triggerMessage: 'Help me',
          contextMessages: [],
          triggeredBy: 'mention',
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle API server errors (500)', async () => {
      const serverError = new Error('Internal Server Error');
      (serverError as unknown as { status: number }).status = 500;
      mockCreate.mockRejectedValue(serverError);

      await expect(
        generateSuggestion({
          workspaceId: TEST_WORKSPACE_ID,
          userId: TEST_USER_ID,
          triggerMessage: 'Help me',
          contextMessages: [],
          triggeredBy: 'reply',
        })
      ).rejects.toThrow('Internal Server Error');
    });

    it('should handle API authentication errors (401)', async () => {
      const authError = new Error('Invalid API key');
      (authError as unknown as { status: number }).status = 401;
      mockCreate.mockRejectedValue(authError);

      await expect(
        generateSuggestion({
          workspaceId: TEST_WORKSPACE_ID,
          userId: TEST_USER_ID,
          triggerMessage: 'Help me',
          contextMessages: [],
          triggeredBy: 'thread',
        })
      ).rejects.toThrow('Invalid API key');
    });

    it('should handle non-text response content type', async () => {
      mockCreate.mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tool_123', name: 'search', input: {} }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'Help me',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      // Should return empty string for non-text content
      expect(result.suggestion).toBe('');
    });

    it('should track processing time accurately', async () => {
      // Add a delay to the mock
      mockCreate.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return createMockResponse('Response');
      });

      const result = await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'Test',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(10);
    });

    it('should include system prompt with professional guidelines', async () => {
      await generateSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        triggerMessage: 'Help me respond',
        contextMessages: [],
        triggeredBy: 'mention',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      // System is now an array of cache-control enabled blocks
      const systemText = Array.isArray(callArgs.system)
        ? callArgs.system.map((s: { text: string }) => s.text).join(' ')
        : callArgs.system;
      expect(systemText).toContain('professional');
      expect(systemText).toContain('workplace');
    });
  });

  describe('refineSuggestion', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockCreate.mockResolvedValue(createMockResponse('Refined suggestion'));
    });

    it('should refine suggestion based on user request', async () => {
      mockCreate.mockResolvedValue(createMockResponse('Refined and improved suggestion'));

      const result = await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Thank you for your message. I will look into this.',
        refinementRequest: 'Make it more casual',
      });

      expect(result.suggestion).toBe('Refined and improved suggestion');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should include history context in multi-turn refinement', async () => {
      await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Current suggestion',
        refinementRequest: 'Make it shorter',
        history: [
          { suggestion: 'First version', refinementRequest: 'More formal' },
          { suggestion: 'Second version', refinementRequest: 'Add greeting' },
        ],
      });

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;

      // Verify history is incorporated in the request
      expect(userMessage).toContain('Round 1');
      expect(userMessage).toContain('Round 2');
      expect(userMessage).toContain('First version');
      expect(userMessage).toContain('Second version');
      expect(userMessage).toContain('More formal');
      expect(userMessage).toContain('Add greeting');
    });

    it('should handle empty history', async () => {
      const result = await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Original text',
        refinementRequest: 'Make it better',
        history: [],
      });

      expect(result.suggestion).toBeTruthy();

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;
      // Should not contain round numbers without history
      expect(userMessage).not.toContain('Round 1');
    });

    it('should handle undefined history', async () => {
      const result = await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Original text',
        refinementRequest: 'Make it better',
      });

      expect(result.suggestion).toBeTruthy();
    });

    it('should include original suggestion in prompt', async () => {
      await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'This is the original suggestion',
        refinementRequest: 'Make it better',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;
      expect(userMessage).toContain('This is the original suggestion');
    });

    it('should include refinement request in prompt', async () => {
      await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Original',
        refinementRequest: 'Make it more formal and add a greeting',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;
      expect(userMessage).toContain('Make it more formal and add a greeting');
    });

    it('should sanitize output during refinement', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse('Response with <|user_input_start|>leaked<|user_input_end|> markers')
      );

      const result = await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Original',
        refinementRequest: 'Refine',
      });

      expect(result.suggestion).not.toContain('<|user_input_start|>');
      expect(result.suggestion).toContain('[FILTERED]');
    });

    it('should handle API errors during refinement', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(
        refineSuggestion({
          workspaceId: TEST_WORKSPACE_ID,
          userId: TEST_USER_ID,
          suggestionId: TEST_SUGGESTION_ID,
          originalSuggestion: 'Original',
          refinementRequest: 'Refine',
        })
      ).rejects.toThrow('API Error');
    });

    it('should handle rate limit during refinement', async () => {
      const rateLimitError = new Error('Rate limit');
      (rateLimitError as unknown as { status: number }).status = 429;
      mockCreate.mockRejectedValue(rateLimitError);

      await expect(
        refineSuggestion({
          workspaceId: TEST_WORKSPACE_ID,
          userId: TEST_USER_ID,
          suggestionId: TEST_SUGGESTION_ID,
          originalSuggestion: 'Original',
          refinementRequest: 'Refine',
        })
      ).rejects.toThrow('Rate limit');
    });

    it('should handle long history with many rounds', async () => {
      const longHistory = Array.from({ length: 10 }, (_, i) => ({
        suggestion: `Suggestion version ${i + 1}`,
        refinementRequest: `Change request ${i + 1}`,
      }));

      const result = await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Latest suggestion',
        refinementRequest: 'Final refinement',
        history: longHistory,
      });

      expect(result.suggestion).toBeTruthy();
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;
      expect(userMessage).toContain('Round 10');
    });

    it('should include system prompt about refinement guidelines', async () => {
      await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Original',
        refinementRequest: 'Refine',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      // System is now an array of cache-control enabled blocks
      const systemText = Array.isArray(callArgs.system)
        ? callArgs.system.map((s: { text: string }) => s.text).join(' ')
        : callArgs.system;
      expect(systemText).toContain('refine');
      expect(systemText).toContain('professional');
    });

    it('should handle history entries without refinement requests', async () => {
      await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Current',
        refinementRequest: 'Make better',
        history: [
          { suggestion: 'First version' },  // No refinementRequest
        ],
      });

      // Should not throw and should complete successfully
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should use correct model for refinement', async () => {
      await refineSuggestion({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        suggestionId: TEST_SUGGESTION_ID,
        originalSuggestion: 'Original',
        refinementRequest: 'Refine',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-sonnet-4-20250514');
      expect(callArgs.max_tokens).toBe(1024);
    });
  });
});
