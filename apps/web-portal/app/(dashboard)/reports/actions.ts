'use server';

import { revalidatePath } from 'next/cache';
import { db, schema } from '@/lib/db';
import { verifySession } from '@/lib/auth/dal';
import { reportSettingsSchema } from '@/lib/validations/report-settings';

const { reportSettings } = schema;

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
