import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { logger } from '../utils/logger.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export interface SentimentAnalysis {
  tone: 'neutral' | 'positive' | 'tense' | 'frustrated' | 'angry';
  confidence: number; // 0.0-1.0
  indicators: string[]; // Human-readable indicators like "used all caps", "short terse replies"
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface AnalyzeSentimentParams {
  conversationMessages: Array<{ userId: string; text: string; ts: string }>;
  targetMessage: string;
}

const SENTIMENT_PROMPT = `Analyze the emotional tone and tension level in this conversation, focusing on the most recent message.

Conversation:
{conversation}

Most recent message: "{targetMessage}"

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "tone": "neutral|positive|tense|frustrated|angry",
  "confidence": 0.0-1.0,
  "indicators": ["specific phrases or patterns indicating this tone"],
  "riskLevel": "low|medium|high|critical"
}

Risk level guidelines:
- low: Normal professional conversation, no tension
- medium: Minor frustration or impatience visible, needs careful response
- high: Clear tension, complaints about service, potential escalation risk
- critical: Anger, threats to leave/escalate, demands for management, explicit dissatisfaction

Be conservative - default to lower risk levels unless clear evidence of tension.`;

/**
 * Analyze the sentiment and tension level in a conversation
 *
 * Uses Claude prompt engineering to detect emotional tone without external API costs.
 * Returns neutral/low fallback on any error to prevent blocking suggestion generation.
 *
 * @param params - Conversation messages and target message to analyze
 * @returns SentimentAnalysis with tone, confidence, indicators, and risk level
 */
export async function analyzeSentiment(
  params: AnalyzeSentimentParams
): Promise<SentimentAnalysis> {
  const startTime = Date.now();

  // Fallback for any error condition
  const fallback: SentimentAnalysis = {
    tone: 'neutral',
    confidence: 0,
    indicators: ['analysis_failed'],
    riskLevel: 'low',
  };

  try {
    // Format conversation messages
    const formattedConversation = params.conversationMessages
      .map(m => `[${m.ts}] ${m.text}`)
      .join('\n');

    // Build prompt with conversation context
    const prompt = SENTIMENT_PROMPT
      .replace('{conversation}', formattedConversation)
      .replace('{targetMessage}', params.targetMessage);

    // Create AbortController for 3-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256, // Small output - just structured JSON
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }, {
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      const rawContent = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      // Parse JSON response
      const parsed = JSON.parse(rawContent.trim());

      // Validate parsed values
      const validTones = ['neutral', 'positive', 'tense', 'frustrated', 'angry'];
      const validRiskLevels = ['low', 'medium', 'high', 'critical'];

      if (!validTones.includes(parsed.tone)) {
        logger.warn({ parsedTone: parsed.tone }, 'Invalid tone value, using fallback');
        return fallback;
      }

      if (!validRiskLevels.includes(parsed.riskLevel)) {
        logger.warn({ parsedRiskLevel: parsed.riskLevel }, 'Invalid risk level, using fallback');
        return fallback;
      }

      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        logger.warn({ parsedConfidence: parsed.confidence }, 'Invalid confidence value, using fallback');
        return fallback;
      }

      if (!Array.isArray(parsed.indicators)) {
        logger.warn({ parsedIndicators: parsed.indicators }, 'Invalid indicators, using fallback');
        return fallback;
      }

      const result: SentimentAnalysis = {
        tone: parsed.tone,
        confidence: parsed.confidence,
        indicators: parsed.indicators,
        riskLevel: parsed.riskLevel,
      };

      const processingTimeMs = Date.now() - startTime;

      logger.info({
        tone: result.tone,
        confidence: result.confidence,
        riskLevel: result.riskLevel,
        indicatorCount: result.indicators.length,
        processingTimeMs,
      }, 'Sentiment analysis complete');

      return result;
    } catch (abortError) {
      if ((abortError as any).name === 'AbortError') {
        logger.warn({ timeoutMs: 3000 }, 'Sentiment analysis timed out, using fallback');
        return fallback;
      }
      throw abortError; // Re-throw non-timeout errors
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    logger.warn({
      error,
      processingTimeMs,
    }, 'Sentiment analysis failed, using neutral fallback');

    return fallback;
  }
}
