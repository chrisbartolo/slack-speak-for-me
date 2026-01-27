import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startOfWeek } from 'date-fns';

// Use vi.hoisted to create mock functions accessible in the mock factory
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

const { mockGetSubmissions } = vi.hoisted(() => ({
  mockGetSubmissions: vi.fn(),
}));

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Mock env module
vi.mock('../env.js', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    NODE_ENV: 'test',
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Google Sheets service
vi.mock('./google-sheets.js', () => ({
  getSubmissions: mockGetSubmissions,
}));

// Mock database with proper query chain
vi.mock('@slack-speak/database', async () => {
  const actual = await vi.importActual<typeof import('@slack-speak/database')>('@slack-speak/database');
  return {
    ...actual,
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: mockDbSelect,
          })),
        })),
      })),
    },
  };
});

// Import after mocks are set up
import { generateWeeklyReport, getMissingSubmitters, getReportSettings } from './report-generator.js';
import type { WorkflowSubmission } from './google-sheets.js';

// Test constants
const TEST_WORKSPACE_ID = 'W123456789';
const TEST_USER_ID = 'U123456789';
const TEST_SPREADSHEET_ID = 'spreadsheet-123';

// Helper to create mock submission
function createMockSubmission(overrides: Partial<WorkflowSubmission> = {}): WorkflowSubmission {
  return {
    timestamp: new Date('2026-01-27T10:00:00Z'),
    submitterName: 'Test User',
    submitterSlackId: 'U111111111',
    achievements: 'Completed project A',
    focus: 'Starting project B',
    blockers: 'Need approval from manager',
    shoutouts: 'Thanks to @teammate',
    ...overrides,
  };
}

// Helper to create a standard successful response
function createMockResponse(text: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

describe('Report Generator Service', () => {
  describe('getReportSettings', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return user settings from database', async () => {
      mockDbSelect.mockResolvedValue([
        {
          format: 'concise',
          sections: ['achievements', 'blockers'],
        },
      ]);

      const settings = await getReportSettings(TEST_WORKSPACE_ID, TEST_USER_ID);

      expect(settings).toEqual({
        format: 'concise',
        sections: ['achievements', 'blockers'],
      });
    });

    it('should return default settings when no user settings exist', async () => {
      mockDbSelect.mockResolvedValue([]);

      const settings = await getReportSettings(TEST_WORKSPACE_ID, TEST_USER_ID);

      expect(settings).toEqual({
        format: 'detailed',
        sections: ['achievements', 'focus', 'blockers', 'shoutouts'],
      });
    });
  });

  describe('getMissingSubmitters', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should identify team members who have not submitted', async () => {
      const teamMembers = ['U111111111', 'U222222222', 'U333333333'];

      mockGetSubmissions.mockResolvedValue([
        createMockSubmission({ submitterSlackId: 'U111111111' }),
        createMockSubmission({ submitterSlackId: 'U333333333' }),
      ]);

      const missing = await getMissingSubmitters(
        TEST_WORKSPACE_ID,
        TEST_USER_ID,
        TEST_SPREADSHEET_ID,
        teamMembers
      );

      expect(missing).toEqual(['U222222222']);
      expect(mockGetSubmissions).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when all team members have submitted', async () => {
      const teamMembers = ['U111111111', 'U222222222'];

      mockGetSubmissions.mockResolvedValue([
        createMockSubmission({ submitterSlackId: 'U111111111' }),
        createMockSubmission({ submitterSlackId: 'U222222222' }),
      ]);

      const missing = await getMissingSubmitters(
        TEST_WORKSPACE_ID,
        TEST_USER_ID,
        TEST_SPREADSHEET_ID,
        teamMembers
      );

      expect(missing).toEqual([]);
    });
  });

  describe('generateWeeklyReport', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockCreate.mockResolvedValue(createMockResponse('# Weekly Report\n\n## Achievements\n\nThe team completed several key projects this week.'));
      mockDbSelect.mockResolvedValue([
        {
          format: 'detailed',
          sections: ['achievements', 'focus', 'blockers', 'shoutouts'],
        },
      ]);
    });

    it('should generate report from submissions', async () => {
      const submissions = [
        createMockSubmission({
          submitterName: 'Alice',
          submitterSlackId: 'U111111111',
          achievements: 'Launched feature X',
        }),
        createMockSubmission({
          submitterName: 'Bob',
          submitterSlackId: 'U222222222',
          achievements: 'Fixed bug Y',
        }),
      ];

      mockGetSubmissions.mockResolvedValue(submissions);

      const result = await generateWeeklyReport({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        spreadsheetId: TEST_SPREADSHEET_ID,
      });

      expect(result.report).toContain('Weekly Report');
      expect(result.report).toContain('Achievements');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Verify the call was made with correct model and structure
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('claude-sonnet-4-20250514');
      expect(callArgs.max_tokens).toBe(2048);
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].role).toBe('user');
      expect(callArgs.messages[0].content).toContain('Alice');
      expect(callArgs.messages[0].content).toContain('Bob');
      expect(callArgs.messages[0].content).toContain('Launched feature X');
      expect(callArgs.messages[0].content).toContain('Fixed bug Y');
    });

    it('should handle empty submissions', async () => {
      mockGetSubmissions.mockResolvedValue([]);

      const result = await generateWeeklyReport({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        spreadsheetId: TEST_SPREADSHEET_ID,
      });

      expect(result.report).toBe('No submissions found for this week.');
      expect(result.missingSubmitters).toEqual([]);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should use custom week start date if provided', async () => {
      const customWeekStart = new Date('2026-01-20');
      mockGetSubmissions.mockResolvedValue([
        createMockSubmission({ submitterName: 'Charlie' }),
      ]);

      await generateWeeklyReport({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        spreadsheetId: TEST_SPREADSHEET_ID,
        weekStartDate: customWeekStart,
      });

      expect(mockGetSubmissions).toHaveBeenCalledWith(
        TEST_WORKSPACE_ID,
        TEST_USER_ID,
        TEST_SPREADSHEET_ID,
        customWeekStart
      );
    });

    it('should use current week Monday by default', async () => {
      mockGetSubmissions.mockResolvedValue([
        createMockSubmission({ submitterName: 'Dave' }),
      ]);

      await generateWeeklyReport({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        spreadsheetId: TEST_SPREADSHEET_ID,
      });

      const expectedWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

      expect(mockGetSubmissions).toHaveBeenCalledWith(
        TEST_WORKSPACE_ID,
        TEST_USER_ID,
        TEST_SPREADSHEET_ID,
        expect.any(Date)
      );

      // Verify the date is this week's Monday (allow 1 day tolerance for test timing)
      const actualDate = mockGetSubmissions.mock.calls[0][3] as Date;
      const timeDiff = Math.abs(actualDate.getTime() - expectedWeekStart.getTime());
      expect(timeDiff).toBeLessThan(24 * 60 * 60 * 1000); // Less than 1 day difference
    });

    it('should respect format setting in prompt', async () => {
      mockDbSelect.mockResolvedValue([
        {
          format: 'concise',
          sections: ['achievements', 'blockers'],
        },
      ]);

      mockGetSubmissions.mockResolvedValue([
        createMockSubmission({ submitterName: 'Eve' }),
      ]);

      await generateWeeklyReport({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        spreadsheetId: TEST_SPREADSHEET_ID,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system).toContain('brief');
      expect(callArgs.system).toContain('bullet points');
      expect(callArgs.system).toContain('achievements, blockers');
    });

    it('should only include selected sections in prompt', async () => {
      mockDbSelect.mockResolvedValue([
        {
          format: 'detailed',
          sections: ['achievements', 'focus'],
        },
      ]);

      mockGetSubmissions.mockResolvedValue([
        createMockSubmission({
          submitterName: 'Frank',
          achievements: 'Did A',
          focus: 'Will do B',
          blockers: 'Blocker C',
          shoutouts: 'Shoutout D',
        }),
      ]);

      await generateWeeklyReport({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
        spreadsheetId: TEST_SPREADSHEET_ID,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      const userPrompt = callArgs.messages[0].content;

      expect(userPrompt).toContain('Achievements: Did A');
      expect(userPrompt).toContain('Focus: Will do B');
      expect(userPrompt).not.toContain('Blocker C');
      expect(userPrompt).not.toContain('Shoutout D');
    });
  });
});
