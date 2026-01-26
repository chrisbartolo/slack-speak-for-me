import { z } from 'zod';

// Base patterns for Slack IDs
const slackUserId = z.string().regex(/^U[A-Z0-9]+$/, 'Invalid Slack user ID');
const slackChannelId = z.string().regex(/^[CDG][A-Z0-9]+$/, 'Invalid Slack channel ID');
const slackTeamId = z.string().regex(/^T[A-Z0-9]+$/, 'Invalid Slack team ID');
const slackTimestamp = z.string().regex(/^\d+\.\d+$/, 'Invalid Slack timestamp');

// Message event schema
export const SlackMessageSchema = z.object({
  type: z.literal('message'),
  subtype: z.string().optional(),
  text: z.string()
    .max(40000, 'Message too long') // Slack's max is ~40k
    .refine(
      (text) => !text.includes('\x00'),
      'Invalid characters in message'
    ),
  user: slackUserId,
  channel: slackChannelId,
  ts: slackTimestamp,
  thread_ts: slackTimestamp.optional(),
  team: slackTeamId.optional(),
});

// App mention event schema
export const SlackAppMentionSchema = z.object({
  type: z.literal('app_mention'),
  text: z.string().max(40000),
  user: slackUserId,
  channel: slackChannelId,
  ts: slackTimestamp,
  thread_ts: slackTimestamp.optional(),
  team: slackTeamId,
});

// Generic event wrapper
export const SlackEventSchema = z.object({
  type: z.string(),
  event_ts: slackTimestamp,
  team_id: slackTeamId.optional(),
});

// Message action payload (for "Help me respond")
export const SlackMessageActionSchema = z.object({
  type: z.literal('message_action'),
  callback_id: z.string(),
  trigger_id: z.string(),
  message: z.object({
    type: z.literal('message'),
    text: z.string().max(40000),
    user: slackUserId,
    ts: slackTimestamp,
  }),
  channel: z.object({
    id: slackChannelId,
    name: z.string().optional(),
  }),
  user: z.object({
    id: slackUserId,
    name: z.string().optional(),
  }),
  team: z.object({
    id: slackTeamId,
  }),
});

// Export types
export type SlackMessage = z.infer<typeof SlackMessageSchema>;
export type SlackAppMention = z.infer<typeof SlackAppMentionSchema>;
export type SlackMessageAction = z.infer<typeof SlackMessageActionSchema>;
