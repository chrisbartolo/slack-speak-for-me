import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import { prepareForAI, sanitizeAIOutput } from '@slack-speak/validation';
import { logger } from '../utils/logger.js';
import { buildStyleContext } from './personalization/index.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

interface TaskCompletionReplyContext {
  workspaceId: string;
  userId: string;
  taskTitle: string;
  taskDescription?: string;
  actionableType: string; // 'action_request' | 'commitment' | 'deadline'
  originalMessageText: string;
  completionNote?: string;
}

interface TaskCompletionReplyResult {
  reply: string;
  processingTimeMs: number;
}

const TASK_COMPLETION_SYSTEM_PROMPT = `You are writing a brief Slack thread reply on behalf of a user. They have completed a task that originated from this conversation thread. Write a natural, conversational reply that:

- Acknowledges the task is done
- If a completion note is provided, incorporate those details naturally into the reply
- Match the user's communication style EXACTLY (tone, formality, emoji usage, message length)
- Keep it brief — typically 1-2 sentences
- Do NOT sound robotic or say things like "I have completed the task" or "Task marked as done"
- Write as the human would actually write in Slack
- Do NOT add questions, open new topics, or ask for confirmation
- Do NOT use placeholder text or brackets

Return ONLY the reply text, nothing else.`;

/**
 * Generate a task completion reply in the user's voice.
 * Used when marking a task as complete to reply in the original Slack thread.
 */
export async function generateTaskCompletionReply(
  context: TaskCompletionReplyContext
): Promise<TaskCompletionReplyResult> {
  const startTime = Date.now();

  // Build personalized style context
  const styleContext = await buildStyleContext({
    workspaceId: context.workspaceId,
    userId: context.userId,
    conversationContext: context.originalMessageText,
  });

  const sanitizedOriginal = prepareForAI(context.originalMessageText).sanitized;

  const typeLabel =
    context.actionableType === 'action_request'
      ? 'Someone asked this user to do something'
      : context.actionableType === 'commitment'
        ? 'This user committed to doing something'
        : 'This had a deadline';

  let userPrompt = `<task_context>
<type>${typeLabel}</type>
<task_title>${prepareForAI(context.taskTitle).sanitized}</task_title>
${context.taskDescription ? `<task_description>${prepareForAI(context.taskDescription).sanitized}</task_description>` : ''}
<original_message>${sanitizedOriginal}</original_message>
${context.completionNote ? `<completion_note>The user wants to mention: ${prepareForAI(context.completionNote).sanitized}</completion_note>` : ''}
</task_context>

Write a brief Slack thread reply from this user acknowledging they've completed this. ${context.completionNote ? 'Incorporate the completion note details naturally.' : 'Keep it simple and natural.'}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: [
        {
          type: 'text',
          text: TASK_COMPLETION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
        ...(styleContext.promptText
          ? [
              {
                type: 'text' as const,
                text: styleContext.promptText,
                cache_control: { type: 'ephemeral' as const },
              },
            ]
          : []),
      ],
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const rawReply =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const reply = sanitizeAIOutput(rawReply).trim();

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      {
        workspaceId: context.workspaceId,
        userId: context.userId,
        taskTitle: context.taskTitle,
        processingTimeMs,
        replyLength: reply.length,
      },
      'Task completion reply generated'
    );

    return { reply, processingTimeMs };
  } catch (error) {
    logger.error(
      { error, workspaceId: context.workspaceId, userId: context.userId },
      'Failed to generate task completion reply'
    );
    throw error;
  }
}
