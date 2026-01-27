import { google } from 'googleapis';
import { getGoogleClient } from '../oauth/google-oauth.js';
import { logger } from '../utils/logger.js';

export interface WorkflowSubmission {
  timestamp: Date;
  submitterName: string;
  submitterSlackId: string;
  achievements: string;
  focus: string;
  blockers: string;
  shoutouts: string;
}

/**
 * Append a workflow submission to the user's configured Google Sheet
 */
export async function appendSubmission(
  workspaceId: string,
  userId: string,
  spreadsheetId: string,
  submission: WorkflowSubmission
): Promise<void> {
  const oauth2Client = await getGoogleClient(workspaceId, userId);
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  const values = [[
    submission.timestamp.toISOString(),
    submission.submitterName,
    submission.submitterSlackId,
    submission.achievements,
    submission.focus,
    submission.blockers,
    submission.shoutouts,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Weekly Updates!A:G', // Columns: timestamp, name, slackId, achievements, focus, blockers, shoutouts
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  logger.info({
    workspaceId,
    userId,
    spreadsheetId,
    submitter: submission.submitterName,
  }, 'Appended submission to Google Sheet');
}

/**
 * Get all submissions from this week
 */
export async function getSubmissions(
  workspaceId: string,
  userId: string,
  spreadsheetId: string,
  weekStartDate: Date
): Promise<WorkflowSubmission[]> {
  const oauth2Client = await getGoogleClient(workspaceId, userId);
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Weekly Updates!A2:G', // Skip header row
  });

  const rows = result.data.values || [];

  return rows
    .map((row) => ({
      timestamp: new Date(row[0]),
      submitterName: row[1] || '',
      submitterSlackId: row[2] || '',
      achievements: row[3] || '',
      focus: row[4] || '',
      blockers: row[5] || '',
      shoutouts: row[6] || '',
    }))
    .filter((sub) => sub.timestamp >= weekStartDate);
}

/**
 * Get submission status - who has submitted this week
 */
export async function getSubmissionStatus(
  workspaceId: string,
  userId: string,
  spreadsheetId: string,
  weekStartDate: Date
): Promise<{ submitterSlackId: string; submitterName: string; submittedAt: Date }[]> {
  const submissions = await getSubmissions(workspaceId, userId, spreadsheetId, weekStartDate);

  // Get unique submitters (latest submission per person)
  const submitterMap = new Map<string, { submitterSlackId: string; submitterName: string; submittedAt: Date }>();

  for (const sub of submissions) {
    const existing = submitterMap.get(sub.submitterSlackId);
    if (!existing || sub.timestamp > existing.submittedAt) {
      submitterMap.set(sub.submitterSlackId, {
        submitterSlackId: sub.submitterSlackId,
        submitterName: sub.submitterName,
        submittedAt: sub.timestamp,
      });
    }
  }

  return Array.from(submitterMap.values());
}
