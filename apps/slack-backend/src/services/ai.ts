import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { prepareForAI, sanitizeAIOutput } from '@slack-speak/validation';
import { logger } from '../utils/logger.js';
import { buildStyleContext, trackRefinement } from './personalization/index.js';
import { db, personContext, conversationContext } from '@slack-speak/database';
import { eq, and, inArray } from 'drizzle-orm';
import { checkUsageAllowed, recordUsageEvent } from './usage-enforcement.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

interface SuggestionContext {
  workspaceId: string;
  userId: string;
  channelId?: string;
  triggerMessage: string;
  contextMessages: Array<{
    userId: string;
    text: string;
    ts: string;
  }>;
  triggeredBy: 'mention' | 'reply' | 'thread' | 'message_action' | 'dm';
}

/**
 * Fetch saved context for a conversation
 */
async function getConversationContextText(
  workspaceId: string,
  userId: string,
  channelId: string
): Promise<string | null> {
  try {
    const [context] = await db
      .select({ contextText: conversationContext.contextText })
      .from(conversationContext)
      .where(
        and(
          eq(conversationContext.workspaceId, workspaceId),
          eq(conversationContext.userId, userId),
          eq(conversationContext.channelId, channelId)
        )
      )
      .limit(1);

    return context?.contextText || null;
  } catch (error) {
    logger.warn({ error, channelId }, 'Failed to fetch conversation context');
    return null;
  }
}

/**
 * Fetch saved context about specific people
 */
async function getPersonContexts(
  workspaceId: string,
  userId: string,
  targetUserIds: string[]
): Promise<Map<string, string>> {
  if (targetUserIds.length === 0) {
    return new Map();
  }

  try {
    const contexts = await db
      .select({
        targetSlackUserId: personContext.targetSlackUserId,
        targetUserName: personContext.targetUserName,
        contextText: personContext.contextText,
      })
      .from(personContext)
      .where(
        and(
          eq(personContext.workspaceId, workspaceId),
          eq(personContext.userId, userId),
          inArray(personContext.targetSlackUserId, targetUserIds)
        )
      );

    const contextMap = new Map<string, string>();
    for (const ctx of contexts) {
      const label = ctx.targetUserName || ctx.targetSlackUserId;
      contextMap.set(ctx.targetSlackUserId, `${label}: ${ctx.contextText}`);
    }
    return contextMap;
  } catch (error) {
    logger.warn({ error, targetUserIds }, 'Failed to fetch person contexts');
    return new Map();
  }
}

interface SuggestionResult {
  suggestion: string;
  processingTimeMs: number;
  personalization: {
    learningPhase: string;
    usedHistory: boolean;
  };
  usage?: {
    used: number;
    limit: number;
    isOverage: boolean;
  };
}

export class UsageLimitExceededError extends Error {
  constructor(
    public currentUsage: number,
    public limit: number
  ) {
    super(`Usage limit exceeded: ${currentUsage}/${limit} suggestions used this month`);
    this.name = 'UsageLimitExceededError';
  }
}

interface RefinementHistoryEntry {
  suggestion: string;
  refinementRequest?: string;
}

interface RefinementContext {
  workspaceId: string;
  userId: string;
  suggestionId: string;
  originalSuggestion: string;
  refinementRequest: string;
  history?: RefinementHistoryEntry[];
}

// Base system prompt (static, cached for 1 hour)
const BASE_SYSTEM_PROMPT = `You are a helpful assistant that suggests professional, thoughtful responses to workplace messages.

Your suggestions should:
- Be appropriate for professional communication
- Be concise but complete
- Address the key points in the message
- Not be aggressive or confrontational

When suggesting responses, consider the conversation context provided. Generate a single suggested response that the user can copy and send.`;

export async function generateSuggestion(
  context: SuggestionContext
): Promise<SuggestionResult> {
  const startTime = Date.now();

  // Check usage limits before generating
  const usageCheck = await checkUsageAllowed({
    workspaceId: context.workspaceId,
    userId: context.userId,
  });

  if (!usageCheck.allowed) {
    logger.warn({
      workspaceId: context.workspaceId,
      userId: context.userId,
      currentUsage: usageCheck.currentUsage,
      limit: usageCheck.limit,
      reason: usageCheck.reason,
    }, 'Usage limit exceeded - blocking AI generation');

    throw new UsageLimitExceededError(usageCheck.currentUsage, usageCheck.limit);
  }

  // Build personalized style context
  const formattedContext = context.contextMessages
    .map(m => `[${m.ts}] User ${m.userId}: ${m.text}`)
    .join('\n');

  const styleContext = await buildStyleContext({
    workspaceId: context.workspaceId,
    userId: context.userId,
    conversationContext: formattedContext,
  });

  // Fetch saved conversation context (if channelId provided)
  let savedConversationContext: string | null = null;
  if (context.channelId) {
    savedConversationContext = await getConversationContextText(
      context.workspaceId,
      context.userId,
      context.channelId
    );
  }

  // Fetch person contexts for participants
  const participantIds = [...new Set(context.contextMessages.map(m => m.userId))];
  const personContextMap = await getPersonContexts(
    context.workspaceId,
    context.userId,
    participantIds
  );

  // Prepare user content with sanitization and spotlighting
  const sanitizedTrigger = prepareForAI(context.triggerMessage).sanitized;
  const sanitizedContext = prepareForAI(formattedContext).sanitized;

  // Build additional context section
  let additionalContextSection = '';

  if (savedConversationContext) {
    const sanitizedConvContext = prepareForAI(savedConversationContext).sanitized;
    additionalContextSection += `\n<conversation_context>
The user has provided the following context about this channel/conversation:
${sanitizedConvContext}
</conversation_context>\n`;
  }

  if (personContextMap.size > 0) {
    const personContextEntries = Array.from(personContextMap.values())
      .map(ctx => prepareForAI(ctx).sanitized)
      .join('\n');
    additionalContextSection += `\n<people_context>
The user has provided the following context about people in this conversation:
${personContextEntries}
</people_context>\n`;
  }

  const userPrompt = `Here is the recent conversation context:
${sanitizedContext}
${additionalContextSection}
The user needs help responding to this message:
${sanitizedTrigger}

Trigger type: ${context.triggeredBy}

Please suggest a professional response the user could send. Use the provided context about this conversation and the people involved to make your suggestion more appropriate. Provide only the suggested response text, no additional commentary.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: BASE_SYSTEM_PROMPT,
          // Cache static system prompt for 1 hour
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: styleContext.promptText,
          // Cache user style context for 5 minutes
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

    const rawSuggestion = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Sanitize AI output before returning
    const suggestion = sanitizeAIOutput(rawSuggestion);

    const processingTimeMs = Date.now() - startTime;

    // Record usage event (non-blocking)
    const totalTokens = response.usage.input_tokens + response.usage.output_tokens;
    // Estimate cost: ~$3/M input + $15/M output for Sonnet
    const costEstimate = Math.round(
      (response.usage.input_tokens * 0.003 + response.usage.output_tokens * 0.015) * 100
    ); // in cents

    recordUsageEvent({
      workspaceId: context.workspaceId,
      userId: context.userId,
      eventType: 'suggestion',
      tokensUsed: totalTokens,
      costEstimate,
    }).catch(err => {
      logger.warn({ error: err }, 'Failed to record usage event');
    });

    logger.info({
      processingTimeMs,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: (response.usage as any).cache_read_input_tokens || 0,
      cacheCreationTokens: (response.usage as any).cache_creation_input_tokens || 0,
      learningPhase: styleContext.learningPhase,
      usedHistory: styleContext.usedHistory,
      usageCheck: { used: usageCheck.currentUsage, limit: usageCheck.limit, isOverage: usageCheck.isOverage },
    }, 'AI suggestion generated with personalization');

    return {
      suggestion,
      processingTimeMs,
      personalization: {
        learningPhase: styleContext.learningPhase,
        usedHistory: styleContext.usedHistory,
      },
      usage: {
        used: usageCheck.currentUsage + 1, // +1 for this generation
        limit: usageCheck.limit,
        isOverage: usageCheck.isOverage || (usageCheck.currentUsage + 1 > usageCheck.limit),
      },
    };
  } catch (error) {
    logger.error({ error }, 'Failed to generate AI suggestion');
    throw error;
  }
}

/**
 * Refine an existing suggestion based on user feedback
 * Supports multi-turn refinement with history tracking
 * Automatically tracks refinement for feedback learning
 */
export async function refineSuggestion(
  context: RefinementContext
): Promise<SuggestionResult> {
  const startTime = Date.now();

  // Check usage limits before refining (refinements count toward usage)
  const usageCheck = await checkUsageAllowed({
    workspaceId: context.workspaceId,
    userId: context.userId,
  });

  if (!usageCheck.allowed) {
    logger.warn({
      workspaceId: context.workspaceId,
      userId: context.userId,
      currentUsage: usageCheck.currentUsage,
      limit: usageCheck.limit,
      reason: usageCheck.reason,
    }, 'Usage limit exceeded - blocking AI refinement');

    throw new UsageLimitExceededError(usageCheck.currentUsage, usageCheck.limit);
  }

  // Build style context for consistency
  const styleContext = await buildStyleContext({
    workspaceId: context.workspaceId,
    userId: context.userId,
    conversationContext: context.originalSuggestion,
  });

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
  const sanitizedOriginal = prepareForAI(context.originalSuggestion).sanitized;
  const sanitizedRequest = prepareForAI(context.refinementRequest).sanitized;
  const sanitizedHistory = historyText ? prepareForAI(historyText).sanitized : '';

  const refinementSystemPrompt = `You are a helpful assistant that refines professional response suggestions based on user feedback.

Your refined suggestions should:
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
      system: [
        {
          type: 'text',
          text: refinementSystemPrompt,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: styleContext.promptText,
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

    const rawSuggestion = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Sanitize AI output before returning
    const suggestion = sanitizeAIOutput(rawSuggestion);

    const processingTimeMs = Date.now() - startTime;

    // Track refinement for feedback learning
    try {
      await trackRefinement({
        workspaceId: context.workspaceId,
        userId: context.userId,
        suggestionId: context.suggestionId,
        original: context.originalSuggestion,
        modified: suggestion,
      });
    } catch (trackError) {
      // Non-fatal - don't fail the refinement if tracking fails
      logger.warn({ error: trackError }, 'Failed to track refinement event');
    }

    // Record usage event (non-blocking)
    const totalTokens = response.usage.input_tokens + response.usage.output_tokens;
    const costEstimate = Math.round(
      (response.usage.input_tokens * 0.003 + response.usage.output_tokens * 0.015) * 100
    );

    recordUsageEvent({
      workspaceId: context.workspaceId,
      userId: context.userId,
      eventType: 'refinement',
      tokensUsed: totalTokens,
      costEstimate,
    }).catch(err => {
      logger.warn({ error: err }, 'Failed to record refinement usage event');
    });

    logger.info({
      processingTimeMs,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: (response.usage as any).cache_read_input_tokens || 0,
      roundNumber,
      learningPhase: styleContext.learningPhase,
      usageCheck: { used: usageCheck.currentUsage, limit: usageCheck.limit, isOverage: usageCheck.isOverage },
    }, 'AI refinement generated');

    return {
      suggestion,
      processingTimeMs,
      personalization: {
        learningPhase: styleContext.learningPhase,
        usedHistory: styleContext.usedHistory,
      },
      usage: {
        used: usageCheck.currentUsage + 1,
        limit: usageCheck.limit,
        isOverage: usageCheck.isOverage || (usageCheck.currentUsage + 1 > usageCheck.limit),
      },
    };
  } catch (error) {
    logger.error({ error, roundNumber }, 'Failed to generate AI refinement');
    throw error;
  }
}
