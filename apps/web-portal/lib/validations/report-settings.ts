import { z } from 'zod';

export const reportSettingsSchema = z.object({
  enabled: z.boolean(),
  dayOfWeek: z.number().min(0).max(6),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
  timezone: z.string().min(1),
  format: z.enum(['concise', 'detailed']),
  sections: z.array(z.enum(['achievements', 'focus', 'blockers', 'shoutouts'])).min(1),
  autoSend: z.boolean(),
});

export type ReportSettings = z.infer<typeof reportSettingsSchema>;
