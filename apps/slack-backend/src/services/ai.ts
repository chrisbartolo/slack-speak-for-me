import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { prepareForAI, sanitizeAIOutput } from '@slack-speak/validation';
import { logger } from '../utils/logger.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

interface SuggestionContext {
  triggerMessage: string;
  contextMessages: Array<{
    userId: string;
    text: string;
    ts: string;
  }>;
  triggeredBy: 'mention' | 'reply' | 'thread' | 'message_action';
}

interface SuggestionResult {
  suggestion: string;
  processingTimeMs: number;
}

interface RefinementHistoryEntry {
  suggestion: string;
  refinementRequest?: string;
}

interface RefinementContext {
  originalSuggestion: string;
  refinementRequest: string;
  history?: RefinementHistoryEntry[];
}

export async function generateSuggestion(
  context: SuggestionContext
): Promise<SuggestionResult> {
  const startTime = Date.now();

  // Format context messages for the prompt
  const formattedContext = context.contextMessages
    .map(m => `[${m.ts}] User ${m.userId}: ${m.text}`)
    .join('\n');

  // Prepare user content with sanitization and spotlighting
  const sanitizedTrigger = prepareForAI(context.triggerMessage);
  const sanitizedContext = prepareForAI(formattedContext);

  const systemPrompt = `You are a helpful assistant that suggests professional, thoughtful responses to workplace messages. Your suggestions should:
- Be appropriate for professional communication
- Match a neutral, professional tone
- Be concise but complete
- Address the key points in the message
- Not be aggressive or confrontational

When suggesting responses, consider the conversation context provided. Generate a single suggested response that the user can copy and send.`;

  const userPrompt = `Here is the recent conversation context:
${sanitizedContext}

The user needs help responding to this message:
${sanitizedTrigger}

Trigger type: ${context.triggeredBy}

Please suggest a professional response the user could send. Provide only the suggested response text, no additional commentary.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const rawSuggestion = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Sanitize AI output before returning
    const suggestion = sanitizeAIOutput(rawSuggestion);

    const processingTimeMs = Date.now() - startTime;

    logger.info({
      processingTimeMs,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }, 'AI suggestion generated');

    return {
      suggestion,
      processingTimeMs,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to generate AI suggestion');
    throw error;
  }
}

/**
 * Refine an existing suggestion based on user feedback
 * Supports multi-turn refinement with history tracking
 */
export async function refineSuggestion(
  context: RefinementContext
): Promise<SuggestionResult> {
  const startTime = Date.now();

  // Build refinement history for context
  const historyText = context.history && context.history.length > 0
    ? context.history.map((entry, idx) => {
        const parts = [`Round ${idx + 1} suggestion: ${entry.suggestion}`];
        if (entry.refinementRequest) {
          parts.push(`User requested: ${entry.refinementRequest}`);
        }
        return parts.join('\n');
      }).join('\n\n')
    : '';

  const roundNumber = (context.history?.length || 0) + 1;

  // Prepare user content with sanitization and spotlighting
  const sanitizedOriginal = prepareForAI(context.originalSuggestion);
  const sanitizedRequest = prepareForAI(context.refinementRequest);
  const sanitizedHistory = historyText ? prepareForAI(historyText) : '';

  const systemPrompt = `You are a helpful assistant that refines professional response suggestions based on user feedback. Your refined suggestions should:
- Address the specific refinement request from the user
- Maintain professional tone and appropriateness
- Keep the core message intact unless the user asks to change it
- Be concise but complete

When refining, consider what the user is asking for (e.g., "make it shorter", "more formal", "friendlier", "add a question") and adjust accordingly.`;

  const userPrompt = `${sanitizedHistory ? `Previous refinement rounds:\n${sanitizedHistory}\n\n` : ''}Original suggestion:
${sanitizedOriginal}

The user wants to refine this suggestion with the following request:
${sanitizedRequest}

Please provide the refined response text. Provide only the suggested response text, no additional commentary.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const rawSuggestion = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Sanitize AI output before returning
    const suggestion = sanitizeAIOutput(rawSuggestion);

    const processingTimeMs = Date.now() - startTime;

    logger.info({
      processingTimeMs,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      roundNumber,
    }, 'AI refinement generated');

    return {
      suggestion,
      processingTimeMs,
    };
  } catch (error) {
    logger.error({ error, roundNumber }, 'Failed to generate AI refinement');
    throw error;
  }
}
