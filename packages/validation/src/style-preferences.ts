import { z } from 'zod';

/**
 * Tone options for AI-generated responses
 */
export const ToneEnum = z.enum([
  'professional',
  'casual',
  'friendly',
  'direct',
  'empathetic',
  'assertive',
]);

/**
 * Formality level options
 */
export const FormalityEnum = z.enum([
  'formal',
  'balanced',
  'informal',
]);

/**
 * Refinement type options for feedback tracking
 */
export const RefinementTypeEnum = z.enum([
  'tone',
  'length',
  'word_choice',
  'structure',
]);

/**
 * Injection protection: Detect data markers that could be used for prompt injection
 */
const INJECTION_PATTERNS = [
  /<\|.*?\|>/g, // Spotlighting markers
  /\[SYSTEM\]/gi,
  /\[INSTRUCTION\]/gi,
  /\[USER\]/gi,
  /\[ASSISTANT\]/gi,
  /<system>/gi,
  /<instruction>/gi,
];

function detectInjectionInText(text: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Single phrase validation with length limit and injection protection
 */
const PhraseSchema = z
  .string()
  .max(100, 'Phrase must be 100 characters or less')
  .refine(
    (phrase) => !detectInjectionInText(phrase),
    { message: 'Phrase contains potentially unsafe content' }
  );

/**
 * Custom guidance validation with injection protection
 */
const CustomGuidanceSchema = z
  .string()
  .max(500, 'Custom guidance must be 500 characters or less')
  .refine(
    (guidance) => !detectInjectionInText(guidance),
    { message: 'Custom guidance contains potentially unsafe content' }
  )
  .optional();

/**
 * Input schema for creating/updating style preferences
 * This is what users submit
 */
export const StylePreferencesInputSchema = z.object({
  tone: ToneEnum.optional(),
  formality: FormalityEnum.optional(),
  preferredPhrases: z.array(PhraseSchema).max(20, 'Maximum 20 preferred phrases').optional(),
  avoidPhrases: z.array(PhraseSchema).max(20, 'Maximum 20 phrases to avoid').optional(),
  customGuidance: CustomGuidanceSchema,
});

/**
 * Full schema for stored style preferences (includes IDs and timestamps)
 */
export const StylePreferencesSchema = StylePreferencesInputSchema.extend({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string(),
  updatedAt: z.date(),
});

/**
 * Type exports for TypeScript
 */
export type ToneOption = z.infer<typeof ToneEnum>;
export type FormalityOption = z.infer<typeof FormalityEnum>;
export type RefinementType = z.infer<typeof RefinementTypeEnum>;
export type StylePreferencesInput = z.infer<typeof StylePreferencesInputSchema>;
export type StylePreferences = z.infer<typeof StylePreferencesSchema>;
