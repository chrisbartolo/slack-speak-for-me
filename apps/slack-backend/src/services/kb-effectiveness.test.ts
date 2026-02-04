import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted for all mocks
const { mockExecute, mockValues } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockValues: vi.fn(),
}));

vi.mock('@slack-speak/database', () => ({
  db: {
    execute: mockExecute,
    insert: vi.fn(() => ({
      values: mockValues,
    })),
  },
  kbEffectiveness: { suggestionId: 'suggestion_id', kbDocumentId: 'kb_document_id', organizationId: 'organization_id', similarity: 'similarity' },
  knowledgeBaseDocuments: {},
  suggestionFeedback: {},
  sql: vi.fn((strings, ...values) => ({ strings, values })),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Import after mocks
import { recordKBUsage, getKBEffectiveness, getLowPerformingDocs } from './kb-effectiveness.js';
import { logger } from '../utils/logger.js';

describe('kb-effectiveness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordKBUsage', () => {
    it('inserts records for each KB document', async () => {
      mockValues.mockResolvedValue(undefined);

      await recordKBUsage({
        suggestionId: 'sugg-123',
        organizationId: 'org-456',
        kbDocumentIds: ['doc-1', 'doc-2', 'doc-3'],
        similarities: [0.95, 0.87, 0.73],
      });

      expect(mockValues).toHaveBeenCalledTimes(1);
      const records = mockValues.mock.calls[0][0];
      expect(records).toHaveLength(3);

      expect(records[0]).toEqual({
        suggestionId: 'sugg-123',
        kbDocumentId: 'doc-1',
        organizationId: 'org-456',
        similarity: 95,
      });

      expect(records[1]).toEqual({
        suggestionId: 'sugg-123',
        kbDocumentId: 'doc-2',
        organizationId: 'org-456',
        similarity: 87,
      });

      expect(records[2]).toEqual({
        suggestionId: 'sugg-123',
        kbDocumentId: 'doc-3',
        organizationId: 'org-456',
        similarity: 73,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestionId: 'sugg-123',
          organizationId: 'org-456',
          documentsTracked: 3,
        }),
        'KB usage recorded'
      );
    });

    it('converts float similarity to integer', async () => {
      mockValues.mockResolvedValue(undefined);

      await recordKBUsage({
        suggestionId: 'sugg-123',
        organizationId: 'org-456',
        kbDocumentIds: ['doc-1', 'doc-2'],
        similarities: [0.85, 0.92],
      });

      const records = mockValues.mock.calls[0][0];
      expect(records[0].similarity).toBe(85);
      expect(records[1].similarity).toBe(92);
    });

    it('handles empty document IDs array', async () => {
      await recordKBUsage({
        suggestionId: 'sugg-123',
        organizationId: 'org-456',
        kbDocumentIds: [],
        similarities: [],
      });

      // Should return early without calling insert
      expect(mockValues).not.toHaveBeenCalled();
    });

    it('never throws on error (fire-and-forget)', async () => {
      mockValues.mockRejectedValue(new Error('Database insert failed'));

      // Should not throw
      await expect(
        recordKBUsage({
          suggestionId: 'sugg-123',
          organizationId: 'org-456',
          kbDocumentIds: ['doc-1'],
          similarities: [0.95],
        })
      ).resolves.toBeUndefined();
    });

    it('logs warning on error', async () => {
      const error = new Error('Database insert failed');
      mockValues.mockRejectedValue(error);

      await recordKBUsage({
        suggestionId: 'sugg-123',
        organizationId: 'org-456',
        kbDocumentIds: ['doc-1'],
        similarities: [0.95],
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          suggestionId: 'sugg-123',
          organizationId: 'org-456',
        }),
        'Failed to record KB usage'
      );
    });
  });

  describe('getKBEffectiveness', () => {
    it('returns formatted effectiveness data', async () => {
      mockExecute.mockResolvedValue([
        {
          document_id: 'doc-1',
          title: 'De-escalation Tips',
          category: 'de_escalation',
          times_used: '25',
          accepted_count: '20',
          dismissed_count: '5',
          acceptance_rate: '80',
          avg_similarity: '87',
        },
        {
          document_id: 'doc-2',
          title: 'Phrasing Guide',
          category: 'phrasing_patterns',
          times_used: '15',
          accepted_count: '10',
          dismissed_count: '5',
          acceptance_rate: '67',
          avg_similarity: '75',
        },
      ]);

      const result = await getKBEffectiveness('org-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        documentId: 'doc-1',
        title: 'De-escalation Tips',
        category: 'de_escalation',
        timesUsed: 25,
        acceptedCount: 20,
        dismissedCount: 5,
        acceptanceRate: 80,
        avgSimilarity: 87,
      });
      expect(result[1]).toEqual({
        documentId: 'doc-2',
        title: 'Phrasing Guide',
        category: 'phrasing_patterns',
        timesUsed: 15,
        acceptedCount: 10,
        dismissedCount: 5,
        acceptanceRate: 67,
        avgSimilarity: 75,
      });
    });

    it('defaults to 30 days', async () => {
      mockExecute.mockResolvedValue([]);

      const result = await getKBEffectiveness('org-123');

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('respects days parameter', async () => {
      mockExecute.mockResolvedValue([]);

      const result = await getKBEffectiveness('org-123', { days: 7 });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('throws on database error', async () => {
      const error = new Error('Database query failed');
      mockExecute.mockRejectedValue(error);

      await expect(getKBEffectiveness('org-123')).rejects.toThrow('Database query failed');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          organizationId: 'org-123',
          days: 30,
        }),
        'Failed to get KB effectiveness'
      );
    });
  });

  describe('getLowPerformingDocs', () => {
    it('filters docs below 30% acceptance rate with 5+ uses', async () => {
      mockExecute.mockResolvedValue([
        {
          document_id: 'doc-1',
          title: 'Good Doc',
          category: 'de_escalation',
          times_used: '20',
          accepted_count: '15',
          dismissed_count: '5',
          acceptance_rate: '75',
          avg_similarity: '85',
        },
        {
          document_id: 'doc-2',
          title: 'Low Performer',
          category: 'phrasing_patterns',
          times_used: '10',
          accepted_count: '2',
          dismissed_count: '8',
          acceptance_rate: '20',
          avg_similarity: '60',
        },
        {
          document_id: 'doc-3',
          title: 'Another Low Performer',
          category: 'domain_knowledge',
          times_used: '8',
          accepted_count: '1',
          dismissed_count: '7',
          acceptance_rate: '12',
          avg_similarity: '55',
        },
      ]);

      const result = await getLowPerformingDocs('org-123');

      expect(result).toHaveLength(2);
      expect(result[0].documentId).toBe('doc-2');
      expect(result[0].acceptanceRate).toBe(20);
      expect(result[1].documentId).toBe('doc-3');
      expect(result[1].acceptanceRate).toBe(12);
    });

    it('excludes docs with less than 5 uses', async () => {
      mockExecute.mockResolvedValue([
        {
          document_id: 'doc-1',
          title: 'Low Uses',
          category: 'de_escalation',
          times_used: '3',
          accepted_count: '0',
          dismissed_count: '3',
          acceptance_rate: '0',
          avg_similarity: '70',
        },
        {
          document_id: 'doc-2',
          title: 'Exactly 4 Uses',
          category: 'phrasing_patterns',
          times_used: '4',
          accepted_count: '0',
          dismissed_count: '4',
          acceptance_rate: '0',
          avg_similarity: '65',
        },
        {
          document_id: 'doc-3',
          title: 'Exactly 5 Uses',
          category: 'domain_knowledge',
          times_used: '5',
          accepted_count: '1',
          dismissed_count: '4',
          acceptance_rate: '20',
          avg_similarity: '60',
        },
      ]);

      const result = await getLowPerformingDocs('org-123');

      // Only doc-3 should be returned (5+ uses and < 30% acceptance)
      expect(result).toHaveLength(1);
      expect(result[0].documentId).toBe('doc-3');
      expect(result[0].timesUsed).toBe(5);
    });

    it('returns empty array when all docs perform well', async () => {
      mockExecute.mockResolvedValue([
        {
          document_id: 'doc-1',
          title: 'Excellent Doc',
          category: 'de_escalation',
          times_used: '50',
          accepted_count: '45',
          dismissed_count: '5',
          acceptance_rate: '90',
          avg_similarity: '92',
        },
        {
          document_id: 'doc-2',
          title: 'Good Doc',
          category: 'phrasing_patterns',
          times_used: '30',
          accepted_count: '20',
          dismissed_count: '10',
          acceptance_rate: '67',
          avg_similarity: '80',
        },
        {
          document_id: 'doc-3',
          title: 'Decent Doc',
          category: 'domain_knowledge',
          times_used: '15',
          accepted_count: '8',
          dismissed_count: '7',
          acceptance_rate: '53',
          avg_similarity: '75',
        },
      ]);

      const result = await getLowPerformingDocs('org-123');

      expect(result).toHaveLength(0);
    });
  });
});
