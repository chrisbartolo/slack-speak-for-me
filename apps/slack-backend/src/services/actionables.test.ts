import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();

vi.mock('@slack-speak/database', () => ({
  db: {
    select: () => ({ from: mockFrom }),
    insert: () => ({ values: mockValues }),
    update: () => ({ set: mockSet }),
    delete: () => ({ where: mockDelete }),
  },
  actionableItems: {
    id: 'id',
    workspaceId: 'workspace_id',
    userId: 'user_id',
    channelId: 'channel_id',
    messageTs: 'message_ts',
    status: 'status',
    snoozedUntil: 'snoozed_until',
    completedAt: 'completed_at',
    dismissedAt: 'dismissed_at',
    completionNote: 'completion_note',
    updatedAt: 'updated_at',
    dueDate: 'due_date',
    confidenceScore: 'confidence_score',
    detectedAt: 'detected_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  gte: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  lt: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}));

vi.mock('./actionable-detection.js', () => ({
  detectActionable: vi.fn(),
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

// Setup chain mocking
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({
  orderBy: mockOrderBy,
  limit: mockLimit,
  returning: mockReturning,
});
mockOrderBy.mockReturnValue({ limit: mockLimit });
mockLimit.mockResolvedValue([]);
mockValues.mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue([]) });
mockSet.mockReturnValue({ where: mockWhere });
mockReturning.mockResolvedValue([]);

import {
  processMessageForActionables,
  getPendingActionables,
  getActionableById,
  updateActionableStatus,
  deleteActionable,
} from './actionables.js';

describe('Actionables Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocking
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({
      orderBy: mockOrderBy,
      limit: mockLimit,
      returning: mockReturning,
    });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);
    mockSet.mockReturnValue({ where: mockWhere });
    mockReturning.mockResolvedValue([]);
    mockValues.mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue([]) });
  });

  describe('processMessageForActionables', () => {
    it('should skip messages shorter than 10 characters', async () => {
      await processMessageForActionables({
        workspaceId: 'W123',
        userId: 'U456',
        channelId: 'C789',
        messageTs: '123.456',
        messageText: 'ok',
        messageAuthorId: 'U789',
      });

      expect(detectActionable).not.toHaveBeenCalled();
    });

    it('should skip if actionable already exists for message', async () => {
      mockLimit.mockResolvedValueOnce([{ id: 'existing-id' }]);

      await processMessageForActionables({
        workspaceId: 'W123',
        userId: 'U456',
        channelId: 'C789',
        messageTs: '123.456',
        messageText: 'Can you review this PR by Friday?',
        messageAuthorId: 'U789',
      });

      expect(detectActionable).not.toHaveBeenCalled();
    });

    it('should not store if no actionable detected', async () => {
      mockLimit.mockResolvedValueOnce([]); // No existing

      vi.mocked(detectActionable).mockResolvedValue({
        hasActionable: false,
        actionable: null,
        processingTimeMs: 100,
      });

      await processMessageForActionables({
        workspaceId: 'W123',
        userId: 'U456',
        channelId: 'C789',
        messageTs: '123.456',
        messageText: 'Thanks for the update!',
        messageAuthorId: 'U789',
      });

      expect(mockValues).not.toHaveBeenCalled();
    });
  });

  describe('updateActionableStatus', () => {
    it('should update status to completed with timestamp', async () => {
      mockReturning.mockResolvedValue([{ id: 'task-1', status: 'completed' }]);

      const result = await updateActionableStatus('W123', 'U456', 'task-1', 'completed');

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
        })
      );
    });

    it('should update status to dismissed', async () => {
      mockReturning.mockResolvedValue([{ id: 'task-1', status: 'dismissed' }]);

      const result = await updateActionableStatus('W123', 'U456', 'task-1', 'dismissed');

      expect(result).toBe(true);
    });

    it('should update status to snoozed with snoozedUntil', async () => {
      const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockReturning.mockResolvedValue([{ id: 'task-1', status: 'snoozed' }]);

      const result = await updateActionableStatus(
        'W123',
        'U456',
        'task-1',
        'snoozed',
        snoozedUntil
      );

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'snoozed',
          snoozedUntil,
        })
      );
    });

    it('should store completionNote when completing', async () => {
      mockReturning.mockResolvedValue([{ id: 'task-1', status: 'completed' }]);

      await updateActionableStatus('W123', 'U456', 'task-1', 'completed', undefined, 'Deployed to staging');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          completionNote: 'Deployed to staging',
        })
      );
    });

    it('should return false if task not found', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await updateActionableStatus('W123', 'U456', 'nonexistent', 'completed');

      expect(result).toBe(false);
    });
  });

  describe('getActionableById', () => {
    it('should return task if found', async () => {
      const mockTask = { id: 'task-1', title: 'Review PR', status: 'pending' };
      mockLimit.mockResolvedValueOnce([mockTask]);

      const result = await getActionableById('W123', 'U456', 'task-1');

      expect(result).toEqual(mockTask);
    });

    it('should return null if not found', async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await getActionableById('W123', 'U456', 'nonexistent');

      expect(result).toBeNull();
    });
  });
});
