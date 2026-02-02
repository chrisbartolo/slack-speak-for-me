/**
 * Tests for Super Admin Authentication
 *
 * Tests cover:
 * - Checking if user is a super admin
 * - Requiring super admin access (with redirect)
 * - Email lookup from database when not in session
 * - Case-insensitive email matching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock server-only
vi.mock('server-only', () => ({}));

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

// Mock session verification
const mockVerifySession = vi.fn();
vi.mock('./dal', () => ({
  verifySession: () => mockVerifySession(),
}));

// Mock database
const mockDbSelect = vi.fn();
vi.mock('@slack-speak/database', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockDbSelect(),
        }),
      }),
    }),
  },
  users: {
    email: 'email',
    workspaceId: 'workspace_id',
    slackUserId: 'slack_user_id',
  },
}));

// Set super admin emails before importing the module
const SUPER_ADMIN_EMAIL = 'superadmin@example.com';
const originalEnv = process.env.SUPER_ADMIN_EMAILS;

describe('Super Admin Auth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;
  });

  afterEach(() => {
    process.env.SUPER_ADMIN_EMAILS = originalEnv;
  });

  describe('isSuperAdmin', () => {
    it('should return true if session email is in super admin list', async () => {
      // Re-import to pick up new env
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      // Re-mock after reset
      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { isSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: SUPER_ADMIN_EMAIL,
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      const result = await isSuperAdmin();
      expect(result).toBe(true);
    });

    it('should return true for case-insensitive email match', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { isSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: 'SUPERADMIN@EXAMPLE.COM',
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      const result = await isSuperAdmin();
      expect(result).toBe(true);
    });

    it('should return false if session email is not in super admin list', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { isSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: 'regular@example.com',
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      const result = await isSuperAdmin();
      expect(result).toBe(false);
    });

    it('should return false if session verification fails', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { isSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockRejectedValue(new Error('No session'));

      const result = await isSuperAdmin();
      expect(result).toBe(false);
    });

    it('should lookup email from database if not in session', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { isSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: null,
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      mockDbSelect.mockResolvedValue([{ email: SUPER_ADMIN_EMAIL }]);

      const result = await isSuperAdmin();
      expect(result).toBe(true);
    });

    it('should return false if email not found in database', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { isSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: null,
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      mockDbSelect.mockResolvedValue([]);

      const result = await isSuperAdmin();
      expect(result).toBe(false);
    });

    it('should handle multiple super admin emails', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = 'admin1@example.com, admin2@example.com, admin3@example.com';

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { isSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: 'admin2@example.com',
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      const result = await isSuperAdmin();
      expect(result).toBe(true);
    });

    it('should return false when SUPER_ADMIN_EMAILS is empty', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = '';

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { isSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: 'anyone@example.com',
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      const result = await isSuperAdmin();
      expect(result).toBe(false);
    });
  });

  describe('requireSuperAdmin', () => {
    it('should return email if user is super admin', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { requireSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: SUPER_ADMIN_EMAIL,
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      const result = await requireSuperAdmin();
      expect(result).toEqual({ email: SUPER_ADMIN_EMAIL });
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should redirect to dashboard if not super admin', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { requireSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: 'regular@example.com',
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      await requireSuperAdmin();
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    });

    it('should redirect if no email found', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { requireSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: null,
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      mockDbSelect.mockResolvedValue([]);

      await requireSuperAdmin();
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    });

    it('should lookup email from database and allow super admin', async () => {
      vi.resetModules();
      process.env.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAIL;

      vi.doMock('server-only', () => ({}));
      vi.doMock('next/navigation', () => ({ redirect: mockRedirect }));
      vi.doMock('./dal', () => ({ verifySession: () => mockVerifySession() }));
      vi.doMock('@slack-speak/database', () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => mockDbSelect(),
              }),
            }),
          }),
        },
        users: {},
      }));

      const { requireSuperAdmin } = await import('./super-admin');

      mockVerifySession.mockResolvedValue({
        email: null,
        userId: 'U123',
        workspaceId: 'ws-123',
      });

      mockDbSelect.mockResolvedValue([{ email: SUPER_ADMIN_EMAIL }]);

      const result = await requireSuperAdmin();
      expect(result).toEqual({ email: SUPER_ADMIN_EMAIL });
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
