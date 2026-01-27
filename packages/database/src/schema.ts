import { pgTable, uuid, text, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';

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

export const userStylePreferences = pgTable('user_style_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  tone: text('tone'),
  formality: text('formality'),
  preferredPhrases: jsonb('preferred_phrases').$type<string[]>().default([]),
  avoidPhrases: jsonb('avoid_phrases').$type<string[]>().default([]),
  customGuidance: text('custom_guidance'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: uniqueIndex('user_style_preferences_workspace_user_idx').on(table.workspaceId, table.userId),
}));

export const messageEmbeddings = pgTable('message_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  messageText: text('message_text').notNull(),
  threadContext: text('thread_context'),
  embedding: text('embedding').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('message_embeddings_workspace_user_idx').on(table.workspaceId, table.userId),
  createdAtIdx: index('message_embeddings_created_at_idx').on(table.createdAt),
}));

export const refinementFeedback = pgTable('refinement_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  suggestionId: text('suggestion_id').notNull(),
  originalText: text('original_text').notNull(),
  modifiedText: text('modified_text').notNull(),
  refinementType: text('refinement_type'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('refinement_feedback_workspace_user_idx').on(table.workspaceId, table.userId),
}));

export const gdprConsent = pgTable('gdpr_consent', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  consentType: text('consent_type').notNull(),
  consentedAt: timestamp('consented_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceIdx: index('gdpr_consent_workspace_id_idx').on(table.workspaceId),
  uniqueConsent: uniqueIndex('gdpr_consent_unique_idx').on(table.workspaceId, table.userId, table.consentType),
}));

export const personContext = pgTable('person_context', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(), // The user who owns this context
  targetSlackUserId: text('target_slack_user_id').notNull(), // The person they're adding context about
  contextText: text('context_text').notNull(), // Free-form notes (max 1000 chars enforced at app level)
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('person_context_workspace_user_idx').on(table.workspaceId, table.userId),
  uniquePersonContext: uniqueIndex('person_context_unique_idx').on(table.workspaceId, table.userId, table.targetSlackUserId),
}));
