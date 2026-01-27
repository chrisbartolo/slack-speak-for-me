import Anthropic from '@anthropic-ai/sdk';
import { startOfWeek } from 'date-fns';
import { env } from '../env.js';
import { getSubmissions, type WorkflowSubmission } from './google-sheets.js';
import { db, reportSettings as reportSettingsTable } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

interface GenerateReportOptions {
  workspaceId: string;
  userId: string;
  spreadsheetId: string;
  weekStartDate?: Date; // Defaults to this week's Monday
}

interface ReportResult {
  report: string;
  missingSubmitters: string[];
  processingTimeMs: number;
}

interface ReportSettings {
  format: 'concise' | 'detailed';
  sections: string[];
}

/**
 * Get user's report settings from database
 */
export async function getReportSettings(
  workspaceId: string,
  userId: string
): Promise<ReportSettings> {
  const settings = await db
    .select()
    .from(reportSettingsTable)
    .where(
      and(
        eq(reportSettingsTable.workspaceId, workspaceId),
        eq(reportSettingsTable.userId, userId)
      )
    )
    .limit(1);

  if (settings.length === 0) {
    // Default settings
    return {
      format: 'detailed',
      sections: ['achievements', 'focus', 'blockers', 'shoutouts'],
    };
  }

  return {
    format: (settings[0].format || 'detailed') as 'concise' | 'detailed',
    sections: settings[0].sections || ['achievements', 'focus', 'blockers', 'shoutouts'],
  };
}

/**
 * Get team members who haven't submitted this week
 */
export async function getMissingSubmitters(
  workspaceId: string,
  userId: string,
  spreadsheetId: string,
  teamMemberSlackIds: string[]
): Promise<string[]> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday

  const submissions = await getSubmissions(workspaceId, userId, spreadsheetId, weekStart);
  const submittedIds = new Set(submissions.map(s => s.submitterSlackId));

  return teamMemberSlackIds.filter(id => !submittedIds.has(id));
}

/**
 * Generate AI-powered weekly report from submissions
 */
export async function generateWeeklyReport(
  options: GenerateReportOptions
): Promise<ReportResult> {
  const startTime = Date.now();

  // Default to this week's Monday
  const weekStart = options.weekStartDate || startOfWeek(new Date(), { weekStartsOn: 1 });

  // Fetch submissions
  const submissions = await getSubmissions(
    options.workspaceId,
    options.userId,
    options.spreadsheetId,
    weekStart
  );

  if (submissions.length === 0) {
    return {
      report: 'No submissions found for this week.',
      missingSubmitters: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Get user's report settings
  const settings = await getReportSettings(options.workspaceId, options.userId);

  // Build prompt based on settings
  const formatInstruction = settings.format === 'concise'
    ? 'Keep each section brief - use bullet points with 1-2 sentence summaries per major theme.'
    : 'Provide comprehensive summaries with full context and details for each section.';

  const sectionsToInclude = settings.sections.join(', ');

  const systemPrompt = `You are a helpful assistant that creates board-ready weekly reports from team submission data.

Your report should:
- Aggregate multiple team member submissions into a cohesive narrative
- Focus on high-level themes and patterns across the team
- Be appropriate for executive/board presentation
- ${formatInstruction}
- Only include these sections: ${sectionsToInclude}

Format the report with clear section headers and professional language.`;

  // Format submissions for the prompt
  const submissionsText = submissions.map(sub => {
    const parts = [`**${sub.submitterName}** (submitted ${sub.timestamp.toLocaleDateString()}):`];

    if (settings.sections.includes('achievements') && sub.achievements) {
      parts.push(`Achievements: ${sub.achievements}`);
    }
    if (settings.sections.includes('focus') && sub.focus) {
      parts.push(`Focus: ${sub.focus}`);
    }
    if (settings.sections.includes('blockers') && sub.blockers) {
      parts.push(`Blockers: ${sub.blockers}`);
    }
    if (settings.sections.includes('shoutouts') && sub.shoutouts) {
      parts.push(`Shoutouts: ${sub.shoutouts}`);
    }

    return parts.join('\n');
  }).join('\n\n---\n\n');

  const userPrompt = `Here are the team submissions for the week of ${weekStart.toLocaleDateString()}:

${submissionsText}

Please create a board-ready weekly report that summarizes these submissions. Group by theme rather than by person, and highlight the most important information for executive review.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const report = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Error: Unable to generate report';

    const processingTimeMs = Date.now() - startTime;

    logger.info({
      workspaceId: options.workspaceId,
      userId: options.userId,
      submissionCount: submissions.length,
      processingTimeMs,
      format: settings.format,
      sections: settings.sections,
    }, 'Weekly report generated');

    return {
      report,
      missingSubmitters: [], // Will be populated by caller using getMissingSubmitters
      processingTimeMs,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to generate weekly report');
    throw error;
  }
}
