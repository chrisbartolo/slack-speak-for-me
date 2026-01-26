import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

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
