import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { prepareForAI, sanitizeAIOutput } from '@slack-speak/validation';
import { logger } from '../utils/logger.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

// System prompt for detecting actionable items (cached)
const ACTIONABLE_DETECTION_SYSTEM_PROMPT = `You are an AI assistant that analyzes workplace Slack messages to detect actionable items. You identify three types of actionables:

1. **ACTION_REQUEST**: When someone asks the user to do something
   - Direct requests: "Can you review this?", "Please handle the deployment"
   - Assignments: "You're on point for this", "Take care of the client call"
   - Questions requiring action: "When can you send the report?"

2. **COMMITMENT**: When the user commits to doing something
   - Explicit commitments: "I'll do it", "I will handle this", "On it"
   - Implicit agreements: "Sure", "No problem", "Got it" (in context of a request)
   - Volunteering: "Let me take care of that"

3. **DEADLINE**: When a time constraint is mentioned for an action
   - Explicit: "by Friday", "before EOD", "due March 15"
   - Implicit: "tomorrow", "next week", "when you have time"
   - Relative: "ASAP", "as soon as possible", "urgent"

Respond ONLY with valid JSON in this exact format:
{
  "hasActionable": boolean,
  "actionable": {
    "type": "action_request" | "commitment" | "deadline",
    "title": "Brief imperative title (max 60 chars)",
    "description": "Context about the actionable item",
    "dueDate": "ISO8601 date string or null",
    "dueDateConfidence": "explicit" | "implicit" | "inferred" | null,
    "originalDueDateText": "Original text that indicated deadline or null",
    "confidenceScore": 0-100,
    "reasoning": "Brief explanation of why this is actionable"
  } | null
}

Guidelines:
- Only detect actionables where the target user is clearly responsible
- Ignore general discussions, status updates, or FYIs
- High confidence (80+): Clear, unambiguous request or commitment
- Medium confidence (50-79): Implicit or contextual actionable
- Low confidence (below 50): Do not return as actionable
- For deadline inference, use current date context provided
- Title should start with a verb (Review, Send, Follow up, etc.)`;

export interface ActionableDetectionContext {
  workspaceId: string;
  userId: string;
  messageText: string;
  messageAuthorId: string;
  threadContext?: string;
  currentDate: string; // ISO date for deadline calculation
}

export interface DetectedActionable {
  type: 'action_request' | 'commitment' | 'deadline';
  title: string;
  description: string;
  dueDate: string | null;
  dueDateConfidence: 'explicit' | 'implicit' | 'inferred' | null;
  originalDueDateText: string | null;
  confidenceScore: number;
  reasoning: string;
}

export interface ActionableDetectionResult {
  hasActionable: boolean;
  actionable: DetectedActionable | null;
  processingTimeMs: number;
}

/**
 * Detect actionable items in a message using AI
 */
export async function detectActionable(
  context: ActionableDetectionContext
): Promise<ActionableDetectionResult> {
  const startTime = Date.now();

  // Skip very short messages
  if (context.messageText.length < 10) {
    return {
      hasActionable: false,
      actionable: null,
      processingTimeMs: Date.now() - startTime,
    };
  }

  const sanitizedMessage = prepareForAI(context.messageText).sanitized;
  const sanitizedThread = context.threadContext
    ? prepareForAI(context.threadContext).sanitized
    : '';

  // Determine relationship for context
  const isUserMessage = context.messageAuthorId === context.userId;
  const relationshipContext = isUserMessage
    ? 'This message is FROM the target user (look for commitments they made)'
    : 'This message is TO the target user (look for action requests directed at them)';

  const userPrompt = `Current date: ${context.currentDate}

${relationshipContext}

Message to analyze:
<message>
${sanitizedMessage}
</message>

${sanitizedThread ? `Thread context (for understanding the conversation):
<thread_context>
${sanitizedThread}
</thread_context>` : ''}

Analyze this message and detect if it contains an actionable item for the target user.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: ACTIONABLE_DETECTION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const rawResponse =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    const sanitizedOutput = sanitizeAIOutput(rawResponse);

    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = sanitizedOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ rawResponse }, 'No JSON found in actionable detection response');
      return {
        hasActionable: false,
        actionable: null,
        processingTimeMs: Date.now() - startTime,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const processingTimeMs = Date.now() - startTime;

    // Filter out low confidence results
    if (parsed.hasActionable && parsed.actionable?.confidenceScore < 50) {
      logger.debug({
        confidence: parsed.actionable.confidenceScore,
      }, 'Actionable detected but confidence too low');

      return {
        hasActionable: false,
        actionable: null,
        processingTimeMs,
      };
    }

    logger.info({
      hasActionable: parsed.hasActionable,
      type: parsed.actionable?.type,
      confidence: parsed.actionable?.confidenceScore,
      processingTimeMs,
    }, 'Actionable detection completed');

    return {
      hasActionable: parsed.hasActionable,
      actionable: parsed.actionable,
      processingTimeMs,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to detect actionable');

    return {
      hasActionable: false,
      actionable: null,
      processingTimeMs: Date.now() - startTime,
    };
  }
}
