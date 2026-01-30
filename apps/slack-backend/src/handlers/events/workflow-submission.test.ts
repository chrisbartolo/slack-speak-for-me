/**
 * Unit tests for Workflow Submission event handler
 *
 * Tests verify:
 * - Bot message detection
 * - Workflow submission parsing from message blocks
 * - Config lookup and Google integration check
 * - Queuing sheets write operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { App } from '@slack/bolt';

// Create hoisted mock functions
const { mockDbSelect, mockDbUpdate, mockQueueSheetsWrite } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockQueueSheetsWrite: vi.fn(),
}));

// Mock database
vi.mock('@slack-speak/database', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
  workflowConfig: {
    id: 'id',
    workspaceId: 'workspaceId',
    userId: 'userId',
    channelId: 'channelId',
    enabled: 'enabled',
    workflowBotId: 'workflowBotId',
    updatedAt: 'updatedAt',
  },
  workspaces: {
    id: 'id',
  },
  googleIntegrations: {
    workspaceId: 'workspaceId',
    userId: 'userId',
    spreadsheetId: 'spreadsheetId',
  },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
}));

// Mock queues
vi.mock('../../jobs/queues.js', () => ({
  queueSheetsWrite: mockQueueSheetsWrite,
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
import { registerWorkflowSubmissionHandler } from './workflow-submission.js';
import { logger } from '../../utils/logger.js';

describe('Workflow Submission Handler', () => {
  let mockApp: Partial<App>;
  let messageHandler: (args: { event: unknown }) => Promise<void>;

  // Helper to create a bot message event
  const createBotMessage = (overrides: Record<string, unknown> = {}) => ({
    type: 'message',
    subtype: 'bot_message',
    bot_id: 'B123456',
    channel: 'C123456',
    ts: '1705400000.000000',
    username: 'Workflow Bot',
    blocks: [],
    ...overrides,
  });

  // Helper to create workflow submission blocks
  const createSubmissionBlocks = (fields: Record<string, string> = {}) => {
    const defaultFields = {
      achievements: 'Completed feature X',
      focus: 'Working on feature Y',
      blockers: 'Waiting on review',
      shoutouts: 'Thanks to the team',
      ...fields,
    };

    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Achievements*\n${defaultFields.achievements}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Focus*\n${defaultFields.focus}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Blockers*\n${defaultFields.blockers}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Shoutouts*\n${defaultFields.shoutouts}` },
      },
    ];
  };

  // Helper to create mock config result
  const createConfigResult = (overrides: Record<string, unknown> = {}) => ({
    config: {
      id: 'config-123',
      workspaceId: 'W123',
      userId: 'U456',
      channelId: 'C123456',
      enabled: true,
      workflowBotId: null,
      ...overrides.config as object,
    },
    workspace: {
      id: 'W123',
      teamId: 'T123',
    },
    googleIntegration: {
      spreadsheetId: 'spreadsheet-123',
      ...overrides.googleIntegration as object,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Capture handler when registered
    mockApp = {
      event: vi.fn((eventType: string, handler: unknown) => {
        if (eventType === 'message') {
          messageHandler = handler as typeof messageHandler;
        }
      }),
    };

    // Default: no matching configs
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockQueueSheetsWrite.mockResolvedValue({ id: 'job-123' });

    registerWorkflowSubmissionHandler(mockApp as App);
  });

  it('should register handler for message event', () => {
    expect(mockApp.event).toHaveBeenCalledWith('message', expect.any(Function));
  });

  describe('Bot message detection', () => {
    it('should ignore non-bot messages (no subtype)', async () => {
      const event = {
        type: 'message',
        user: 'U123',
        channel: 'C456',
        text: 'Hello',
        ts: '123.456',
      };

      await messageHandler({ event });

      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it('should ignore messages without bot_id', async () => {
      const event = {
        type: 'message',
        subtype: 'bot_message',
        // No bot_id
        channel: 'C456',
        ts: '123.456',
      };

      await messageHandler({ event });

      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it('should process bot messages with bot_id', async () => {
      const event = createBotMessage({
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockDbSelect).toHaveBeenCalled();
    });

    it('should ignore file_share subtype', async () => {
      const event = {
        type: 'message',
        subtype: 'file_share',
        user: 'U123',
        channel: 'C456',
        ts: '123.456',
      };

      await messageHandler({ event });

      expect(mockDbSelect).not.toHaveBeenCalled();
    });
  });

  describe('Config lookup', () => {
    it('should query configs for the message channel', async () => {
      const event = createBotMessage({
        channel: 'CTEST123',
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockDbSelect).toHaveBeenCalled();
    });

    it('should return early when no configs found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).not.toHaveBeenCalled();
    });

    it('should process when configs are found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalled();
    });
  });

  describe('Workflow submission parsing', () => {
    it('should parse achievements from section blocks', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: createSubmissionBlocks({ achievements: 'My great achievement' }),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            achievements: 'My great achievement',
          }),
        })
      );
    });

    it('should parse focus from section blocks', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: createSubmissionBlocks({ focus: 'Next week focus' }),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            focus: 'Next week focus',
          }),
        })
      );
    });

    it('should parse blockers from section blocks', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: createSubmissionBlocks({ blockers: 'Need help with X' }),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            blockers: 'Need help with X',
          }),
        })
      );
    });

    it('should parse shoutouts from section blocks', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: createSubmissionBlocks({ shoutouts: 'Thanks to Alice' }),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            shoutouts: 'Thanks to Alice',
          }),
        })
      );
    });

    it('should handle alternative field names (accomplishments)', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Accomplishments*\nDid something' },
          },
        ],
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            achievements: 'Did something',
          }),
        })
      );
    });

    it('should handle alternative field names (next week)', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Achievements*\nDone' },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Next Week*\nPlanned work' },
          },
        ],
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            focus: 'Planned work',
          }),
        })
      );
    });

    it('should handle alternative field names (challenges)', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Achievements*\nDone' },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Challenges*\nHard problem' },
          },
        ],
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            blockers: 'Hard problem',
          }),
        })
      );
    });

    it('should return null for messages without required fields', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Random Field*\nSome value' },
          },
        ],
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: expect.any(String) }),
        'Message is not a workflow submission'
      );
    });

    it('should handle empty blocks array', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({ blocks: [] });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).not.toHaveBeenCalled();
    });

    it('should extract submitter info from username', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        username: 'John Doe',
        user: 'U789',
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            submitterName: 'John Doe',
            submitterSlackId: 'U789',
          }),
        })
      );
    });

    it('should use bot_id as fallback for submitterSlackId', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        username: 'Bot Name',
        bot_id: 'B999',
        // No user field
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            submitterSlackId: 'B999',
          }),
        })
      );
    });
  });

  describe('Google integration check', () => {
    it('should skip config without spreadsheetId', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                createConfigResult({
                  googleIntegration: { spreadsheetId: null },
                }),
              ]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ configId: 'config-123' }),
        'Skipping - no Google Sheets configured'
      );
    });

    it('should skip config without googleIntegration', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  config: { id: 'config-123', workspaceId: 'W123', userId: 'U456' },
                  workspace: { id: 'W123' },
                  googleIntegration: null,
                },
              ]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).not.toHaveBeenCalled();
    });
  });

  describe('Workflow bot ID tracking', () => {
    it('should store bot_id on first submission', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                createConfigResult({
                  config: { workflowBotId: null }, // Not set yet
                }),
              ]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        bot_id: 'BNEW123',
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it('should not update bot_id if already set', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                createConfigResult({
                  config: { workflowBotId: 'BEXISTING' }, // Already set
                }),
              ]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        bot_id: 'BNEW123',
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Queue sheets write', () => {
    it('should queue write with correct data', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        ts: '1705400000.123456',
        username: 'Test User',
        user: 'U111',
        blocks: createSubmissionBlocks({
          achievements: 'A',
          focus: 'F',
          blockers: 'B',
          shoutouts: 'S',
        }),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith({
        workspaceId: 'W123',
        userId: 'U456',
        spreadsheetId: 'spreadsheet-123',
        submission: {
          timestamp: expect.any(String),
          submitterName: 'Test User',
          submitterSlackId: 'U111',
          achievements: 'A',
          focus: 'F',
          blockers: 'B',
          shoutouts: 'S',
        },
      });
    });

    it('should convert ts to timestamp', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        ts: '1705400000.000000', // Epoch timestamp
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      const queueCall = mockQueueSheetsWrite.mock.calls[0][0];
      const timestamp = new Date(queueCall.submission.timestamp);

      expect(timestamp.getTime()).toBe(1705400000000);
    });

    it('should process multiple configs for same channel', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                createConfigResult(),
                createConfigResult({
                  config: { id: 'config-456', userId: 'U789' },
                  googleIntegration: { spreadsheetId: 'spreadsheet-456' },
                }),
              ]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledTimes(2);
    });

    it('should log successful queue', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        username: 'Test User',
        blocks: createSubmissionBlocks(),
      });

      await messageHandler({ event });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          configId: 'config-123',
          userId: 'U456',
          submitter: 'Test User',
        }),
        'Queued workflow submission write'
      );
    });
  });

  describe('Rich text block parsing', () => {
    it('should parse rich_text blocks with label: value format', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: [
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: 'achievements: Did great work' },
                ],
              },
            ],
          },
        ],
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            achievements: 'Did great work',
          }),
        })
      );
    });

    it('should handle mixed block types', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([createConfigResult()]),
            }),
          }),
        }),
      });

      const event = createBotMessage({
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Achievements*\nFrom section' },
          },
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: 'focus: From rich text' },
                ],
              },
            ],
          },
        ],
      });

      await messageHandler({ event });

      expect(mockQueueSheetsWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            achievements: 'From section',
            focus: 'From rich text',
          }),
        })
      );
    });
  });
});
