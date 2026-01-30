/**
 * Unit tests for /generate-report command handler
 *
 * Tests verify:
 * - Command acknowledgment (3-second requirement)
 * - Google integration validation
 * - Spreadsheet configuration check
 * - Report generation job queuing
 * - Error handling and responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { App, SlashCommand, AckFn, RespondFn } from '@slack/bolt';

// Create hoisted mock functions
const { mockDbSelect, mockQueueReportGeneration } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockQueueReportGeneration: vi.fn(),
}));

// Mock database
vi.mock('@slack-speak/database', () => ({
  db: {
    select: mockDbSelect,
  },
  googleIntegrations: {
    workspaceId: 'workspaceId',
    userId: 'userId',
  },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
}));

// Mock queues
vi.mock('../../jobs/queues.js', () => ({
  queueReportGeneration: mockQueueReportGeneration,
}));

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import { registerGenerateReportCommand } from './generate-report.js';
import { logger } from '../../utils/logger.js';

describe('Generate Report Command', () => {
  let mockApp: Partial<App>;
  let commandHandler: (args: {
    command: Partial<SlashCommand>;
    ack: AckFn<void>;
    respond: RespondFn;
  }) => Promise<void>;

  // Helper to create mock command
  const createMockCommand = (overrides: Partial<SlashCommand> = {}): Partial<SlashCommand> => ({
    team_id: 'T123',
    user_id: 'U456',
    channel_id: 'C789',
    command: '/generate-report',
    text: '',
    response_url: 'https://hooks.slack.com/commands/T123/456/abc',
    trigger_id: 'trigger_123',
    ...overrides,
  });

  // Helper to create mock integration
  const createMockIntegration = (overrides: Record<string, unknown> = {}) => ({
    workspaceId: 'T123',
    userId: 'U456',
    spreadsheetId: 'spreadsheet-123',
    accessToken: 'encrypted-token',
    refreshToken: 'encrypted-refresh',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Capture handler when registered
    mockApp = {
      command: vi.fn((commandName: string, handler: unknown) => {
        if (commandName === '/generate-report') {
          commandHandler = handler as typeof commandHandler;
        }
      }),
    };

    // Default: no integration found
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockQueueReportGeneration.mockResolvedValue({ id: 'job-123' });

    registerGenerateReportCommand(mockApp as App);
  });

  it('should register handler for /generate-report command', () => {
    expect(mockApp.command).toHaveBeenCalledWith('/generate-report', expect.any(Function));
  });

  describe('Command acknowledgment', () => {
    it('should call ack() immediately (3-second requirement)', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(ack).toHaveBeenCalled();
      // ack should be called first
      expect(ack.mock.invocationCallOrder[0]).toBeLessThan(
        respond.mock.invocationCallOrder[0] || Infinity
      );
    });

    it('should acknowledge before checking integration', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      // ack should be called before db select
      expect(ack.mock.invocationCallOrder[0]).toBeLessThan(
        mockDbSelect.mock.invocationCallOrder[0] || Infinity
      );
    });
  });

  describe('Google integration validation', () => {
    it('should check for Google integration', async () => {
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({
        team_id: 'TWORKSPACE',
        user_id: 'UUSER',
      });

      await commandHandler({ command, ack, respond });

      expect(mockDbSelect).toHaveBeenCalled();
    });

    it('should respond with error when no integration found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No integration
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('No Google integration found'),
          response_type: 'ephemeral',
        })
      );
      expect(mockQueueReportGeneration).not.toHaveBeenCalled();
    });

    it('should include guidance in no-integration error', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('web portal'),
        })
      );
    });
  });

  describe('Spreadsheet configuration check', () => {
    it('should check for spreadsheetId in integration', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockIntegration({ spreadsheetId: null }), // No spreadsheet
            ]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('No spreadsheet configured'),
          response_type: 'ephemeral',
        })
      );
      expect(mockQueueReportGeneration).not.toHaveBeenCalled();
    });

    it('should include guidance in no-spreadsheet error', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockIntegration({ spreadsheetId: null }),
            ]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('web portal'),
        })
      );
    });

    it('should proceed when integration has spreadsheetId', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockIntegration({ spreadsheetId: 'sheet-123' }),
            ]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(mockQueueReportGeneration).toHaveBeenCalled();
    });
  });

  describe('Report generation queuing', () => {
    it('should queue report generation with correct data', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockIntegration({
                spreadsheetId: 'spreadsheet-abc',
              }),
            ]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({
        team_id: 'TTEAM',
        user_id: 'UUSER',
        response_url: 'https://hooks.slack.com/response',
      });

      await commandHandler({ command, ack, respond });

      expect(mockQueueReportGeneration).toHaveBeenCalledWith({
        workspaceId: 'TTEAM',
        userId: 'UUSER',
        spreadsheetId: 'spreadsheet-abc',
        responseUrl: 'https://hooks.slack.com/response',
      });
    });

    it('should respond with success message after queuing', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockIntegration(),
            ]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Generating your weekly report'),
          response_type: 'ephemeral',
        })
      );
    });

    it('should mention DM delivery in success message', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockIntegration(),
            ]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('DMs'),
        })
      );
    });

    it('should log successful queue', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockIntegration({ spreadsheetId: 'sheet-123' }),
            ]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({
        team_id: 'TLOG',
        user_id: 'ULOG',
      });

      await commandHandler({ command, ack, respond });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'TLOG',
          userId: 'ULOG',
          spreadsheetId: 'sheet-123',
        }),
        'Report generation queued'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle queue failure gracefully', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              createMockIntegration(),
            ]),
          }),
        }),
      });
      mockQueueReportGeneration.mockRejectedValueOnce(new Error('Queue unavailable'));

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Failed to queue report generation'),
          response_type: 'ephemeral',
        })
      );
    });

    it('should handle database query failure', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Failed'),
          response_type: 'ephemeral',
        })
      );
    });

    it('should log errors', async () => {
      const testError = new Error('Test error');
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(testError),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({
        team_id: 'TERR',
        user_id: 'UERR',
      });

      await commandHandler({ command, ack, respond });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: testError,
          workspaceId: 'TERR',
          userId: 'UERR',
        }),
        'Failed to queue report generation'
      );
    });

    it('should suggest retry in error message', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Error')),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('try again'),
        })
      );
    });
  });

  describe('Command parameters', () => {
    it('should use team_id as workspaceId', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockIntegration()]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({ team_id: 'TMYTEAM' });

      await commandHandler({ command, ack, respond });

      expect(mockQueueReportGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'TMYTEAM',
        })
      );
    });

    it('should use user_id from command', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockIntegration()]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({ user_id: 'UMYUSER' });

      await commandHandler({ command, ack, respond });

      expect(mockQueueReportGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'UMYUSER',
        })
      );
    });

    it('should include response_url for async delivery', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockIntegration()]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({
        response_url: 'https://hooks.slack.com/commands/T123/B456/xyz',
      });

      await commandHandler({ command, ack, respond });

      expect(mockQueueReportGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          responseUrl: 'https://hooks.slack.com/commands/T123/B456/xyz',
        })
      );
    });
  });

  describe('Response type', () => {
    it('should always respond with ephemeral messages', async () => {
      // Test for no integration
      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          response_type: 'ephemeral',
        })
      );
    });

    it('should respond ephemerally on success', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([createMockIntegration()]),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          response_type: 'ephemeral',
        })
      );
    });

    it('should respond ephemerally on error', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Error')),
          }),
        }),
      });

      const ack = vi.fn().mockResolvedValue(undefined);
      const respond = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand();

      await commandHandler({ command, ack, respond });

      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          response_type: 'ephemeral',
        })
      );
    });
  });
});
