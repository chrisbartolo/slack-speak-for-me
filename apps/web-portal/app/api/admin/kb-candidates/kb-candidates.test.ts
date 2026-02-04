/**
 * Tests for KB Candidates Admin API
 *
 * Tests cover:
 * - Security: requireAdmin enforcement and organization scoping
 * - GET /api/admin/kb-candidates - List with filtering and pagination
 * - GET /api/admin/kb-candidates/[id] - Get single candidate
 * - PATCH /api/admin/kb-candidates/[id] - Review actions (approve, reject, merge)
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

// Mock database - use factory function to avoid hoisting issues
vi.mock('@/lib/db', () => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
    schema: {
      kbCandidates: {
        organizationId: 'organizationId',
        status: 'status',
        category: 'category',
        qualityScore: 'qualityScore',
        acceptanceCount: 'acceptanceCount',
        createdAt: 'createdAt',
        id: 'id',
      },
      knowledgeBaseDocuments: {},
    },
  };
});

// Mock drizzle-orm functions to return values that work with query builder
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ _tag: 'eq', field, value })),
  and: vi.fn((...conditions) => ({ _tag: 'and', conditions })),
  desc: vi.fn((field) => ({ _tag: 'desc', field })),
  sql: Object.assign(
    vi.fn((strings, ...values) => ({  _tag: 'sql', strings, values })),
    { raw: vi.fn() }
  ),
}));

// Import routes after mocks
import { GET as listCandidates } from './route';
import { GET as getCandidate, PATCH as reviewCandidate } from './[id]/route';
import { db } from '@/lib/db';

// Extract mocked functions from db
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);

// Helper to create NextRequest
function createRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

// Helper to create chainable query builder mock
function createQueryBuilder(finalResult: unknown) {
  const builder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(finalResult),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(finalResult),
    set: vi.fn().mockReturnThis(),
  };
  return builder;
}

describe('KB Candidates API - Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requireAdmin rejection returns 500 for non-admin users (list route)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('Unauthorized'));

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates');
    const response = await listCandidates(request);

    expect(response.status).toBe(500);
  });

  it('returns 400 when no organizationId (list route)', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      role: 'admin',
      // organizationId is undefined
    });

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates');
    const response = await listCandidates(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No organization found');
  });

  it('organization scoping - queries include organizationId filter', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const countBuilder = createQueryBuilder([{ count: 0 }]);
    const candidatesBuilder = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(countBuilder).mockReturnValueOnce(candidatesBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates');
    await listCandidates(request);

    // Verify where was called (org filter applied)
    expect(countBuilder.where).toHaveBeenCalled();
    expect(candidatesBuilder.where).toHaveBeenCalled();
  });
});

describe('GET /api/admin/kb-candidates - List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated candidates with defaults', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const mockCandidates = [
      { id: 'c1', title: 'Candidate 1', status: 'pending', qualityScore: 0.9 },
      { id: 'c2', title: 'Candidate 2', status: 'pending', qualityScore: 0.85 },
    ];

    const countBuilder = createQueryBuilder([{ count: 3 }]);
    const candidatesBuilder = createQueryBuilder(mockCandidates);
    mockSelect.mockReturnValueOnce(countBuilder).mockReturnValueOnce(candidatesBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates');
    const response = await listCandidates(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.candidates).toEqual(mockCandidates);
    expect(data.total).toBe(3);
    expect(data.limit).toBe(20); // Default limit
    expect(data.offset).toBe(0); // Default offset
  });

  it('filters by status parameter', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const countBuilder = createQueryBuilder([{ count: 0 }]);
    const candidatesBuilder = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(countBuilder).mockReturnValueOnce(candidatesBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates?status=approved');
    await listCandidates(request);

    expect(countBuilder.where).toHaveBeenCalled();
    expect(candidatesBuilder.where).toHaveBeenCalled();
  });

  it('filters by category parameter', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const countBuilder = createQueryBuilder([{ count: 0 }]);
    const candidatesBuilder = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(countBuilder).mockReturnValueOnce(candidatesBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates?category=de_escalation');
    await listCandidates(request);

    expect(countBuilder.where).toHaveBeenCalled();
    expect(candidatesBuilder.where).toHaveBeenCalled();
  });

  it('limits max to 100', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const countBuilder = createQueryBuilder([{ count: 0 }]);
    const candidatesBuilder = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(countBuilder).mockReturnValueOnce(candidatesBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates?limit=500');
    const response = await listCandidates(request);
    const data = await response.json();

    expect(data.limit).toBe(100); // Capped to 100
    expect(candidatesBuilder.limit).toHaveBeenCalled();
  });

  it('returns total count for pagination', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const countBuilder = createQueryBuilder([{ count: 42 }]);
    const candidatesBuilder = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(countBuilder).mockReturnValueOnce(candidatesBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates');
    const response = await listCandidates(request);
    const data = await response.json();

    expect(data.total).toBe(42);
  });

  it('sorts by quality_score DESC by default', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const countBuilder = createQueryBuilder([{ count: 0 }]);
    const candidatesBuilder = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(countBuilder).mockReturnValueOnce(candidatesBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates');
    await listCandidates(request);

    expect(candidatesBuilder.orderBy).toHaveBeenCalled();
  });

  it('sorts by acceptance_count when requested', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const countBuilder = createQueryBuilder([{ count: 0 }]);
    const candidatesBuilder = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(countBuilder).mockReturnValueOnce(candidatesBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates?sort=acceptance_count');
    await listCandidates(request);

    expect(candidatesBuilder.orderBy).toHaveBeenCalled();
  });
});

describe('GET /api/admin/kb-candidates/[id] - Get Single', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for non-existent candidate', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const builder = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(builder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates/nonexistent');
    const params = Promise.resolve({ id: 'nonexistent' });
    const response = await getCandidate(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Candidate not found');
  });

  it('returns candidate when found in admin\'s org', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const mockCandidate = {
      id: 'c1',
      title: 'Test Candidate',
      organizationId: 'org123',
      status: 'pending',
    };

    const builder = createQueryBuilder([mockCandidate]);
    mockSelect.mockReturnValueOnce(builder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates/c1');
    const params = Promise.resolve({ id: 'c1' });
    const response = await getCandidate(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.candidate).toEqual(mockCandidate);
  });
});

describe('PATCH /api/admin/kb-candidates/[id] - Review Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid action', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates/c1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'invalid' }),
    });
    const params = Promise.resolve({ id: 'c1' });
    const response = await reviewCandidate(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid');
  });

  it('returns 404 if candidate doesn\'t belong to admin\'s org', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const selectBuilder = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(selectBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates/c1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    });
    const params = Promise.resolve({ id: 'c1' });
    const response = await reviewCandidate(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Candidate not found');
  });

  it('approve: publishes to knowledgeBaseDocuments', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const mockCandidate = {
      id: 'c1',
      title: 'Test Candidate',
      content: 'Test content',
      category: 'de_escalation',
      tags: ['tag1'],
      embedding: [0.1, 0.2],
      organizationId: 'org123',
    };

    const selectBuilder = createQueryBuilder([mockCandidate]);
    const insertBuilder = createQueryBuilder([{ id: 'new-doc-id' }]);
    const updateBuilder = createQueryBuilder([]);

    mockSelect.mockReturnValueOnce(selectBuilder);
    mockInsert.mockReturnValueOnce(insertBuilder);
    mockUpdate.mockReturnValueOnce(updateBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates/c1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    });
    const params = Promise.resolve({ id: 'c1' });
    const response = await reviewCandidate(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.documentId).toBe('new-doc-id');
    expect(mockInsert).toHaveBeenCalled();
    expect(insertBuilder.values).toHaveBeenCalled();
  });

  it('approve: sets status to approved with reviewer info', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const mockCandidate = {
      id: 'c1',
      title: 'Test',
      content: 'Content',
      category: 'test',
      tags: [],
      embedding: [],
      organizationId: 'org123',
    };

    const selectBuilder = createQueryBuilder([mockCandidate]);
    const insertBuilder = createQueryBuilder([{ id: 'new-doc-id' }]);
    const updateBuilder = createQueryBuilder([]);

    mockSelect.mockReturnValueOnce(selectBuilder);
    mockInsert.mockReturnValueOnce(insertBuilder);
    mockUpdate.mockReturnValueOnce(updateBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates/c1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    });
    const params = Promise.resolve({ id: 'c1' });
    await reviewCandidate(request, { params });

    expect(mockUpdate).toHaveBeenCalled();
    expect(updateBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        reviewedBy: 'U1',
      })
    );
  });

  it('reject: requires rejectionReason', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const mockCandidate = { id: 'c1', organizationId: 'org123' };
    const selectBuilder = createQueryBuilder([mockCandidate]);
    mockSelect.mockReturnValueOnce(selectBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates/c1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject' }),
    });
    const params = Promise.resolve({ id: 'c1' });
    const response = await reviewCandidate(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Rejection reason is required');
  });

  it('reject: sets status and reason', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const mockCandidate = { id: 'c1', organizationId: 'org123' };
    const selectBuilder = createQueryBuilder([mockCandidate]);
    const updateBuilder = createQueryBuilder([]);

    mockSelect.mockReturnValueOnce(selectBuilder);
    mockUpdate.mockReturnValueOnce(updateBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates/c1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject', rejectionReason: 'Not relevant' }),
    });
    const params = Promise.resolve({ id: 'c1' });
    const response = await reviewCandidate(request, { params });

    expect(response.status).toBe(200);
    expect(updateBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: 'Not relevant',
      })
    );
  });

  it('merge: requires mergeWithId', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const mockCandidate = { id: 'c1', organizationId: 'org123' };
    const selectBuilder = createQueryBuilder([mockCandidate]);
    mockSelect.mockReturnValueOnce(selectBuilder);

    const request = createRequest('http://localhost:3000/api/admin/kb-candidates/c1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'merge' }),
    });
    const params = Promise.resolve({ id: 'c1' });
    const response = await reviewCandidate(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('mergeWithId is required for merge action');
  });

  it('merge: returns 404 if target doesn\'t exist in same org', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const sourceId = '123e4567-e89b-12d3-a456-426614174000';
    const targetId = '123e4567-e89b-12d3-a456-426614174001';
    const mockCandidate = { id: sourceId, organizationId: 'org123', acceptanceCount: 5 };

    // First select: source candidate, second select: empty (target not found)
    const selectBuilder1 = createQueryBuilder([mockCandidate]);
    const selectBuilder2 = createQueryBuilder([]);
    mockSelect.mockReturnValueOnce(selectBuilder1).mockReturnValueOnce(selectBuilder2);

    const request = createRequest(`http://localhost:3000/api/admin/kb-candidates/${sourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'merge', mergeWithId: targetId }),
    });
    const params = Promise.resolve({ id: sourceId });
    const response = await reviewCandidate(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Target candidate not found');
  });

  it('merge: consolidates acceptance counts', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const sourceId = '123e4567-e89b-12d3-a456-426614174000';
    const targetId = '123e4567-e89b-12d3-a456-426614174001';
    const mockSourceCandidate = { id: sourceId, organizationId: 'org123', acceptanceCount: 5 };
    const mockTargetCandidate = { id: targetId, organizationId: 'org123', acceptanceCount: 10 };

    const selectBuilder1 = createQueryBuilder([mockSourceCandidate]);
    const selectBuilder2 = createQueryBuilder([mockTargetCandidate]);
    const updateBuilder1 = createQueryBuilder([]);
    const updateBuilder2 = createQueryBuilder([]);

    mockSelect.mockReturnValueOnce(selectBuilder1).mockReturnValueOnce(selectBuilder2);
    mockUpdate.mockReturnValueOnce(updateBuilder1).mockReturnValueOnce(updateBuilder2);

    const request = createRequest(`http://localhost:3000/api/admin/kb-candidates/${sourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'merge', mergeWithId: targetId }),
    });
    const params = Promise.resolve({ id: sourceId });
    const response = await reviewCandidate(request, { params });

    expect(response.status).toBe(200);
    // Should update target with combined count (5 + 10 = 15)
    expect(updateBuilder1.set).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptanceCount: 15,
      })
    );
  });

  it('merge: sets mergedIntoId on source candidate', async () => {
    mockRequireAdmin.mockResolvedValueOnce({
      userId: 'U1',
      workspaceId: 'ws1',
      organizationId: 'org123',
      role: 'admin',
    });

    const sourceId = '123e4567-e89b-12d3-a456-426614174000';
    const targetId = '123e4567-e89b-12d3-a456-426614174001';
    const mockSourceCandidate = { id: sourceId, organizationId: 'org123', acceptanceCount: 5 };
    const mockTargetCandidate = { id: targetId, organizationId: 'org123', acceptanceCount: 10 };

    const selectBuilder1 = createQueryBuilder([mockSourceCandidate]);
    const selectBuilder2 = createQueryBuilder([mockTargetCandidate]);
    const updateBuilder1 = createQueryBuilder([]);
    const updateBuilder2 = createQueryBuilder([]);

    mockSelect.mockReturnValueOnce(selectBuilder1).mockReturnValueOnce(selectBuilder2);
    mockUpdate.mockReturnValueOnce(updateBuilder1).mockReturnValueOnce(updateBuilder2);

    const request = createRequest(`http://localhost:3000/api/admin/kb-candidates/${sourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'merge', mergeWithId: targetId }),
    });
    const params = Promise.resolve({ id: sourceId });
    await reviewCandidate(request, { params });

    // Second update call should set source status to merged
    expect(updateBuilder2.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'merged',
        mergedIntoId: targetId,
      })
    );
  });
});
