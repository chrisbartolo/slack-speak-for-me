import { z } from 'zod';

// Injection protection - block spotlighting markers per Phase 3 decisions
// Note: refine() must come after base string transformations for proper type inference
const phraseSchema = z
  .string()
  .max(100, 'Phrase too long')
  .refine(
    (val) => !val.includes('<|user_input_start|>') && !val.includes('<|user_input_end|>'),
    { message: 'Invalid characters detected' }
  );

export const stylePreferencesSchema = z.object({
  tone: z.enum(['Professional', 'Friendly', 'Direct', 'Empathetic']).nullable(),
  formality: z.enum(['Casual', 'Neutral', 'Formal']).nullable(),
  preferredPhrases: z
    .array(phraseSchema)
    .max(20, 'Maximum 20 phrases'),
  avoidPhrases: z
    .array(phraseSchema)
    .max(20, 'Maximum 20 phrases'),
  customGuidance: z
    .string()
    .max(500, 'Maximum 500 characters')
    .refine(
      (val) => !val.includes('<|user_input_start|>') && !val.includes('<|user_input_end|>'),
      { message: 'Invalid characters detected' }
    )
    .nullable(),
});

// Explicit type to avoid Zod refine() type inference issues
export interface StylePreferences {
  tone: 'Professional' | 'Friendly' | 'Direct' | 'Empathetic' | null;
  formality: 'Casual' | 'Neutral' | 'Formal' | null;
  preferredPhrases: string[];
  avoidPhrases: string[];
  customGuidance: string | null;
}
