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
