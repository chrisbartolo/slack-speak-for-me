'use server';

import { revalidatePath } from 'next/cache';
import { db, schema } from '@/lib/db';
import { verifySession } from '@/lib/auth/dal';
import { reportSettingsSchema } from '@/lib/validations/report-settings';
import { and, eq } from 'drizzle-orm';

const { reportSettings, googleIntegrations, workflowConfig } = schema;

export type ActionResult = {
  success?: boolean;
  error?: string;
  errors?: Record<string, string[]>;
};

export async function saveReportSettings(formData: FormData): Promise<ActionResult> {
  const session = await verifySession();

  const rawData = {
    enabled: formData.get('enabled') === 'true',
    dayOfWeek: parseInt(formData.get('dayOfWeek') as string, 10),
    timeOfDay: formData.get('timeOfDay') as string,
    timezone: formData.get('timezone') as string,
    format: formData.get('format') as string,
    sections: JSON.parse((formData.get('sections') as string) || '[]'),
    autoSend: formData.get('autoSend') === 'true',
  };

  const result = reportSettingsSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = result.data;

  try {
    // Type cast to work around Drizzle ORM type inference issue
    const values = {
      workspaceId: session.workspaceId,
      userId: session.userId,
      enabled: data.enabled,
      dayOfWeek: data.dayOfWeek,
      timeOfDay: data.timeOfDay,
      timezone: data.timezone,
      format: data.format,
      sections: data.sections,
      autoSend: data.autoSend,
      updatedAt: new Date(),
    } as typeof reportSettings.$inferInsert;

    await db
      .insert(reportSettings)
      .values(values)
      .onConflictDoUpdate({
        target: [reportSettings.workspaceId, reportSettings.userId],
        // Type assertions needed for Drizzle ORM type compatibility
        set: {
          enabled: data.enabled as boolean,
          dayOfWeek: data.dayOfWeek as number,
          timeOfDay: data.timeOfDay as string,
          timezone: data.timezone as string,
          format: data.format as string,
          sections: data.sections as string[],
          autoSend: data.autoSend as boolean,
          updatedAt: new Date(),
        },
      });

    revalidatePath('/reports');
    return { success: true };
  } catch (error) {
    console.error('Error saving report settings:', error);
    return { error: 'Failed to save settings' };
  }
}

export async function disconnectGoogle(): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession();

  try {
    await db
      .delete(googleIntegrations)
      .where(
        and(
          eq(googleIntegrations.workspaceId, session.workspaceId),
          eq(googleIntegrations.userId, session.userId)
        )
      );

    revalidatePath('/reports');
    return { success: true };
  } catch (error) {
    console.error('Failed to disconnect Google:', error);
    return { success: false, error: 'Failed to disconnect Google account' };
  }
}

export async function getGoogleAuthUrl(): Promise<string> {
  const session = await verifySession();
  // Construct URL to slack-backend Google OAuth initiation
  const backendUrl = process.env.SLACK_BACKEND_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    workspaceId: session.workspaceId,
    userId: session.userId,
  });
  return `${backendUrl}/oauth/google/start?${params}`;
}

export async function updateSpreadsheetConfig(
  spreadsheetId: string,
  spreadsheetName: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession();

  // Validate spreadsheet ID format (basic validation)
  if (!spreadsheetId || spreadsheetId.length < 10) {
    return { success: false, error: 'Invalid spreadsheet ID' };
  }

  try {
    await db
      .update(googleIntegrations)
      .set({
        spreadsheetId,
        spreadsheetName,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(googleIntegrations.workspaceId, session.workspaceId),
          eq(googleIntegrations.userId, session.userId)
        )
      );

    revalidatePath('/reports');
    return { success: true };
  } catch (error) {
    console.error('Failed to update spreadsheet config:', error);
    return { success: false, error: 'Failed to save configuration' };
  }
}

export async function addWorkflowChannel(
  channelId: string,
  channelName: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession();

  if (!channelId.trim()) {
    return { success: false, error: 'Channel ID is required' };
  }

  try {
    await db
      .insert(workflowConfig)
      .values({
        workspaceId: session.workspaceId,
        userId: session.userId,
        channelId,
        channelName,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: [workflowConfig.workspaceId, workflowConfig.userId, workflowConfig.channelId],
        set: {
          channelName,
          enabled: true,
          updatedAt: new Date(),
        },
      });

    revalidatePath('/reports');
    return { success: true };
  } catch (error) {
    console.error('Failed to add workflow channel:', error);
    return { success: false, error: 'Failed to add channel' };
  }
}

export async function removeWorkflowChannel(
  channelId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession();

  try {
    await db
      .delete(workflowConfig)
      .where(
        and(
          eq(workflowConfig.workspaceId, session.workspaceId),
          eq(workflowConfig.userId, session.userId),
          eq(workflowConfig.channelId, channelId)
        )
      );

    revalidatePath('/reports');
    return { success: true };
  } catch (error) {
    console.error('Failed to remove workflow channel:', error);
    return { success: false, error: 'Failed to remove channel' };
  }
}
