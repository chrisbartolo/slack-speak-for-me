import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  upsertReportScheduler,
  removeReportScheduler,
  syncAllReportSchedulers,
  getReportSchedulers,
} from './schedulers.js';
import { reportQueue } from './queues.js';
import * as dbModule from '@slack-speak/database';

// Mock the database
vi.mock('@slack-speak/database', () => {
  const actualDb = {
    select: vi.fn(),
  };

  return {
    db: actualDb,
    reportSettings: {
      workspaceId: 'workspaceId',
      userId: 'userId',
      enabled: 'enabled',
      dayOfWeek: 'dayOfWeek',
      timeOfDay: 'timeOfDay',
      timezone: 'timezone',
    },
  };
});

// Mock the report queue
vi.mock('./queues.js', () => ({
  reportQueue: {
    upsertJobScheduler: vi.fn(),
    removeJobScheduler: vi.fn(),
    getJobSchedulers: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('schedulers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('upsertReportScheduler', () => {
    it('should create scheduler when settings are enabled', async () => {
      const mockSettings = [
        {
          workspaceId: 'ws-123',
          userId: 'user-456',
          enabled: true,
          dayOfWeek: 1, // Monday
          timeOfDay: '09:00',
          timezone: 'America/New_York',
        },
      ];

      // Mock the database query chain
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockSettings);
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      vi.mocked(dbModule.db.select).mockReturnValue(mockSelect());

      // Mock the where function to return the limit chain
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await upsertReportScheduler('ws-123', 'user-456');

      // Verify upsertJobScheduler was called with correct parameters
      expect(reportQueue.upsertJobScheduler).toHaveBeenCalledWith(
        'report-ws-123-user-456',
        {
          pattern: '0 9 * * 1', // Cron: Monday at 09:00
          tz: 'America/New_York',
        },
        {
          name: 'generate-report',
          data: {
            workspaceId: 'ws-123',
            userId: 'user-456',
            spreadsheetId: '',
          },
        }
      );
    });

    it('should remove scheduler when settings are disabled', async () => {
      const mockSettings = [
        {
          workspaceId: 'ws-123',
          userId: 'user-456',
          enabled: false,
          dayOfWeek: 1,
          timeOfDay: '09:00',
          timezone: 'America/New_York',
        },
      ];

      // Mock the database query chain
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockSettings);
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      vi.mocked(dbModule.db.select).mockReturnValue(mockSelect());

      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await upsertReportScheduler('ws-123', 'user-456');

      // Should call removeJobScheduler instead
      expect(reportQueue.removeJobScheduler).toHaveBeenCalledWith(
        'report-ws-123-user-456'
      );
      expect(reportQueue.upsertJobScheduler).not.toHaveBeenCalled();
    });

    it('should handle missing settings gracefully', async () => {
      // Mock empty settings
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      vi.mocked(dbModule.db.select).mockReturnValue(mockSelect());

      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await upsertReportScheduler('ws-123', 'user-456');

      // Should not call either method
      expect(reportQueue.upsertJobScheduler).not.toHaveBeenCalled();
      expect(reportQueue.removeJobScheduler).not.toHaveBeenCalled();
    });

    it('should convert day/time to correct cron pattern', async () => {
      const mockSettings = [
        {
          workspaceId: 'ws-123',
          userId: 'user-456',
          enabled: true,
          dayOfWeek: 3, // Wednesday
          timeOfDay: '14:15',
          timezone: 'UTC',
        },
      ];

      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockSettings);
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      vi.mocked(dbModule.db.select).mockReturnValue(mockSelect());

      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      await upsertReportScheduler('ws-123', 'user-456');

      expect(reportQueue.upsertJobScheduler).toHaveBeenCalledWith(
        'report-ws-123-user-456',
        {
          pattern: '15 14 * * 3', // Wednesday 14:15
          tz: 'UTC',
        },
        expect.anything()
      );
    });
  });

  describe('removeReportScheduler', () => {
    it('should remove scheduler by ID', async () => {
      await removeReportScheduler('ws-123', 'user-456');

      expect(reportQueue.removeJobScheduler).toHaveBeenCalledWith(
        'report-ws-123-user-456'
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(reportQueue.removeJobScheduler).mockRejectedValue(
        new Error('Scheduler not found')
      );

      // Should not throw
      await expect(
        removeReportScheduler('ws-123', 'user-456')
      ).resolves.toBeUndefined();
    });
  });

  describe('syncAllReportSchedulers', () => {
    it('should sync all enabled schedulers', async () => {
      const mockSettings = [
        {
          workspaceId: 'ws-1',
          userId: 'user-1',
          enabled: true,
          dayOfWeek: 1,
          timeOfDay: '09:00',
          timezone: 'America/New_York',
        },
        {
          workspaceId: 'ws-2',
          userId: 'user-2',
          enabled: true,
          dayOfWeek: 5,
          timeOfDay: '17:00',
          timezone: 'Europe/London',
        },
      ];

      // Mock for syncAllReportSchedulers query
      const mockWhere = vi.fn().mockResolvedValue(mockSettings);
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      vi.mocked(dbModule.db.select).mockReturnValue(mockSelect());

      // Mock for individual upsertReportScheduler queries
      const mockIndividualWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn();

      // First call for ws-1/user-1
      mockLimit
        .mockResolvedValueOnce([mockSettings[0]])
        // Second call for ws-2/user-2
        .mockResolvedValueOnce([mockSettings[1]]);

      // After the first select() call for sync, subsequent calls are for individual upsert
      let callCount = 0;
      vi.mocked(dbModule.db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: syncAllReportSchedulers
          return mockSelect();
        } else {
          // Subsequent calls: individual upsertReportScheduler
          return {
            from: vi.fn().mockReturnValue({
              where: mockIndividualWhere,
            }),
          } as any;
        }
      });

      mockIndividualWhere.mockReturnValue({
        limit: mockLimit,
      });

      await syncAllReportSchedulers();

      // Should have called upsertJobScheduler twice
      expect(reportQueue.upsertJobScheduler).toHaveBeenCalledTimes(2);

      // First scheduler
      expect(reportQueue.upsertJobScheduler).toHaveBeenCalledWith(
        'report-ws-1-user-1',
        {
          pattern: '0 9 * * 1',
          tz: 'America/New_York',
        },
        expect.anything()
      );

      // Second scheduler
      expect(reportQueue.upsertJobScheduler).toHaveBeenCalledWith(
        'report-ws-2-user-2',
        {
          pattern: '0 17 * * 5',
          tz: 'Europe/London',
        },
        expect.anything()
      );
    });

    it('should continue syncing even if one fails', async () => {
      const mockSettings = [
        {
          workspaceId: 'ws-1',
          userId: 'user-1',
          enabled: true,
          dayOfWeek: 1,
          timeOfDay: '09:00',
          timezone: 'America/New_York',
        },
        {
          workspaceId: 'ws-2',
          userId: 'user-2',
          enabled: true,
          dayOfWeek: 5,
          timeOfDay: '17:00',
          timezone: 'Europe/London',
        },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockSettings);
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      vi.mocked(dbModule.db.select).mockReturnValue(mockSelect());

      const mockIndividualWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn();

      // First upsert succeeds, second fails
      mockLimit
        .mockResolvedValueOnce([mockSettings[0]])
        .mockRejectedValueOnce(new Error('Database error'));

      let callCount = 0;
      vi.mocked(dbModule.db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockSelect();
        } else {
          return {
            from: vi.fn().mockReturnValue({
              where: mockIndividualWhere,
            }),
          } as any;
        }
      });

      mockIndividualWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Should not throw despite individual failure
      await expect(syncAllReportSchedulers()).resolves.toBeUndefined();

      // Should have attempted both
      expect(reportQueue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getReportSchedulers', () => {
    it('should return list of active schedulers', async () => {
      const mockSchedulers = [
        {
          key: 'report-ws-1-user-1',
          pattern: '0 9 * * 1',
          tz: 'America/New_York',
        },
        {
          key: 'report-ws-2-user-2',
          pattern: '0 17 * * 5',
          tz: 'Europe/London',
        },
      ];

      vi.mocked(reportQueue.getJobSchedulers).mockResolvedValue(
        mockSchedulers as any
      );

      const result = await getReportSchedulers();

      expect(result).toEqual([
        {
          id: 'report-ws-1-user-1',
          pattern: '0 9 * * 1',
          tz: 'America/New_York',
        },
        {
          id: 'report-ws-2-user-2',
          pattern: '0 17 * * 5',
          tz: 'Europe/London',
        },
      ]);
    });

    it('should handle empty scheduler list', async () => {
      vi.mocked(reportQueue.getJobSchedulers).mockResolvedValue([]);

      const result = await getReportSchedulers();

      expect(result).toEqual([]);
    });
  });
});
