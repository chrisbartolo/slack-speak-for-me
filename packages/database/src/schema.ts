import { pgTable, uuid, text, timestamp, index, uniqueIndex, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

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
  workspaceUnique: uniqueIndex('installations_workspace_id_unique').on(table.workspaceId),
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
  targetUserName: text('target_user_name'), // Display name for the target user
  contextText: text('context_text').notNull(), // Free-form notes (max 1000 chars enforced at app level)
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('person_context_workspace_user_idx').on(table.workspaceId, table.userId),
  uniquePersonContext: uniqueIndex('person_context_unique_idx').on(table.workspaceId, table.userId, table.targetSlackUserId),
}));

export const reportSettings = pgTable('report_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),

  // Schedule settings
  enabled: boolean('enabled').default(false),
  dayOfWeek: integer('day_of_week').default(1), // 0=Sunday, 1=Monday, etc.
  timeOfDay: text('time_of_day').default('09:00'), // HH:mm format
  timezone: text('timezone').default('UTC'),

  // Format settings
  format: text('format').default('detailed'), // 'concise' | 'detailed'
  sections: jsonb('sections').$type<string[]>().default(['achievements', 'focus', 'blockers', 'shoutouts']),

  // Delivery settings
  autoSend: boolean('auto_send').default(false), // false = draft for review, true = auto-send
  recipientChannelId: text('recipient_channel_id'), // DM or channel to send to

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueSettings: uniqueIndex('report_settings_unique_idx').on(table.workspaceId, table.userId),
}));

export const googleIntegrations = pgTable('google_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(), // Slack user ID
  accessToken: text('access_token').notNull(), // Encrypted
  refreshToken: text('refresh_token'), // Encrypted, nullable (may not always be returned)
  expiresAt: timestamp('expires_at'), // When access token expires
  scope: text('scope'), // Granted scopes
  spreadsheetId: text('spreadsheet_id'), // User's configured spreadsheet
  spreadsheetName: text('spreadsheet_name'), // Display name for UI
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueIntegration: uniqueIndex('google_integrations_unique_idx').on(table.workspaceId, table.userId),
}));
