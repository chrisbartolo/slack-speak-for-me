import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { prepareForAI, sanitizeAIOutput } from '@slack-speak/validation';
import { logger } from '../utils/logger.js';
import { buildStyleContext, trackRefinement } from './personalization/index.js';
import { db, personContext, conversationContext, workspaces, clientProfiles } from '@slack-speak/database';
import { eq, and, inArray } from 'drizzle-orm';
import { checkUsageAllowed, recordUsageEvent } from './usage-enforcement.js';
import { getClientContactBySlackUserId } from './client-profiles.js';
import { getBrandVoiceContext } from './brand-voice.js';
import { analyzeSentiment, type SentimentAnalysis } from './sentiment-detector.js';
import { searchKnowledgeBase } from './knowledge-base.js';
import { triggerEscalationAlert } from './escalation-monitor.js';
import { resolveStyleContext, checkAndEnforceGuardrails, findRelevantTemplates } from './index.js';
import { recordKBUsage } from './kb-effectiveness.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

interface SuggestionContext {
  workspaceId: string;
  userId: string;
  channelId?: string;
  suggestionId: string;
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

  // Check if any conversation participant is a client contact
  let clientContext = '';
  let sentimentResult: SentimentAnalysis | null = null;
  let kbResults: Array<{ id: string; title: string; content: string; similarity: number }> = [];

  // Get organizationId from workspace
  const [workspace] = await db
    .select({ organizationId: workspaces.organizationId })
    .from(workspaces)
    .where(eq(workspaces.id, context.workspaceId))
    .limit(1);

  const organizationId = workspace?.organizationId;

  // Resolve org-wide style settings (if organization exists)
  let orgStyleContext = '';
  if (organizationId) {
    try {
      const orgStyle = await resolveStyleContext(
        organizationId,
        context.workspaceId,
        context.userId
      );

      // Build org style guidance for prompt
      const orgStyleParts: string[] = [];
      if (orgStyle.tone) {
        orgStyleParts.push(`Tone: ${orgStyle.tone}`);
      }
      if (orgStyle.formality) {
        orgStyleParts.push(`Formality: ${orgStyle.formality}`);
      }
      if (orgStyle.preferredPhrases && orgStyle.preferredPhrases.length > 0) {
        orgStyleParts.push(`Preferred phrases: ${orgStyle.preferredPhrases.join(', ')}`);
      }
      if (orgStyle.avoidPhrases && orgStyle.avoidPhrases.length > 0) {
        orgStyleParts.push(`Avoid phrases: ${orgStyle.avoidPhrases.join(', ')}`);
      }
      if (orgStyle.customGuidance) {
        orgStyleParts.push(`Additional guidance: ${orgStyle.customGuidance}`);
      }

      if (orgStyleParts.length > 0) {
        orgStyleContext = `\n<organization_style_guidelines>
${orgStyleParts.join('\n')}
</organization_style_guidelines>\n`;
      }
    } catch (error) {
      // Non-fatal - log and continue without org style
      logger.warn({ error, organizationId }, 'Failed to resolve org style context');
    }
  }

  // Find relevant response templates (if organization exists)
  let templateContext = '';
  if (organizationId) {
    try {
      templateContext = await findRelevantTemplates(
        organizationId,
        context.triggerMessage,
        2 // Max 2 templates
      );
    } catch (error) {
      // Non-fatal - log and continue without templates
      logger.warn({ error, organizationId }, 'Failed to find relevant templates');
    }
  }

  if (organizationId) {
    // Check participants for client contacts (prioritize trigger message sender)
    const triggerUserId = context.contextMessages.length > 0
      ? context.contextMessages[context.contextMessages.length - 1].userId
      : '';

    const clientContactResult = await getClientContactBySlackUserId(
      context.workspaceId,
      triggerUserId
    ).catch(err => {
      logger.warn({ error: err }, 'Failed to check client contact');
      return null;
    });

    if (clientContactResult) {
      // Load client profile context
      const [clientProfile] = await db
        .select()
        .from(clientProfiles)
        .where(eq(clientProfiles.id, clientContactResult.clientProfileId))
        .limit(1)
        .catch(err => {
          logger.warn({ error: err }, 'Failed to load client profile');
          return [];
        });

      if (clientProfile) {
        clientContext += `\n<client_context>
This conversation involves a client: ${prepareForAI(clientProfile.companyName).sanitized}
${clientProfile.servicesProvided?.length ? `Services provided: ${clientProfile.servicesProvided.join(', ')}` : ''}
${clientProfile.contractDetails ? `Contract context: ${prepareForAI(clientProfile.contractDetails).sanitized}` : ''}
Relationship status: ${clientProfile.relationshipStatus || 'active'}
Your response should be professional, solution-focused, and aligned with service commitments.
</client_context>\n`;
      }

      // Load brand voice
      const brandVoice = await getBrandVoiceContext({
        organizationId,
        conversationType: 'client',
      }).catch(err => {
        logger.warn({ error: err }, 'Failed to load brand voice');
        return '';
      });

      if (brandVoice) {
        clientContext += brandVoice;
      }

      // Analyze sentiment
      sentimentResult = await analyzeSentiment({
        conversationMessages: context.contextMessages,
        targetMessage: context.triggerMessage,
      }).catch(err => {
        logger.warn({ error: err }, 'Sentiment analysis failed');
        return null;
      });

      if (sentimentResult && (sentimentResult.riskLevel === 'high' || sentimentResult.riskLevel === 'critical')) {
        clientContext += `\n<de_escalation_mode>
ALERT: Client message shows ${sentimentResult.tone} tone (risk: ${sentimentResult.riskLevel.toUpperCase()})
Indicators: ${sentimentResult.indicators.join(', ')}

Your response MUST:
1. Acknowledge their concern explicitly
2. Show empathy ("I understand this is frustrating...")
3. Take ownership (no blame/excuses)
4. Provide clear next steps with timeline
5. Maintain calm, professional tone

Avoid: Defensive language, technical jargon, dismissing concerns, promising what you can't deliver
</de_escalation_mode>\n`;
      }

      // Search knowledge base (with 500ms timeout)
      kbResults = await searchKnowledgeBase({
        organizationId,
        query: context.triggerMessage,
        limit: 3,
        timeout: 500,
      }).catch(err => {
        logger.warn({ error: err }, 'Knowledge base search failed');
        return [];
      });

      // Track KB document usage (fire-and-forget)
      if (kbResults.length > 0) {
        recordKBUsage({
          suggestionId: context.suggestionId,
          organizationId,
          kbDocumentIds: kbResults.map(r => r.id),
          similarities: kbResults.map(r => r.similarity),
        }).catch(() => {});
      }

      if (kbResults.length > 0 && kbResults[0].similarity > 0.7) {
        clientContext += `\n<knowledge_base>
Relevant product/service documentation:
${kbResults.map((doc, idx) => `[${idx + 1}] ${doc.title} (${(doc.similarity * 100).toFixed(0)}% relevant)\n${doc.content.slice(0, 400)}...`).join('\n\n')}
Reference this information when appropriate to provide accurate, helpful responses.
</knowledge_base>\n`;
      }

      // Trigger escalation alert on critical sentiment (fire-and-forget)
      if (sentimentResult?.riskLevel === 'critical' && organizationId) {
        triggerEscalationAlert({
          organizationId,
          workspaceId: context.workspaceId,
          clientProfileId: clientContactResult?.clientProfileId,
          channelId: context.channelId || '',
          messageTs: context.contextMessages[context.contextMessages.length - 1]?.ts || '',
          sentiment: sentimentResult,
        }).catch(err => {
          logger.warn({ error: err }, 'Failed to trigger escalation alert');
        });
      }
    }
  }

  // Append client context and new admin features to additional context section
  additionalContextSection += clientContext;
  additionalContextSection += orgStyleContext;
  additionalContextSection += templateContext;

  const userPrompt = `Here is the recent conversation context:
${sanitizedContext}
${additionalContextSection}
The user needs help responding to this message:
${sanitizedTrigger}

Trigger type: ${context.triggeredBy}

Please suggest a professional response the user could send. Use the provided context about this conversation and the people involved to make your suggestion more appropriate. Provide only the suggested response text, no additional commentary.`;

  // Helper function to generate suggestion with optional regeneration for guardrails
  const generateWithGuardrails = async (avoidTopics?: string[]): Promise<{ suggestion: string; response: any; guardrailWarnings?: string[] }> => {
    // Build user prompt with optional guardrail avoidance instruction
    let finalUserPrompt = userPrompt;
    if (avoidTopics && avoidTopics.length > 0) {
      finalUserPrompt += `\n\n**IMPORTANT**: Avoid these topics in your response: ${avoidTopics.join(', ')}. Generate an alternative suggestion that addresses the message without touching these subjects.`;
    }

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
          content: finalUserPrompt,
        },
      ],
    });

    const rawSuggestion = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Sanitize AI output before guardrail check
    const sanitizedSuggestion = sanitizeAIOutput(rawSuggestion);

    // Check guardrails (if organization exists)
    let finalSuggestion = sanitizedSuggestion;
    let guardrailWarnings: string[] | undefined;

    if (organizationId) {
      try {
        const guardrailResult = await checkAndEnforceGuardrails(
          organizationId,
          context.workspaceId,
          context.userId,
          sanitizedSuggestion,
          context.channelId
        );

        if (guardrailResult.blocked) {
          // Hard block - throw error to prevent delivery
          logger.warn({
            organizationId,
            workspaceId: context.workspaceId,
            userId: context.userId,
            blockReason: guardrailResult.blockReason,
          }, 'Suggestion blocked by guardrails');

          throw new Error(`This suggestion was blocked by your organization's content guardrails: ${guardrailResult.blockReason}`);
        }

        if (guardrailResult.shouldRegenerate && guardrailResult.avoidTopics) {
          // Regenerate mode - return signal to retry (handled by caller)
          logger.info({
            organizationId,
            avoidTopics: guardrailResult.avoidTopics,
          }, 'Guardrail violation detected - regeneration requested');

          return {
            suggestion: '',
            response,
            guardrailWarnings: undefined,
          };
        }

        if (guardrailResult.warnings && guardrailResult.warnings.length > 0) {
          // Soft warning - append to suggestion
          guardrailWarnings = guardrailResult.warnings;
          finalSuggestion = guardrailResult.text || sanitizedSuggestion;

          logger.info({
            organizationId,
            warnings: guardrailResult.warnings,
          }, 'Guardrail warnings attached to suggestion');
        }
      } catch (guardrailError: any) {
        // If it's our block error, re-throw it
        if (guardrailError.message?.includes('blocked by')) {
          throw guardrailError;
        }
        // Otherwise log and continue (fail open)
        logger.warn({ error: guardrailError, organizationId }, 'Guardrail check failed, allowing suggestion');
      }
    }

    return {
      suggestion: finalSuggestion,
      response,
      guardrailWarnings,
    };
  };

  try {
    // First attempt: Generate with guardrails
    let result = await generateWithGuardrails();

    // If regeneration requested, try once more with avoid topics
    if (!result.suggestion && organizationId) {
      logger.info({ organizationId }, 'Regenerating suggestion to avoid guardrail violations');

      // Get avoid topics from first attempt
      const guardrailConfig = await import('./guardrails.js').then(m => m.getGuardrailConfig(organizationId));
      const allTopics = [
        ...(guardrailConfig.blockedKeywords || []),
        ...(guardrailConfig.enabledCategories || []).map(cat => cat),
      ];

      // Retry once with avoidance instruction (max 1 retry to prevent infinite loops)
      result = await generateWithGuardrails(allTopics.slice(0, 5)); // Limit to top 5 to keep prompt manageable
    }

    const { suggestion, response, guardrailWarnings } = result;

    // If still no suggestion after retry, something went wrong
    if (!suggestion) {
      throw new Error('Failed to generate suggestion after guardrail regeneration');
    }

    // Append guardrail warnings to suggestion if present
    let finalSuggestion = suggestion;
    if (guardrailWarnings && guardrailWarnings.length > 0) {
      finalSuggestion += `\n\n:warning: *Note*: This suggestion may contain content flagged by org guardrails: ${guardrailWarnings.join(', ')}`;
    }

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
      hasClientContext: !!clientContext,
      sentimentRisk: sentimentResult?.riskLevel || 'none',
      kbDocsRetrieved: kbResults?.length || 0,
      hasOrgStyle: !!orgStyleContext,
      hasTemplates: !!templateContext,
      guardrailWarnings: guardrailWarnings?.length || 0,
    }, 'AI suggestion generated with personalization and admin features');

    return {
      suggestion: finalSuggestion,
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
 * Generate a streaming AI suggestion for the assistant panel.
 * Returns an async iterable of text deltas that can be piped to chatStream.
 * Note: Streaming mode does not support KB usage tracking (no organizationId context)
 */
export async function generateSuggestionStream(
  context: Omit<SuggestionContext, 'suggestionId'>
): Promise<{
  stream: AsyncIterable<{ type: string; delta?: { type: string; text: string } }>;
  usageCheck: { currentUsage: number; limit: number; isOverage: boolean };
}> {
  // Check usage limits before generating
  const usageCheck = await checkUsageAllowed({
    workspaceId: context.workspaceId,
    userId: context.userId,
  });

  if (!usageCheck.allowed) {
    throw new UsageLimitExceededError(usageCheck.currentUsage, usageCheck.limit);
  }

  // Build style context
  const formattedContext = context.contextMessages
    .map(m => `[${m.ts}] User ${m.userId}: ${m.text}`)
    .join('\n');

  const styleContext = await buildStyleContext({
    workspaceId: context.workspaceId,
    userId: context.userId,
    conversationContext: formattedContext,
  });

  // Prepare user content with sanitization
  const sanitizedTrigger = prepareForAI(context.triggerMessage).sanitized;
  const sanitizedContext = prepareForAI(formattedContext).sanitized;

  const userPrompt = `Here is the recent conversation context:
${sanitizedContext}

The user needs help responding to this message:
${sanitizedTrigger}

Trigger type: ${context.triggeredBy}

Please suggest a professional response the user could send. Use Slack mrkdwn formatting (use *bold*, _italic_, \`code\`). Provide only the suggested response text, no additional commentary.`;

  const stream = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    stream: true,
    system: [
      {
        type: 'text',
        text: BASE_SYSTEM_PROMPT,
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

  return {
    stream: stream as AsyncIterable<any>,
    usageCheck: {
      currentUsage: usageCheck.currentUsage,
      limit: usageCheck.limit,
      isOverage: usageCheck.isOverage,
    },
  };
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
