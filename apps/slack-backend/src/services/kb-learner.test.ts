import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted for all mocks
const { mockCreate, mockExecute, mockReturning, mockSet, mockWhere } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockExecute: vi.fn(),
  mockReturning: vi.fn(),
  mockSet: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate }
  }))
}));

vi.mock('../env.js', () => ({
  env: { ANTHROPIC_API_KEY: 'test-key', NODE_ENV: 'test' }
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Mock database - use vi.hoisted mocks
vi.mock('@slack-speak/database', () => ({
  db: {
    execute: mockExecute,
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: mockSet,
    })),
  },
  kbCandidates: {
    id: 'id',
    organizationId: 'organization_id',
    status: 'status',
    acceptanceCount: 'acceptance_count',
    uniqueUsersCount: 'unique_users_count',
    qualityScore: 'quality_score',
    lastSeenAt: 'last_seen_at',
    updatedAt: 'updated_at',
  },
  eq: vi.fn((field, value) => ({ field, value, type: 'eq' })),
}));

// Import after mocks
import { evaluateForKnowledge, calculateQualityScore, createOrUpdateCandidate } from './kb-learner.js';
import { logger } from '../utils/logger.js';

describe('kb-learner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('evaluateForKnowledge', () => {
    it('returns shouldCreate=true with valid fields when Claude says create', async () => {
      mockCreate.mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: JSON.stringify({
            shouldCreate: true,
            title: 'De-escalation technique',
            category: 'de_escalation',
            excerpt: 'I understand your concerns and would like to help address them',
            reasoning: 'Contains reusable de-escalation pattern',
          }),
        }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await evaluateForKnowledge({
        suggestionText: 'I understand your concerns',
        triggerContext: 'angry customer complaint',
        organizationId: 'org-123',
      });

      expect(result.shouldCreate).toBe(true);
      expect(result.title).toBe('De-escalation technique');
      expect(result.category).toBe('de_escalation');
      expect(result.excerpt).toBe('I understand your concerns and would like to help address them');
      expect(result.reasoning).toBe('Contains reusable de-escalation pattern');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('returns shouldCreate=false when Claude says skip', async () => {
      mockCreate.mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: JSON.stringify({
            shouldCreate: false,
            reasoning: 'Too specific to this conversation',
          }),
        }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await evaluateForKnowledge({
        suggestionText: 'I will send it at 3pm on Tuesday',
        triggerContext: 'scheduling request',
        organizationId: 'org-123',
      });

      expect(result.shouldCreate).toBe(false);
      expect(result.reasoning).toBe('Too specific to this conversation');
      expect(result.title).toBeUndefined();
      expect(result.category).toBeUndefined();
      expect(result.excerpt).toBeUndefined();
    });

    it('returns fallback on API timeout', async () => {
      const abortError = new Error('Request aborted');
      (abortError as any).name = 'AbortError';
      mockCreate.mockRejectedValue(abortError);

      const result = await evaluateForKnowledge({
        suggestionText: 'Test suggestion',
        triggerContext: 'test context',
        organizationId: 'org-123',
      });

      expect(result.shouldCreate).toBe(false);
      expect(result.reasoning).toBe('evaluation_failed');
      expect(logger.warn).toHaveBeenCalledWith(
        { timeoutMs: 5000 },
        'KB evaluation timed out, using fallback'
      );
    });

    it('returns fallback on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API connection failed'));

      const result = await evaluateForKnowledge({
        suggestionText: 'Test suggestion',
        triggerContext: 'test context',
        organizationId: 'org-123',
      });

      expect(result.shouldCreate).toBe(false);
      expect(result.reasoning).toBe('evaluation_failed');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
        }),
        'KB evaluation failed, using fallback'
      );
    });

    it('returns fallback on invalid JSON', async () => {
      mockCreate.mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'This is not valid JSON at all',
        }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await evaluateForKnowledge({
        suggestionText: 'Test suggestion',
        triggerContext: 'test context',
        organizationId: 'org-123',
      });

      expect(result.shouldCreate).toBe(false);
      expect(result.reasoning).toBe('evaluation_failed');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('returns fallback when shouldCreate=true but missing title', async () => {
      mockCreate.mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: JSON.stringify({
            shouldCreate: true,
            // title missing
            category: 'de_escalation',
            excerpt: 'Some text',
            reasoning: 'Has pattern',
          }),
        }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await evaluateForKnowledge({
        suggestionText: 'Test suggestion',
        triggerContext: 'test context',
        organizationId: 'org-123',
      });

      expect(result.shouldCreate).toBe(false);
      expect(result.reasoning).toBe('evaluation_failed');
      expect(logger.warn).toHaveBeenCalledWith(
        { parsedTitle: undefined },
        'Invalid title for shouldCreate=true, using fallback'
      );
    });

    it('returns fallback on invalid category', async () => {
      mockCreate.mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: JSON.stringify({
            shouldCreate: true,
            title: 'Test title',
            category: 'invalid_category',
            excerpt: 'Some text',
            reasoning: 'Has pattern',
          }),
        }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await evaluateForKnowledge({
        suggestionText: 'Test suggestion',
        triggerContext: 'test context',
        organizationId: 'org-123',
      });

      expect(result.shouldCreate).toBe(false);
      expect(result.reasoning).toBe('evaluation_failed');
      expect(logger.warn).toHaveBeenCalledWith(
        { parsedCategory: 'invalid_category' },
        'Invalid category value, using fallback'
      );
    });

    it('returns fallback when shouldCreate=true but missing excerpt', async () => {
      mockCreate.mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: JSON.stringify({
            shouldCreate: true,
            title: 'Test title',
            category: 'de_escalation',
            excerpt: '',
            reasoning: 'Has pattern',
          }),
        }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await evaluateForKnowledge({
        suggestionText: 'Test suggestion',
        triggerContext: 'test context',
        organizationId: 'org-123',
      });

      expect(result.shouldCreate).toBe(false);
      expect(result.reasoning).toBe('evaluation_failed');
      expect(logger.warn).toHaveBeenCalledWith(
        { parsedExcerpt: '' },
        'Invalid excerpt for shouldCreate=true, using fallback'
      );
    });

    it('validates shouldCreate is boolean', async () => {
      mockCreate.mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: JSON.stringify({
            shouldCreate: 'true', // string instead of boolean
            reasoning: 'Has pattern',
          }),
        }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await evaluateForKnowledge({
        suggestionText: 'Test suggestion',
        triggerContext: 'test context',
        organizationId: 'org-123',
      });

      expect(result.shouldCreate).toBe(false);
      expect(result.reasoning).toBe('evaluation_failed');
      expect(logger.warn).toHaveBeenCalledWith(
        { parsedShouldCreate: 'true' },
        'Invalid shouldCreate value, using fallback'
      );
    });
  });

  describe('calculateQualityScore', () => {
    it('returns low score for all-zero inputs', async () => {
      const score = calculateQualityScore({
        acceptanceCount: 0,
        avgSimilarity: 0,
        uniqueUsersCount: 0,
        daysSinceCreation: 31,
      });

      // acceptance: 0/10 * 0.4 = 0
      // similarity: 0/100 * 0.3 = 0
      // diversity: 0/5 * 0.2 = 0
      // recency: max(0, 1 - 31/30) * 0.1 = 0
      // total: 0 * 100 = 0
      expect(score).toBe(0);
    });

    it('returns 100 for perfect inputs', async () => {
      const score = calculateQualityScore({
        acceptanceCount: 10,
        avgSimilarity: 100,
        uniqueUsersCount: 5,
        daysSinceCreation: 0,
      });

      // acceptance: 10/10 * 0.4 = 0.4
      // similarity: 100/100 * 0.3 = 0.3
      // diversity: 5/5 * 0.2 = 0.2
      // recency: (1 - 0/30) * 0.1 = 0.1
      // total: 1.0 * 100 = 100
      expect(score).toBe(100);
    });

    it('caps acceptance at 10', async () => {
      const scoreWith10 = calculateQualityScore({
        acceptanceCount: 10,
        avgSimilarity: 100,
        uniqueUsersCount: 5,
        daysSinceCreation: 0,
      });

      const scoreWith100 = calculateQualityScore({
        acceptanceCount: 100,
        avgSimilarity: 100,
        uniqueUsersCount: 5,
        daysSinceCreation: 0,
      });

      expect(scoreWith10).toBe(scoreWith100);
      expect(scoreWith100).toBe(100);
    });

    it('caps diversity at 5 users', async () => {
      const scoreWith5 = calculateQualityScore({
        acceptanceCount: 10,
        avgSimilarity: 100,
        uniqueUsersCount: 5,
        daysSinceCreation: 0,
      });

      const scoreWith50 = calculateQualityScore({
        acceptanceCount: 10,
        avgSimilarity: 100,
        uniqueUsersCount: 50,
        daysSinceCreation: 0,
      });

      expect(scoreWith5).toBe(scoreWith50);
      expect(scoreWith50).toBe(100);
    });

    it('recency decays over 30 days', async () => {
      const scoreDay0 = calculateQualityScore({
        acceptanceCount: 5,
        avgSimilarity: 50,
        uniqueUsersCount: 3,
        daysSinceCreation: 0,
      });

      const scoreDay15 = calculateQualityScore({
        acceptanceCount: 5,
        avgSimilarity: 50,
        uniqueUsersCount: 3,
        daysSinceCreation: 15,
      });

      const scoreDay30 = calculateQualityScore({
        acceptanceCount: 5,
        avgSimilarity: 50,
        uniqueUsersCount: 3,
        daysSinceCreation: 30,
      });

      // Score should decrease as days increase
      expect(scoreDay0).toBeGreaterThan(scoreDay15);
      expect(scoreDay15).toBeGreaterThan(scoreDay30);
    });

    it('recency floors at 0', async () => {
      const scoreDay30 = calculateQualityScore({
        acceptanceCount: 5,
        avgSimilarity: 50,
        uniqueUsersCount: 3,
        daysSinceCreation: 30,
      });

      const scoreDay60 = calculateQualityScore({
        acceptanceCount: 5,
        avgSimilarity: 50,
        uniqueUsersCount: 3,
        daysSinceCreation: 60,
      });

      // Both should have 0 recency contribution
      expect(scoreDay30).toBe(scoreDay60);
    });

    it('returns integer', async () => {
      const score = calculateQualityScore({
        acceptanceCount: 3,
        avgSimilarity: 57,
        uniqueUsersCount: 2,
        daysSinceCreation: 13,
      });

      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('correct weight distribution', async () => {
      // Test each component individually by maximizing one and zeroing others
      const acceptanceOnly = calculateQualityScore({
        acceptanceCount: 10,
        avgSimilarity: 0,
        uniqueUsersCount: 0,
        daysSinceCreation: 31, // beyond recency window
      });
      expect(acceptanceOnly).toBe(40); // 40% weight

      const similarityOnly = calculateQualityScore({
        acceptanceCount: 0,
        avgSimilarity: 100,
        uniqueUsersCount: 0,
        daysSinceCreation: 31,
      });
      expect(similarityOnly).toBe(30); // 30% weight

      const diversityOnly = calculateQualityScore({
        acceptanceCount: 0,
        avgSimilarity: 0,
        uniqueUsersCount: 5,
        daysSinceCreation: 31,
      });
      expect(diversityOnly).toBe(20); // 20% weight

      const recencyOnly = calculateQualityScore({
        acceptanceCount: 0,
        avgSimilarity: 0,
        uniqueUsersCount: 0,
        daysSinceCreation: 0,
      });
      expect(recencyOnly).toBe(10); // 10% weight
    });
  });

  describe('createOrUpdateCandidate', () => {
    it('creates new candidate when no duplicates', async () => {
      // Mock execute to return empty array (no duplicates)
      mockExecute.mockResolvedValue([]);

      // Mock insert chain
      mockReturning.mockResolvedValue([{ id: 'new-candidate-id' }]);

      const candidateId = await createOrUpdateCandidate({
        organizationId: 'org-123',
        title: 'Test Title',
        content: 'Test content for KB',
        category: 'de_escalation',
        reasoning: 'Useful pattern',
        sourceSuggestionId: 'suggestion-456',
      });

      expect(candidateId).toBe('new-candidate-id');
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockReturning).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          candidateId: 'new-candidate-id',
          category: 'de_escalation',
        }),
        'Created new KB candidate'
      );
    });

    it('merges with existing candidate when duplicate found', async () => {
      const existingCreatedAt = new Date('2025-01-01T00:00:00Z');

      // Mock execute to return existing candidate
      mockExecute.mockResolvedValue([{
        id: 'existing-id',
        acceptance_count: 3,
        unique_users_count: 2,
        avg_similarity: 85,
        created_at: existingCreatedAt,
      }]);

      // Mock update chain
      mockSet.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockResolvedValue(undefined);

      const candidateId = await createOrUpdateCandidate({
        organizationId: 'org-123',
        title: 'Similar Title',
        content: 'Similar content',
        category: 'de_escalation',
        reasoning: 'Pattern match',
      });

      expect(candidateId).toBe('existing-id');
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalledTimes(1);

      // Verify updated values (incremented counts)
      const setCall = mockSet.mock.calls[0][0];
      expect(setCall.acceptanceCount).toBe(4); // 3 + 1
      expect(setCall.uniqueUsersCount).toBe(3); // 2 + 1
      expect(setCall.qualityScore).toBeGreaterThan(0);
      expect(setCall.lastSeenAt).toBeInstanceOf(Date);
      expect(setCall.updatedAt).toBeInstanceOf(Date);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          candidateId: 'existing-id',
          newAcceptanceCount: 4,
        }),
        'Updated existing KB candidate (duplicate detected)'
      );
    });

    it('logs warning on database error', async () => {
      mockExecute.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        createOrUpdateCandidate({
          organizationId: 'org-123',
          title: 'Test Title',
          content: 'Test content',
          category: 'de_escalation',
          reasoning: 'Pattern',
        })
      ).rejects.toThrow('Database connection failed');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          organizationId: 'org-123',
        }),
        'Failed to create or update KB candidate'
      );
    });
  });
});
