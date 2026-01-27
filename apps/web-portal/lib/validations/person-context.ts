import { z } from 'zod';

// Injection protection - block spotlighting markers
const safeTextSchema = z.string().refine(
  (val) => !val.includes('<|user_input_start|>') && !val.includes('<|user_input_end|>'),
  { message: 'Invalid characters detected' }
);

export const personContextSchema = z.object({
  targetSlackUserId: z
    .string()
    .min(1, 'Slack user ID is required')
    .regex(/^[UW][A-Z0-9]+$/, 'Invalid Slack user ID format'),
  contextText: safeTextSchema
    .min(1, 'Context is required')
    .max(1000, 'Maximum 1000 characters'),
});

export type PersonContextInput = z.infer<typeof personContextSchema>;
