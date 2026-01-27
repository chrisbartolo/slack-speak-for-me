import { z } from 'zod';

// Injection protection - block spotlighting markers per Phase 3 decisions
const safeTextSchema = z.string().refine(
  (val) => !val.includes('<|user_input_start|>') && !val.includes('<|user_input_end|>'),
  { message: 'Invalid characters detected' }
);

export const stylePreferencesSchema = z.object({
  tone: z.enum(['Professional', 'Friendly', 'Direct', 'Empathetic']).nullable(),
  formality: z.enum(['Casual', 'Neutral', 'Formal']).nullable(),
  preferredPhrases: z
    .array(safeTextSchema.max(100, 'Phrase too long'))
    .max(20, 'Maximum 20 phrases'),
  avoidPhrases: z
    .array(safeTextSchema.max(100, 'Phrase too long'))
    .max(20, 'Maximum 20 phrases'),
  customGuidance: safeTextSchema.max(500, 'Maximum 500 characters').nullable(),
});

export type StylePreferences = z.infer<typeof stylePreferencesSchema>;
