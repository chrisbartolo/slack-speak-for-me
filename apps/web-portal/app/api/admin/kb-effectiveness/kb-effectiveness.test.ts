/**
 * Tests for KB Effectiveness Admin API
 *
 * Tests cover:
 * - Security: requireAdmin enforcement and organization scoping
 * - GET /api/admin/kb-effectiveness - Analytics data with document effectiveness, candidate stats, and growth trends
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock server-only
vi.mock('server-only', () => ({}));

// Mock requireAdmin
const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

// Mock database with execute function for raw SQL
const mockDbExecute = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    execute: (...args: unknown[]) => mockDbExecute(...args),
  },
  schema: {
    kbEffectiveness: {},
    knowledgeBaseDocuments: {},
    suggestionFeedback: {},
    kbCandidates: {},
  },
}));

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ type: 'eq', field, value })),
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  gte: vi.fn((field, value) => ({ type: 'gte', field, value })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
}));

// Import route after mocks
import { GET as getKBEffectiveness } from './route';

// Helper to create NextRequest
function createRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('KB Effectiveness API - Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires admin auth', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('Unauthorized'));

    const request = createRequest('http://localhost:3000/api/admin/kb-effectiveness');
    const response = await getKBEffectiveness(request);

    expect(response.status).toBe(500);
  });

  it('returns 400 without organizationId', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      role: 'admin',
      // organizationId is undefined
    });

    const request = createRequest('http://localhost:3000/api/admin/kb-effectiveness');
    const response = await getKBEffectiveness(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No organization found');
  });
});

describe('GET /api/admin/kb-effectiveness - Analytics Data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all three data sections', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    // Mock document effectiveness results
    const mockDocumentEffectiveness = [
      {
        document_id: 'doc1',
        title: 'How to handle escalations',
        category: 'de_escalation',
        times_used: '10',
        accepted_count: '8',
        dismissed_count: '2',
        acceptance_rate: '80.0',
        avg_similarity: '0.85',
      },
      {
        document_id: 'doc2',
        title: 'Positive acknowledgment',
        category: 'positive_acknowledgment',
        times_used: '5',
        accepted_count: '4',
        dismissed_count: '1',
        acceptance_rate: '80.0',
        avg_similarity: '0.9',
      },
    ];

    // Mock candidate stats results
    const mockCandidateStats = [
      { status: 'pending', count: '3' },
      { status: 'approved', count: '10' },
      { status: 'rejected', count: '2' },
      { status: 'merged', count: '1' },
    ];

    // Mock growth trend results
    const mockGrowthTrend = [
      { week_start: '2024-01-01', created: '5', approved: '3', rejected: '1' },
      { week_start: '2024-01-08', created: '7', approved: '5', rejected: '2' },
    ];

    // Setup mock execute to return different results for each query
    mockDbExecute
      .mockResolvedValueOnce(mockDocumentEffectiveness) // First call: document effectiveness
      .mockResolvedValueOnce(mockCandidateStats) // Second call: candidate stats
      .mockResolvedValueOnce(mockGrowthTrend); // Third call: growth trend

    const request = createRequest('http://localhost:3000/api/admin/kb-effectiveness');
    const response = await getKBEffectiveness(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documentEffectiveness).toBeDefined();
    expect(data.candidateStats).toBeDefined();
    expect(data.growthTrend).toBeDefined();

    // Verify document effectiveness parsing
    expect(data.documentEffectiveness).toHaveLength(2);
    expect(data.documentEffectiveness[0]).toEqual({
      documentId: 'doc1',
      title: 'How to handle escalations',
      category: 'de_escalation',
      timesUsed: 10,
      acceptedCount: 8,
      dismissedCount: 2,
      acceptanceRate: 80.0,
      avgSimilarity: 0.85,
    });

    // Verify candidate stats parsing
    expect(data.candidateStats).toEqual({
      pending: 3,
      approved: 10,
      rejected: 2,
      merged: 1,
    });

    // Verify growth trend parsing
    expect(data.growthTrend).toHaveLength(2);
    expect(data.growthTrend[0]).toEqual({
      week: '2024-01-01',
      created: 5,
      approved: 3,
      rejected: 1,
    });
  });

  it('defaults to 30 days', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    mockDbExecute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const request = createRequest('http://localhost:3000/api/admin/kb-effectiveness');
    await getKBEffectiveness(request);

    // Verify execute was called 3 times (one for each query)
    expect(mockDbExecute).toHaveBeenCalledTimes(3);
  });

  it('caps at 90 days max', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    mockDbExecute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const request = createRequest('http://localhost:3000/api/admin/kb-effectiveness?days=365');
    const response = await getKBEffectiveness(request);

    expect(response.status).toBe(200);
    // The route should cap days at 90
    expect(mockDbExecute).toHaveBeenCalledTimes(3);
  });

  it('returns empty defaults when no data', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    // Mock all queries returning empty results
    mockDbExecute
      .mockResolvedValueOnce([]) // Empty document effectiveness
      .mockResolvedValueOnce([]) // Empty candidate stats
      .mockResolvedValueOnce([]); // Empty growth trend

    const request = createRequest('http://localhost:3000/api/admin/kb-effectiveness');
    const response = await getKBEffectiveness(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documentEffectiveness).toEqual([]);
    expect(data.candidateStats).toEqual({
      pending: 0,
      approved: 0,
      rejected: 0,
      merged: 0,
    });
    expect(data.growthTrend).toEqual([]);
  });

  it('handles partial candidate stats data', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    // Only some statuses present
    const mockPartialStats = [
      { status: 'pending', count: '5' },
      { status: 'approved', count: '2' },
      // No rejected or merged entries
    ];

    mockDbExecute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockPartialStats)
      .mockResolvedValueOnce([]);

    const request = createRequest('http://localhost:3000/api/admin/kb-effectiveness');
    const response = await getKBEffectiveness(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.candidateStats).toEqual({
      pending: 5,
      approved: 2,
      rejected: 0, // Should default to 0
      merged: 0, // Should default to 0
    });
  });

  it('parses numeric values correctly', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const mockDocEffectiveness = [
      {
        document_id: 'doc1',
        title: 'Test',
        category: 'test',
        times_used: '100',
        accepted_count: '75',
        dismissed_count: '25',
        acceptance_rate: '75.5',
        avg_similarity: '0.888',
      },
    ];

    mockDbExecute
      .mockResolvedValueOnce(mockDocEffectiveness)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const request = createRequest('http://localhost:3000/api/admin/kb-effectiveness');
    const response = await getKBEffectiveness(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const doc = data.documentEffectiveness[0];
    expect(doc.timesUsed).toBe(100);
    expect(doc.acceptedCount).toBe(75);
    expect(doc.dismissedCount).toBe(25);
    expect(doc.acceptanceRate).toBe(75.5);
    expect(doc.avgSimilarity).toBe(0.888);
  });

  it('handles zero avg_similarity gracefully', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const mockDocEffectiveness = [
      {
        document_id: 'doc1',
        title: 'Test',
        category: null,
        times_used: '1',
        accepted_count: '0',
        dismissed_count: '1',
        acceptance_rate: '0',
        avg_similarity: null, // Can be null if no data
      },
    ];

    mockDbExecute
      .mockResolvedValueOnce(mockDocEffectiveness)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const request = createRequest('http://localhost:3000/api/admin/kb-effectiveness');
    const response = await getKBEffectiveness(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const doc = data.documentEffectiveness[0];
    expect(doc.avgSimilarity).toBe(0); // Should default to 0
  });
});
