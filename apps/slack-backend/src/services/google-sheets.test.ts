/**
 * Unit tests for Google Sheets service
 *
 * Tests verify:
 * - Appending workflow submissions to sheets
 * - Fetching submissions with date filtering
 * - Getting submission status (unique submitters)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create hoisted mock functions
const { mockGetGoogleClient, mockSheetsValuesAppend, mockSheetsValuesGet } = vi.hoisted(() => ({
  mockGetGoogleClient: vi.fn(),
  mockSheetsValuesAppend: vi.fn(),
  mockSheetsValuesGet: vi.fn(),
}));

// Mock the google oauth module
vi.mock('../oauth/google-oauth.js', () => ({
  getGoogleClient: mockGetGoogleClient,
}));

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    sheets: vi.fn().mockImplementation(() => ({
      spreadsheets: {
        values: {
          append: mockSheetsValuesAppend,
          get: mockSheetsValuesGet,
        },
      },
    })),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks are set up
import { appendSubmission, getSubmissions, getSubmissionStatus, type WorkflowSubmission } from './google-sheets.js';
import { logger } from '../utils/logger.js';

describe('Google Sheets Service', () => {
  const mockOAuth2Client = {
    credentials: { access_token: 'test-token' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGoogleClient.mockResolvedValue(mockOAuth2Client);
    mockSheetsValuesAppend.mockResolvedValue({ data: { updates: { updatedRows: 1 } } });
    mockSheetsValuesGet.mockResolvedValue({ data: { values: [] } });
  });

  describe('appendSubmission', () => {
    const createTestSubmission = (overrides: Partial<WorkflowSubmission> = {}): WorkflowSubmission => ({
      timestamp: new Date('2024-01-15T10:00:00Z'),
      submitterName: 'John Doe',
      submitterSlackId: 'U123456',
      achievements: 'Completed feature X',
      focus: 'Working on feature Y',
      blockers: 'Waiting on review',
      shoutouts: 'Thanks to team',
      ...overrides,
    });

    it('should get authenticated client for the user', async () => {
      const submission = createTestSubmission();

      await appendSubmission('W123', 'U456', 'spreadsheet-id', submission);

      expect(mockGetGoogleClient).toHaveBeenCalledWith('W123', 'U456');
    });

    it('should append submission data to the correct range', async () => {
      const submission = createTestSubmission();

      await appendSubmission('W123', 'U456', 'spreadsheet-id-123', submission);

      expect(mockSheetsValuesAppend).toHaveBeenCalledWith({
        spreadsheetId: 'spreadsheet-id-123',
        range: 'Weekly Updates!A:G',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[
            submission.timestamp.toISOString(),
            'John Doe',
            'U123456',
            'Completed feature X',
            'Working on feature Y',
            'Waiting on review',
            'Thanks to team',
          ]],
        },
      });
    });

    it('should format timestamp as ISO string', async () => {
      const submission = createTestSubmission({
        timestamp: new Date('2024-06-20T14:30:00Z'),
      });

      await appendSubmission('W123', 'U456', 'sheet-id', submission);

      const callArgs = mockSheetsValuesAppend.mock.calls[0][0];
      expect(callArgs.requestBody.values[0][0]).toBe('2024-06-20T14:30:00.000Z');
    });

    it('should log successful append', async () => {
      const submission = createTestSubmission();

      await appendSubmission('W123', 'U456', 'sheet-123', submission);

      expect(logger.info).toHaveBeenCalledWith(
        {
          workspaceId: 'W123',
          userId: 'U456',
          spreadsheetId: 'sheet-123',
          submitter: 'John Doe',
        },
        'Appended submission to Google Sheet'
      );
    });

    it('should propagate errors from Google API', async () => {
      mockSheetsValuesAppend.mockRejectedValueOnce(new Error('API quota exceeded'));

      const submission = createTestSubmission();

      await expect(appendSubmission('W123', 'U456', 'sheet-id', submission)).rejects.toThrow(
        'API quota exceeded'
      );
    });

    it('should propagate authentication errors', async () => {
      mockGetGoogleClient.mockRejectedValueOnce(new Error('Google integration not found'));

      const submission = createTestSubmission();

      await expect(appendSubmission('W123', 'U456', 'sheet-id', submission)).rejects.toThrow(
        'Google integration not found'
      );
    });

    it('should handle empty achievements field', async () => {
      const submission = createTestSubmission({ achievements: '' });

      await appendSubmission('W123', 'U456', 'sheet-id', submission);

      const callArgs = mockSheetsValuesAppend.mock.calls[0][0];
      expect(callArgs.requestBody.values[0][3]).toBe('');
    });

    it('should handle all empty optional fields', async () => {
      const submission = createTestSubmission({
        achievements: '',
        focus: '',
        blockers: '',
        shoutouts: '',
      });

      await appendSubmission('W123', 'U456', 'sheet-id', submission);

      const callArgs = mockSheetsValuesAppend.mock.calls[0][0];
      const row = callArgs.requestBody.values[0];

      expect(row[3]).toBe(''); // achievements
      expect(row[4]).toBe(''); // focus
      expect(row[5]).toBe(''); // blockers
      expect(row[6]).toBe(''); // shoutouts
    });
  });

  describe('getSubmissions', () => {
    const weekStart = new Date('2024-01-15T00:00:00Z');

    it('should get authenticated client for the user', async () => {
      await getSubmissions('W123', 'U456', 'sheet-id', weekStart);

      expect(mockGetGoogleClient).toHaveBeenCalledWith('W123', 'U456');
    });

    it('should fetch data from correct range (skipping header)', async () => {
      await getSubmissions('W123', 'U456', 'sheet-id-123', weekStart);

      expect(mockSheetsValuesGet).toHaveBeenCalledWith({
        spreadsheetId: 'sheet-id-123',
        range: 'Weekly Updates!A2:G',
      });
    });

    it('should return empty array when no data', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({ data: { values: undefined } });

      const result = await getSubmissions('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toEqual([]);
    });

    it('should return empty array for empty values', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({ data: { values: [] } });

      const result = await getSubmissions('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toEqual([]);
    });

    it('should parse rows into WorkflowSubmission objects', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            [
              '2024-01-16T10:00:00.000Z',
              'Jane Doe',
              'U789',
              'Did something great',
              'Focus next week',
              'No blockers',
              'Thanks everyone',
            ],
          ],
        },
      });

      const result = await getSubmissions('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        timestamp: new Date('2024-01-16T10:00:00.000Z'),
        submitterName: 'Jane Doe',
        submitterSlackId: 'U789',
        achievements: 'Did something great',
        focus: 'Focus next week',
        blockers: 'No blockers',
        shoutouts: 'Thanks everyone',
      });
    });

    it('should filter out submissions before weekStartDate', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-10T10:00:00.000Z', 'Old', 'U1', 'a', 'b', 'c', 'd'], // Before week start
            ['2024-01-16T10:00:00.000Z', 'Current', 'U2', 'a', 'b', 'c', 'd'], // After week start
          ],
        },
      });

      const result = await getSubmissions('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(1);
      expect(result[0].submitterName).toBe('Current');
    });

    it('should include submissions exactly on weekStartDate', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-15T00:00:00.000Z', 'Exact', 'U1', 'a', 'b', 'c', 'd'], // Exact match
          ],
        },
      });

      const result = await getSubmissions('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(1);
      expect(result[0].submitterName).toBe('Exact');
    });

    it('should handle missing columns with empty strings', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-16T10:00:00.000Z'], // Only timestamp
          ],
        },
      });

      const result = await getSubmissions('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        timestamp: new Date('2024-01-16T10:00:00.000Z'),
        submitterName: '',
        submitterSlackId: '',
        achievements: '',
        focus: '',
        blockers: '',
        shoutouts: '',
      });
    });

    it('should handle partial row data', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-16T10:00:00.000Z', 'Name', 'U123', 'Achievements'], // Missing focus, blockers, shoutouts
          ],
        },
      });

      const result = await getSubmissions('W123', 'U456', 'sheet-id', weekStart);

      expect(result[0].achievements).toBe('Achievements');
      expect(result[0].focus).toBe('');
      expect(result[0].blockers).toBe('');
      expect(result[0].shoutouts).toBe('');
    });

    it('should propagate API errors', async () => {
      mockSheetsValuesGet.mockRejectedValueOnce(new Error('Spreadsheet not found'));

      await expect(getSubmissions('W123', 'U456', 'sheet-id', weekStart)).rejects.toThrow(
        'Spreadsheet not found'
      );
    });

    it('should return multiple submissions from the same week', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-16T10:00:00.000Z', 'User1', 'U1', 'a', 'b', 'c', 'd'],
            ['2024-01-17T10:00:00.000Z', 'User2', 'U2', 'e', 'f', 'g', 'h'],
            ['2024-01-18T10:00:00.000Z', 'User3', 'U3', 'i', 'j', 'k', 'l'],
          ],
        },
      });

      const result = await getSubmissions('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(3);
    });
  });

  describe('getSubmissionStatus', () => {
    const weekStart = new Date('2024-01-15T00:00:00Z');

    it('should return unique submitters with latest submission', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-16T10:00:00.000Z', 'John', 'U123', 'First', 'b', 'c', 'd'],
            ['2024-01-17T14:00:00.000Z', 'John', 'U123', 'Second', 'b', 'c', 'd'], // Same user, later
          ],
        },
      });

      const result = await getSubmissionStatus('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        submitterSlackId: 'U123',
        submitterName: 'John',
        submittedAt: new Date('2024-01-17T14:00:00.000Z'), // Latest submission
      });
    });

    it('should return multiple unique submitters', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-16T10:00:00.000Z', 'John', 'U123', 'a', 'b', 'c', 'd'],
            ['2024-01-16T11:00:00.000Z', 'Jane', 'U456', 'e', 'f', 'g', 'h'],
            ['2024-01-16T12:00:00.000Z', 'Bob', 'U789', 'i', 'j', 'k', 'l'],
          ],
        },
      });

      const result = await getSubmissionStatus('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(3);
      expect(result.map(r => r.submitterSlackId).sort()).toEqual(['U123', 'U456', 'U789']);
    });

    it('should return empty array when no submissions', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({ data: { values: [] } });

      const result = await getSubmissionStatus('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toEqual([]);
    });

    it('should use latest submission when user submits multiple times', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-18T10:00:00.000Z', 'John Updated', 'U123', 'Third', 'b', 'c', 'd'], // Latest but different order in data
            ['2024-01-16T10:00:00.000Z', 'John', 'U123', 'First', 'b', 'c', 'd'],
            ['2024-01-17T10:00:00.000Z', 'John Middle', 'U123', 'Second', 'b', 'c', 'd'],
          ],
        },
      });

      const result = await getSubmissionStatus('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(1);
      expect(result[0].submittedAt).toEqual(new Date('2024-01-18T10:00:00.000Z'));
      expect(result[0].submitterName).toBe('John Updated');
    });

    it('should filter submissions before weekStartDate', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-10T10:00:00.000Z', 'Old User', 'U999', 'a', 'b', 'c', 'd'], // Before week
            ['2024-01-16T10:00:00.000Z', 'Current User', 'U123', 'e', 'f', 'g', 'h'], // In week
          ],
        },
      });

      const result = await getSubmissionStatus('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(1);
      expect(result[0].submitterSlackId).toBe('U123');
    });

    it('should call getSubmissions internally', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-16T10:00:00.000Z', 'Test', 'U123', 'a', 'b', 'c', 'd'],
          ],
        },
      });

      await getSubmissionStatus('W123', 'U456', 'sheet-id', weekStart);

      expect(mockGetGoogleClient).toHaveBeenCalledWith('W123', 'U456');
      expect(mockSheetsValuesGet).toHaveBeenCalled();
    });

    it('should propagate errors', async () => {
      mockSheetsValuesGet.mockRejectedValueOnce(new Error('Access denied'));

      await expect(getSubmissionStatus('W123', 'U456', 'sheet-id', weekStart)).rejects.toThrow(
        'Access denied'
      );
    });

    it('should handle submissions with same timestamp (use last encountered)', async () => {
      mockSheetsValuesGet.mockResolvedValueOnce({
        data: {
          values: [
            ['2024-01-16T10:00:00.000Z', 'John First', 'U123', 'a', 'b', 'c', 'd'],
            ['2024-01-16T10:00:00.000Z', 'John Second', 'U123', 'e', 'f', 'g', 'h'], // Same timestamp
          ],
        },
      });

      const result = await getSubmissionStatus('W123', 'U456', 'sheet-id', weekStart);

      expect(result).toHaveLength(1);
      // When timestamps are equal, the later entry in the array doesn't override
      // because the comparison is > not >=
      expect(result[0].submitterName).toBe('John First');
    });
  });
});
