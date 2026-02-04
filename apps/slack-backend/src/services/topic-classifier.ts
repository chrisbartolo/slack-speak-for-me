import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { logger } from '../utils/logger.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export type Topic =
  | 'scheduling'
  | 'complaint'
  | 'technical'
  | 'status_update'
  | 'request'
  | 'escalation'
  | 'general';

export interface TopicClassification {
  topic: Topic;
  confidence: number; // 0.0-1.0
  reasoning: string;
}

interface ClassifyTopicParams {
  conversationMessages: Array<{ text: string; ts: string }>;
  targetMessage: string;
}

const TOPIC_PROMPT = `Classify the PRIMARY topic of this conversation based on the most recent message.

Conversation:
{context}

Most recent message: "{targetMessage}"

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "topic": "scheduling|complaint|technical|status_update|request|escalation|general",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of classification"
}

Topic definitions:
- **scheduling**: Meeting coordination, calendar availability, rescheduling (e.g., "Can we move our 2pm to 3pm?", "Let's find time next week")
- **complaint**: Dissatisfaction with service/product, expressing frustration about outcomes (e.g., "This feature doesn't work as promised", "I'm disappointed with the results")
- **technical**: Technical issues, bugs, errors, system problems, troubleshooting (e.g., "Error 500 when I try to login", "The API is returning null")
- **status_update**: Progress reports, project updates, milestone announcements (e.g., "Deployed to staging", "Task completed", "Sprint finished")
- **request**: Asking for help, information, resources, or action (e.g., "Can you send me the doc?", "Please review my PR", "Need access to the repo")
- **escalation**: Urgent issue requiring management attention, threats to leave/escalate, demands for higher authority (e.g., "I need to speak with your manager", "This is unacceptable", "Escalating to leadership")
- **general**: Casual conversation, greetings, acknowledgments, off-topic discussion (e.g., "Thanks!", "Good morning", "How was your weekend?")

Be conservative - choose the most specific topic that clearly matches, otherwise default to 'general'.`;

/**
 * Classify the primary topic of a conversation
 *
 * Uses Claude prompt engineering to categorize the conversation topic without external API costs.
 * Returns general/low confidence fallback on any error to prevent blocking analytics.
 *
 * @param params - Conversation messages and target message to classify
 * @returns TopicClassification with topic, confidence, and reasoning
 */
export async function classifyTopic(
  params: ClassifyTopicParams
): Promise<TopicClassification> {
  const startTime = Date.now();

  // Fallback for any error condition
  const fallback: TopicClassification = {
    topic: 'general',
    confidence: 0,
    reasoning: 'classification_failed',
  };

  try {
    // Format conversation messages
    const formattedContext = params.conversationMessages
      .map(m => `[${m.ts}] ${m.text}`)
      .join('\n');

    // Build prompt with conversation context
    const prompt = TOPIC_PROMPT
      .replace('{context}', formattedContext)
      .replace('{targetMessage}', params.targetMessage);

    // Create AbortController for 2-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

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
      const validTopics: Topic[] = ['scheduling', 'complaint', 'technical', 'status_update', 'request', 'escalation', 'general'];

      if (!validTopics.includes(parsed.topic)) {
        logger.warn({ parsedTopic: parsed.topic }, 'Invalid topic value, using fallback');
        return fallback;
      }

      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        logger.warn({ parsedConfidence: parsed.confidence }, 'Invalid confidence value, using fallback');
        return fallback;
      }

      if (typeof parsed.reasoning !== 'string') {
        logger.warn({ parsedReasoning: parsed.reasoning }, 'Invalid reasoning, using fallback');
        return fallback;
      }

      const result: TopicClassification = {
        topic: parsed.topic,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
      };

      const processingTimeMs = Date.now() - startTime;

      logger.info({
        topic: result.topic,
        confidence: result.confidence,
        processingTimeMs,
      }, 'Topic classification complete');

      return result;
    } catch (abortError) {
      if ((abortError as any).name === 'AbortError') {
        logger.warn({ timeoutMs: 2000 }, 'Topic classification timed out, using fallback');
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
    }, 'Topic classification failed, using general fallback');

    return fallback;
  }
}
