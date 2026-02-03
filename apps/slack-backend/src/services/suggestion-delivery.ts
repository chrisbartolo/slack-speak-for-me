import type { WebClient } from '@slack/web-api';
import type { Block, KnownBlock } from '@slack/types';

interface UsageInfo {
  used: number;
  limit: number;
  warningLevel: 'safe' | 'warning' | 'critical' | 'exceeded';
  planId: string;
}

interface SuggestionDeliveryOptions {
  client: WebClient;
  channelId: string;
  userId: string;
  suggestionId: string;
  suggestion: string;
  triggerContext: 'mention' | 'reply' | 'thread' | 'message_action' | 'dm';
  usageInfo?: UsageInfo;
}

/**
 * Build Block Kit blocks for suggestion ephemeral message
 */
export function buildSuggestionBlocks(
  suggestionId: string,
  suggestion: string,
  triggerContext: 'mention' | 'reply' | 'thread' | 'message_action' | 'dm',
  usageInfo?: UsageInfo
): (Block | KnownBlock)[] {
  // Map trigger context to user-friendly text
  const contextLabels: Record<typeof triggerContext, string> = {
    mention: 'someone mentioned you',
    reply: 'someone replied to you',
    thread: 'new activity in a thread you\'re following',
    message_action: 'you requested a suggestion',
    dm: 'someone messaged you directly',
  };

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '💬 Suggested Response',
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Because ${contextLabels[triggerContext]}_`,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: suggestion,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📤 Send as Me',
            emoji: true,
          },
          action_id: 'send_suggestion',
          value: JSON.stringify({ suggestionId, suggestion }),
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✨ Refine',
            emoji: true,
          },
          action_id: 'refine_suggestion',
          value: JSON.stringify({ suggestionId, suggestion }),
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Dismiss',
            emoji: true,
          },
          action_id: 'dismiss_suggestion',
          value: suggestionId,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_Only visible to you. Select the text above to copy, then paste into the conversation._',
        },
      ],
    },
  ];

  // Add usage context block if provided
  if (usageInfo) {
    let usageText = `${usageInfo.used}/${usageInfo.limit} suggestions used this month`;

    if (usageInfo.warningLevel === 'warning') {
      const percentUsed = Math.round((usageInfo.used / usageInfo.limit) * 100);
      usageText = `⚠️ ${usageInfo.used}/${usageInfo.limit} suggestions used this month (${percentUsed}% used)`;
    } else if (usageInfo.warningLevel === 'critical') {
      const remaining = Math.max(0, usageInfo.limit - usageInfo.used);
      usageText = `🚨 Only ${remaining} suggestion${remaining !== 1 ? 's' : ''} remaining this month!`;
    } else if (usageInfo.warningLevel === 'exceeded') {
      usageText = `📊 Over limit: ${usageInfo.used}/${usageInfo.limit} used (overage charges apply)`;
    }

    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: usageText,
      }],
    });
  }

  return blocks;
}

/**
 * Send suggestion as ephemeral message to user
 */
export async function sendSuggestionEphemeral(
  options: SuggestionDeliveryOptions
): Promise<void> {
  const { client, channelId, userId, suggestionId, suggestion, triggerContext, usageInfo } = options;

  const blocks = buildSuggestionBlocks(suggestionId, suggestion, triggerContext, usageInfo);

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: 'Here\'s a suggested response for you',
    blocks,
  });
}
