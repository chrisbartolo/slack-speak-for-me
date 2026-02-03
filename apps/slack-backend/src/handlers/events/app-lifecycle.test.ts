import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@slack/bolt';
import { registerAppLifecycleHandlers } from './app-lifecycle.js';

vi.mock('../../services/watch.js', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue('workspace_123'),
}));

vi.mock('../../services/workspace-cleanup.js', () => ({
  cleanupWorkspaceData: vi.fn().mockResolvedValue(undefined),
  revokeWorkspaceTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getWorkspaceId } from '../../services/watch.js';
import { cleanupWorkspaceData, revokeWorkspaceTokens } from '../../services/workspace-cleanup.js';
import { logger } from '../../utils/logger.js';

describe('App Lifecycle Handlers', () => {
  let mockApp: Partial<App>;
  const handlers: Record<string, Function> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp = {
      event: vi.fn((eventName: string, handler: Function) => {
        handlers[eventName] = handler;
      }),
    };

    registerAppLifecycleHandlers(mockApp as App);
  });

  it('should register handlers for app_uninstalled and tokens_revoked', () => {
    expect(mockApp.event).toHaveBeenCalledWith('app_uninstalled', expect.any(Function));
    expect(mockApp.event).toHaveBeenCalledWith('tokens_revoked', expect.any(Function));
  });

  describe('app_uninstalled', () => {
    it('should call cleanupWorkspaceData with correct workspaceId', async () => {
      await handlers['app_uninstalled']({ context: { teamId: 'T123' } });

      expect(getWorkspaceId).toHaveBeenCalledWith('T123');
      expect(cleanupWorkspaceData).toHaveBeenCalledWith('workspace_123');
    });

    it('should handle missing teamId gracefully', async () => {
      await handlers['app_uninstalled']({ context: {} });

      expect(getWorkspaceId).not.toHaveBeenCalled();
      expect(cleanupWorkspaceData).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('app_uninstalled event missing team ID');
    });

    it('should handle workspace not found gracefully', async () => {
      vi.mocked(getWorkspaceId).mockResolvedValueOnce(null);

      await handlers['app_uninstalled']({ context: { teamId: 'T_UNKNOWN' } });

      expect(cleanupWorkspaceData).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        { teamId: 'T_UNKNOWN' },
        'Workspace not found for uninstall event'
      );
    });

    it('should log errors but not throw', async () => {
      vi.mocked(cleanupWorkspaceData).mockRejectedValueOnce(new Error('cleanup failed'));

      await expect(
        handlers['app_uninstalled']({ context: { teamId: 'T123' } })
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Error handling app_uninstalled event'
      );
    });
  });

  describe('tokens_revoked', () => {
    it('should call revokeWorkspaceTokens with correct workspaceId', async () => {
      await handlers['tokens_revoked']({ context: { teamId: 'T456' } });

      expect(getWorkspaceId).toHaveBeenCalledWith('T456');
      expect(revokeWorkspaceTokens).toHaveBeenCalledWith('workspace_123');
    });

    it('should handle missing teamId gracefully', async () => {
      await handlers['tokens_revoked']({ context: {} });

      expect(revokeWorkspaceTokens).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('tokens_revoked event missing team ID');
    });

    it('should handle workspace not found gracefully', async () => {
      vi.mocked(getWorkspaceId).mockResolvedValueOnce(null);

      await handlers['tokens_revoked']({ context: { teamId: 'T_UNKNOWN' } });

      expect(revokeWorkspaceTokens).not.toHaveBeenCalled();
    });

    it('should log errors but not throw', async () => {
      vi.mocked(revokeWorkspaceTokens).mockRejectedValueOnce(new Error('revoke failed'));

      await expect(
        handlers['tokens_revoked']({ context: { teamId: 'T123' } })
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Error handling tokens_revoked event'
      );
    });
  });
});
