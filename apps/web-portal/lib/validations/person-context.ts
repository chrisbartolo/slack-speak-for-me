import { z } from 'zod';

export const personContextSchema = z.object({
  targetSlackUserId: z
    .string()
    .min(1, 'Slack user ID is required')
    .regex(/^[UW][A-Z0-9]+$/, 'Invalid Slack user ID format'),
  contextText: z
    .string()
    .min(1, 'Context is required')
    .max(1000, 'Maximum 1000 characters')
    // Injection protection - block spotlighting markers
    .refine(
      (val) => !val.includes('<|user_input_start|>') && !val.includes('<|user_input_end|>'),
      { message: 'Invalid characters detected' }
    ),
});

export interface PersonContextInput {
  targetSlackUserId: string;
  contextText: string;
}
