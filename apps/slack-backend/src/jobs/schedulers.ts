import { db, reportSettings as reportSettingsTable } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { reportQueue, usageReporterQueue, escalationScanQueue, dataRetentionQueue } from './queues.js';
import { logger } from '../utils/logger.js';
import type { ReportGenerationJobData, UsageReporterJobData, EscalationScanJobData, DataRetentionJobData } from './types.js';

/**
 * Convert day of week (0-6) and time (HH:mm) to cron pattern
 * dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday
 * timeOfDay: "HH:mm" format (e.g., "09:00")
 */
function toCronPattern(dayOfWeek: number, timeOfDay: string): string {
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  // Cron format: minute hour day-of-month month day-of-week
  // Day-of-week in cron: 0=Sunday, 1=Monday, ..., 6=Saturday (same as our convention)
  return `${minutes} ${hours} * * ${dayOfWeek}`;
}

/**
 * Get scheduler ID for a report
 */
function getSchedulerId(workspaceId: string, userId: string): string {
  return `report-${workspaceId}-${userId}`;
}

/**
 * Create or update a BullMQ Job Scheduler for a user's weekly report
 */
export async function upsertReportScheduler(
  workspaceId: string,
  userId: string
): Promise<void> {
  try {
    // Fetch the user's report settings
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
      logger.warn(
        { workspaceId, userId },
        'No report settings found for upsertReportScheduler'
      );
      return;
    }

    const setting = settings[0];

    // If disabled, remove any existing scheduler
    if (!setting.enabled) {
      await removeReportScheduler(workspaceId, userId);
      return;
    }

    // Check for required fields
    if (!setting.dayOfWeek || !setting.timeOfDay || !setting.timezone) {
      logger.warn(
        { workspaceId, userId, setting },
        'Incomplete report settings for scheduler'
      );
      return;
    }

    // Convert to cron pattern
    const cronPattern = toCronPattern(setting.dayOfWeek, setting.timeOfDay);
    const schedulerId = getSchedulerId(workspaceId, userId);

    // Create job data (spreadsheetId will be fetched by worker from googleIntegrations)
    const jobData: ReportGenerationJobData = {
      workspaceId,
      userId,
      spreadsheetId: '', // Worker will fetch from googleIntegrations table
    };

    // Upsert the job scheduler
    await reportQueue.upsertJobScheduler(
      schedulerId,
      {
        pattern: cronPattern,
        tz: setting.timezone,
      },
      {
        name: 'generate-report',
        data: jobData,
      }
    );

    logger.info(
      { workspaceId, userId, cronPattern, timezone: setting.timezone },
      'Report scheduler upserted'
    );
  } catch (error) {
    logger.error(
      { error, workspaceId, userId },
      'Failed to upsert report scheduler'
    );
    throw error;
  }
}

/**
 * Remove a BullMQ Job Scheduler for a user's weekly report
 */
export async function removeReportScheduler(
  workspaceId: string,
  userId: string
): Promise<void> {
  try {
    const schedulerId = getSchedulerId(workspaceId, userId);

    // Remove the job scheduler if it exists
    await reportQueue.removeJobScheduler(schedulerId);

    logger.info(
      { workspaceId, userId, schedulerId },
      'Report scheduler removed'
    );
  } catch (error) {
    // Non-fatal if scheduler doesn't exist
    logger.debug(
      { error, workspaceId, userId },
      'Failed to remove report scheduler (may not exist)'
    );
  }
}

/**
 * Synchronize all report schedulers from database
 * Called on server startup to restore schedulers after restart
 */
export async function syncAllReportSchedulers(): Promise<void> {
  try {
    logger.info('Syncing all report schedulers from database');

    // Fetch all enabled report settings
    const allSettings = await db
      .select()
      .from(reportSettingsTable)
      .where(eq(reportSettingsTable.enabled, true));

    logger.info(
      { count: allSettings.length },
      'Found enabled report settings to sync'
    );

    // Upsert scheduler for each enabled setting
    for (const setting of allSettings) {
      try {
        await upsertReportScheduler(setting.workspaceId, setting.userId);
      } catch (error) {
        // Log error but continue with other schedulers
        logger.error(
          { error, workspaceId: setting.workspaceId, userId: setting.userId },
          'Failed to sync individual report scheduler'
        );
      }
    }

    logger.info('Report scheduler sync complete');
  } catch (error) {
    logger.error({ error }, 'Failed to sync report schedulers');
    throw error;
  }
}

/**
 * Get list of active report schedulers
 */
export async function getReportSchedulers(): Promise<
  Array<{ id: string; pattern: string; tz?: string }>
> {
  try {
    const schedulers = await reportQueue.getJobSchedulers();

    return schedulers.map(scheduler => ({
      id: scheduler.key,
      pattern: scheduler.pattern || '',
      tz: scheduler.tz,
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to get report schedulers');
    throw error;
  }
}

/**
 * Setup daily usage reporter scheduler
 * Runs at 2:00 AM UTC to report previous day's usage to Stripe
 */
export async function setupUsageReporterScheduler(): Promise<void> {
  try {
    const jobData: UsageReporterJobData = {
      triggeredBy: 'schedule',
    };

    // Upsert the job scheduler (daily at 2 AM UTC)
    await usageReporterQueue.upsertJobScheduler(
      'daily-usage-report',
      { pattern: '0 2 * * *' }, // 2:00 AM UTC daily
      {
        name: 'daily-usage-report',
        data: jobData,
      }
    );

    logger.info('Usage reporter scheduler configured (daily 2 AM UTC)');
  } catch (error) {
    logger.error({ error }, 'Failed to setup usage reporter scheduler');
    throw error;
  }
}

/**
 * Setup escalation scanner scheduler
 * Runs every 15 minutes to detect high-risk client conversations
 */
export async function setupEscalationScannerScheduler(): Promise<void> {
  try {
    const jobData: EscalationScanJobData = {
      triggeredBy: 'scheduler',
    };

    // Upsert the job scheduler (every 15 minutes)
    await escalationScanQueue.upsertJobScheduler(
      'escalation-scanner-15min',
      { pattern: '*/15 * * * *' }, // Every 15 minutes
      {
        name: 'escalation-scan',
        data: jobData,
      }
    );

    logger.info('Escalation scanner scheduler configured (every 15 minutes)');
  } catch (error) {
    logger.error({ error }, 'Failed to setup escalation scanner scheduler');
    throw error;
  }
}

/**
 * Setup data retention scheduler
 * Runs at 3:00 AM UTC daily to clean up expired audit data
 */
export async function setupDataRetentionScheduler(): Promise<void> {
  try {
    const jobData: DataRetentionJobData = {
      triggeredBy: 'schedule',
    };

    // Upsert the job scheduler (daily at 3 AM UTC)
    await dataRetentionQueue.upsertJobScheduler(
      'daily-data-retention',
      { pattern: '0 3 * * *' }, // 3:00 AM UTC daily
      {
        name: 'data-retention-cleanup',
        data: jobData,
      }
    );

    logger.info('Data retention scheduler configured (daily 3 AM UTC)');
  } catch (error) {
    logger.error({ error }, 'Failed to setup data retention scheduler');
    throw error;
  }
}
