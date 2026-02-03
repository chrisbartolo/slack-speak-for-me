import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { mockDelete, mockUpdate, mockInsert } = vi.hoisted(() => ({
  mockDelete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  mockUpdate: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
  mockInsert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('@slack-speak/database', () => {
  const createTable = (name: string) => ({ workspaceId: name, [Symbol.for('name')]: name });
  return {
    db: {
      delete: mockDelete,
      update: mockUpdate,
      insert: mockInsert,
    },
    workspaces: createTable('workspaces'),
    installations: createTable('installations'),
    users: createTable('users'),
    watchedConversations: createTable('watchedConversations'),
    autoRespondLog: createTable('autoRespondLog'),
    threadParticipants: createTable('threadParticipants'),
    userStylePreferences: createTable('userStylePreferences'),
    messageEmbeddings: createTable('messageEmbeddings'),
    refinementFeedback: createTable('refinementFeedback'),
    gdprConsent: createTable('gdprConsent'),
    personContext: createTable('personContext'),
    conversationContext: createTable('conversationContext'),
    reportSettings: createTable('reportSettings'),
    googleIntegrations: createTable('googleIntegrations'),
    workflowConfig: createTable('workflowConfig'),
    suggestionFeedback: createTable('suggestionFeedback'),
    actionableItems: createTable('actionableItems'),
    clientContacts: createTable('clientContacts'),
    escalationAlerts: createTable('escalationAlerts'),
    guardrailViolations: createTable('guardrailViolations'),
    auditLogs: createTable('auditLogs'),
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

import { cleanupWorkspaceData, revokeWorkspaceTokens } from './workspace-cleanup.js';

describe('Workspace Cleanup Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  describe('cleanupWorkspaceData', () => {
    it('should delete from all workspace-scoped tables', async () => {
      await cleanupWorkspaceData('ws_123');

      // 19 workspace tables + update + insert = 21 total db operations
      // delete is called 19 times (one per table)
      expect(mockDelete).toHaveBeenCalledTimes(19);
    });

    it('should mark workspace as inactive', async () => {
      await cleanupWorkspaceData('ws_123');

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should insert audit log entry', async () => {
      await cleanupWorkspaceData('ws_123');

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('should continue cleanup when individual table deletion fails', async () => {
      let callCount = 0;
      mockDelete.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { where: vi.fn().mockRejectedValue(new Error('table error')) };
        }
        return { where: vi.fn().mockResolvedValue(undefined) };
      });

      await cleanupWorkspaceData('ws_123');

      // Should still attempt all 19 tables
      expect(mockDelete).toHaveBeenCalledTimes(19);
      // Should still mark inactive and insert audit log
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('should not delete from auditLogs table', async () => {
      await cleanupWorkspaceData('ws_123');

      // auditLogs is used for insert, not delete
      const deletedTables = mockDelete.mock.calls.map(call => call[0]);
      const auditLogsTable = deletedTables.find((t: any) => t.workspaceId === 'auditLogs');
      expect(auditLogsTable).toBeUndefined();
    });
  });

  describe('revokeWorkspaceTokens', () => {
    it('should only delete installations', async () => {
      await revokeWorkspaceTokens('ws_456');

      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('should mark workspace as inactive', async () => {
      await revokeWorkspaceTokens('ws_456');

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should not insert audit log', async () => {
      await revokeWorkspaceTokens('ws_456');

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      mockDelete.mockReturnValue({ where: vi.fn().mockRejectedValue(new Error('db error')) });

      // Should not throw
      await expect(revokeWorkspaceTokens('ws_456')).resolves.toBeUndefined();
    });
  });
});
