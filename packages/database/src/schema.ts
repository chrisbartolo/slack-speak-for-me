import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: text('team_id').notNull().unique(),
  enterpriseId: text('enterprise_id'),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const installations = pgTable('installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  botToken: text('bot_token').notNull(),
  botUserId: text('bot_user_id'),
  botScopes: text('bot_scopes'),
  userToken: text('user_token'),
  userId: text('user_id'),
  userScopes: text('user_scopes'),
  installedAt: timestamp('installed_at').defaultNow(),
}, (table) => ({
  workspaceIdx: index('installations_workspace_id_idx').on(table.workspaceId),
}));

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  slackUserId: text('slack_user_id').notNull(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceIdx: index('users_workspace_id_idx').on(table.workspaceId),
  slackUserIdx: index('users_slack_user_id_idx').on(table.slackUserId),
}));

export const watchedConversations = pgTable('watched_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  channelId: text('channel_id').notNull(),
  watchedAt: timestamp('watched_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('watched_conversations_workspace_user_idx').on(table.workspaceId, table.userId),
  uniqueWatch: uniqueIndex('watched_conversations_unique_watch_idx').on(table.workspaceId, table.userId, table.channelId),
}));

export const threadParticipants = pgTable('thread_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  channelId: text('channel_id').notNull(),
  threadTs: text('thread_ts').notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow(),
}, (table) => ({
  workspaceChannelThreadIdx: index('thread_participants_workspace_channel_thread_idx').on(table.workspaceId, table.channelId, table.threadTs),
  uniqueParticipation: uniqueIndex('thread_participants_unique_participation_idx').on(table.workspaceId, table.userId, table.channelId, table.threadTs),
}));
