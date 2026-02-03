import { pgTable, uuid, text, timestamp, index, uniqueIndex, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

// Organizations table for billing and workspace grouping
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // URL-friendly identifier

  // Billing fields
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status'), // 'active' | 'past_due' | 'canceled' | 'trialing'
  planId: text('plan_id'), // 'free' | 'pro' | 'enterprise'
  seatCount: integer('seat_count').default(1),
  trialEndsAt: timestamp('trial_ends_at'), // When free trial expires
  billingEmail: text('billing_email'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
  stripeCustomerIdx: index('organizations_stripe_customer_idx').on(table.stripeCustomerId),
}));

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: text('team_id').notNull().unique(),
  enterpriseId: text('enterprise_id'),
  name: text('name'),
  organizationId: uuid('organization_id').references(() => organizations.id), // Link to organization for billing
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
  role: text('role').default('member'), // 'admin' | 'member' | 'viewer'
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceIdx: index('users_workspace_id_idx').on(table.workspaceId),
  slackUserIdx: index('users_slack_user_id_idx').on(table.slackUserId),
  roleIdx: index('users_role_idx').on(table.role),
}));

export const watchedConversations = pgTable('watched_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  channelId: text('channel_id').notNull(),
  channelName: text('channel_name'),  // Display name for UI (e.g., "#general")
  channelType: text('channel_type'),  // 'channel' | 'group' | 'im' | 'mpim'
  autoRespond: boolean('auto_respond').default(false), // YOLO mode: auto-respond on behalf of user
  watchedAt: timestamp('watched_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('watched_conversations_workspace_user_idx').on(table.workspaceId, table.userId),
  uniqueWatch: uniqueIndex('watched_conversations_unique_watch_idx').on(table.workspaceId, table.userId, table.channelId),
}));

// Log of auto-sent messages (YOLO mode)
export const autoRespondLog = pgTable('auto_respond_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  channelId: text('channel_id').notNull(),
  threadTs: text('thread_ts'), // Thread timestamp if reply
  triggerMessageTs: text('trigger_message_ts').notNull(), // Message that triggered response
  triggerMessageText: text('trigger_message_text'), // Text of trigger message
  responseText: text('response_text').notNull(), // What AI sent
  responseMessageTs: text('response_message_ts'), // TS of sent message (for undo)
  status: text('status').default('sent'), // 'sent' | 'undone' | 'edited'
  sentAt: timestamp('sent_at').defaultNow(),
  undoneAt: timestamp('undone_at'),
}, (table) => ({
  workspaceUserIdx: index('auto_respond_log_workspace_user_idx').on(table.workspaceId, table.userId),
  channelIdx: index('auto_respond_log_channel_idx').on(table.channelId),
  sentAtIdx: index('auto_respond_log_sent_at_idx').on(table.sentAt),
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

// Context for channels, group chats, and DMs
export const conversationContext = pgTable('conversation_context', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(), // The user who owns this context
  channelId: text('channel_id').notNull(), // The channel/DM/group this context is about
  channelName: text('channel_name'), // Display name for UI
  channelType: text('channel_type'), // 'channel' | 'group' | 'im' | 'mpim'
  contextText: text('context_text').notNull(), // Free-form notes about this conversation
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('conversation_context_workspace_user_idx').on(table.workspaceId, table.userId),
  uniqueConversationContext: uniqueIndex('conversation_context_unique_idx').on(table.workspaceId, table.userId, table.channelId),
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

export const workflowConfig = pgTable('workflow_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(), // Owner of this config
  channelId: text('channel_id').notNull(), // Channel to monitor
  channelName: text('channel_name'), // Display name
  workflowBotId: text('workflow_bot_id'), // Bot ID that posts workflow submissions (learned from first submission)
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueConfig: uniqueIndex('workflow_config_unique_idx').on(table.workspaceId, table.userId, table.channelId),
  channelIdx: index('workflow_config_channel_idx').on(table.workspaceId, table.channelId),
}));

export const suggestionFeedback = pgTable('suggestion_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  suggestionId: text('suggestion_id').notNull(), // Unique ID for the suggestion
  action: text('action').notNull(), // 'accepted' | 'refined' | 'dismissed' | 'sent'
  originalText: text('original_text'), // The AI suggestion text
  finalText: text('final_text'), // Final text after any modifications
  triggerContext: text('trigger_context'), // The message that triggered the suggestion
  channelId: text('channel_id'), // Where the suggestion was triggered
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('suggestion_feedback_workspace_user_idx').on(table.workspaceId, table.userId),
  createdAtIdx: index('suggestion_feedback_created_at_idx').on(table.createdAt),
  actionIdx: index('suggestion_feedback_action_idx').on(table.action),
  suggestionIdx: uniqueIndex('suggestion_feedback_suggestion_idx').on(table.suggestionId, table.action),
}));

// Audit logs for security-relevant events
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Who
  userId: text('user_id'), // Slack user ID (may be null for system events)
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // What
  action: text('action').notNull(), // 'login', 'logout', 'data_export', 'data_delete', etc.
  resource: text('resource'), // 'user', 'workspace', 'subscription', etc.
  resourceId: text('resource_id'), // UUID or ID of affected resource

  // Details
  details: jsonb('details').$type<Record<string, unknown>>(),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),

  // When
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index('audit_logs_workspace_idx').on(table.workspaceId),
  userIdx: index('audit_logs_user_idx').on(table.userId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}));

// Type-safe audit action union
export type AuditAction =
  | 'login'
  | 'logout'
  | 'data_export_requested'
  | 'data_export_completed'
  | 'data_delete_requested'
  | 'data_delete_completed'
  | 'subscription_created'
  | 'subscription_cancelled'
  | 'settings_changed'
  | 'oauth_connected'
  | 'oauth_disconnected'
  | 'admin_action';

// Individual user subscriptions (email-based for cross-workspace identity)
export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identity - email is the stable identifier across workspaces
  email: text('email').notNull(),

  // Stripe billing
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status'), // 'active' | 'trialing' | 'paused' | 'canceled'
  planId: text('plan_id'), // 'individual_starter' | 'individual_pro'
  trialEndsAt: timestamp('trial_ends_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('user_subscriptions_email_idx').on(table.email),
  stripeCustomerIdx: index('user_subscriptions_stripe_customer_idx').on(table.stripeCustomerId),
}));

// Usage tracking for billing and limit enforcement
export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Who used it (email for individual, orgId for team)
  email: text('email'), // Individual user email
  organizationId: uuid('organization_id').references(() => organizations.id), // Team/org

  // What billing period
  billingPeriodStart: timestamp('billing_period_start').notNull(),
  billingPeriodEnd: timestamp('billing_period_end').notNull(),

  // Counts
  suggestionsUsed: integer('suggestions_used').default(0).notNull(),
  suggestionsIncluded: integer('suggestions_included').notNull(), // Snapshot of plan limit
  overageReported: boolean('overage_reported').default(false), // Has overage been sent to Stripe

  // Stripe metered billing
  stripeSubscriptionItemId: text('stripe_subscription_item_id'), // For reporting overage
  stripeMeterId: text('stripe_meter_id'), // Stripe billing meter ID for this period
  planId: text('plan_id'), // Plan during this billing period (for historical reference)

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  emailPeriodIdx: uniqueIndex('usage_records_email_period_idx').on(table.email, table.billingPeriodStart),
  orgPeriodIdx: uniqueIndex('usage_records_org_period_idx').on(table.organizationId, table.billingPeriodStart),
  periodEndIdx: index('usage_records_period_end_idx').on(table.billingPeriodEnd),
}));

// Individual usage events (for detailed tracking)
export const usageEvents = pgTable('usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Who
  email: text('email'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  slackUserId: text('slack_user_id').notNull(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),

  // What
  eventType: text('event_type').notNull(), // 'suggestion' | 'refinement'
  channelId: text('channel_id'),

  // Cost tracking
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  estimatedCost: integer('estimated_cost'), // In cents (for internal tracking)

  // Stripe reporting
  stripeReportedAt: timestamp('stripe_reported_at'), // null means not yet reported to Stripe

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('usage_events_email_idx').on(table.email),
  orgIdx: index('usage_events_org_idx').on(table.organizationId),
  createdAtIdx: index('usage_events_created_at_idx').on(table.createdAt),
  eventTypeIdx: index('usage_events_type_idx').on(table.eventType),
  stripeReportedIdx: index('usage_events_stripe_reported_idx').on(table.stripeReportedAt),
}));

// Coupons for discounts
export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),

  code: text('code').notNull(),
  description: text('description'),

  // Discount type
  discountType: text('discount_type').notNull(), // 'percent' | 'fixed'
  discountValue: integer('discount_value').notNull(), // Percent (0-100) or cents

  // Validity
  validFrom: timestamp('valid_from').defaultNow(),
  validUntil: timestamp('valid_until'),
  maxRedemptions: integer('max_redemptions'), // null = unlimited
  currentRedemptions: integer('current_redemptions').default(0),

  // Restrictions
  applicablePlans: jsonb('applicable_plans').$type<string[]>(), // null = all plans
  firstTimeOnly: boolean('first_time_only').default(true),
  minSeats: integer('min_seats'), // Minimum seats for team plans

  // Stripe
  stripeCouponId: text('stripe_coupon_id'),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  codeIdx: uniqueIndex('coupons_code_idx').on(table.code),
  activeIdx: index('coupons_active_idx').on(table.isActive),
}));

// Coupon redemptions
export const couponRedemptions = pgTable('coupon_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  couponId: uuid('coupon_id').notNull().references(() => coupons.id),
  email: text('email').notNull(), // Who redeemed
  organizationId: uuid('organization_id').references(() => organizations.id),

  // What they got
  discountApplied: integer('discount_applied').notNull(), // Cents saved

  redeemedAt: timestamp('redeemed_at').defaultNow(),
}, (table) => ({
  couponIdx: index('coupon_redemptions_coupon_idx').on(table.couponId),
  emailIdx: index('coupon_redemptions_email_idx').on(table.email),
}));

// Referral program
export const referrals = pgTable('referrals', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Referrer (existing user)
  referrerEmail: text('referrer_email').notNull(),
  referralCode: text('referral_code').notNull(),

  // Stats
  totalReferrals: integer('total_referrals').default(0),
  successfulReferrals: integer('successful_referrals').default(0), // Converted to paid
  totalRewardsEarned: integer('total_rewards_earned').default(0), // Cents

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  referrerIdx: uniqueIndex('referrals_referrer_idx').on(table.referrerEmail),
  codeIdx: uniqueIndex('referrals_code_idx').on(table.referralCode),
}));

// Individual referral events
export const referralEvents = pgTable('referral_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  referralId: uuid('referral_id').notNull().references(() => referrals.id),

  // Referee (new user)
  refereeEmail: text('referee_email').notNull(),

  // Status
  status: text('status').notNull(), // 'invited' | 'signed_up' | 'subscribed' | 'rewarded'

  // Rewards
  referrerReward: integer('referrer_reward'), // Cents or days credited
  refereeDiscount: integer('referee_discount'), // Percent off first month

  // Tracking
  signedUpAt: timestamp('signed_up_at'),
  subscribedAt: timestamp('subscribed_at'),
  rewardedAt: timestamp('rewarded_at'),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  referralIdx: index('referral_events_referral_idx').on(table.referralId),
  refereeIdx: uniqueIndex('referral_events_referee_idx').on(table.refereeEmail),
  statusIdx: index('referral_events_status_idx').on(table.status),
}));

// Actionable items detected from messages
export const actionableItems = pgTable('actionable_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(), // Slack user ID (owner of the task)

  // Task content
  title: text('title').notNull(),
  description: text('description'),

  // Status tracking: 'pending' | 'completed' | 'dismissed' | 'snoozed'
  status: text('status').default('pending'),

  // Source message reference
  channelId: text('channel_id').notNull(),
  messageTs: text('message_ts').notNull(),
  threadTs: text('thread_ts'),
  messageText: text('message_text'),

  // Actionable classification: 'action_request' | 'commitment' | 'deadline'
  actionableType: text('actionable_type').notNull(),

  // Due date handling
  dueDate: timestamp('due_date'),
  dueDateConfidence: text('due_date_confidence'), // 'explicit' | 'implicit' | 'inferred'
  originalDueDateText: text('original_due_date_text'), // e.g., "by Friday", "tomorrow"

  // AI confidence and metadata
  confidenceScore: integer('confidence_score'), // 0-100
  aiMetadata: jsonb('ai_metadata').$type<{
    model: string;
    processingTimeMs: number;
    reasoning?: string;
  }>(),

  // Snooze handling
  snoozedUntil: timestamp('snoozed_until'),

  // Completion reply
  completionNote: text('completion_note'),       // User's note when completing
  completionReplyTs: text('completion_reply_ts'), // Slack ts of the posted reply

  // Timestamps
  detectedAt: timestamp('detected_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  dismissedAt: timestamp('dismissed_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index('actionable_items_workspace_user_idx').on(table.workspaceId, table.userId),
  statusIdx: index('actionable_items_status_idx').on(table.status),
  dueDateIdx: index('actionable_items_due_date_idx').on(table.dueDate),
  detectedAtIdx: index('actionable_items_detected_at_idx').on(table.detectedAt),
  // Prevent duplicate detection for same message
  channelMessageIdx: uniqueIndex('actionable_items_channel_message_idx').on(
    table.workspaceId,
    table.userId,
    table.channelId,
    table.messageTs
  ),
}));

// Type exports for actionable items
export type ActionableItem = typeof actionableItems.$inferSelect;
export type NewActionableItem = typeof actionableItems.$inferInsert;
export type ActionableStatus = 'pending' | 'completed' | 'dismissed' | 'snoozed';
export type ActionableType = 'action_request' | 'commitment' | 'deadline';

// Client profiles for tracking client relationships
export const clientProfiles = pgTable('client_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  companyName: text('company_name').notNull(),
  domain: text('domain'), // nullable, for auto-detection hint like "acme.com"
  servicesProvided: jsonb('services_provided').$type<string[]>(), // nullable
  contractDetails: text('contract_details'), // nullable, max 2000 chars enforced at app level
  accountManager: text('account_manager'), // nullable, Slack user ID
  relationshipStatus: text('relationship_status').default('active'), // 'active' | 'at_risk' | 'churned'
  lifetimeValue: integer('lifetime_value'), // nullable, in cents
  startDate: timestamp('start_date'), // nullable
  renewalDate: timestamp('renewal_date'), // nullable
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('client_profiles_org_idx').on(table.organizationId),
  domainIdx: index('client_profiles_domain_idx').on(table.domain),
}));

// Client contacts linking Slack users to client profiles
export const clientContacts = pgTable('client_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientProfileId: uuid('client_profile_id').notNull().references(() => clientProfiles.id),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  slackUserId: text('slack_user_id').notNull(),
  slackUserName: text('slack_user_name'), // nullable
  role: text('role'), // nullable, e.g., "Technical Lead", "Product Owner"
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueContact: uniqueIndex('client_contacts_unique_idx').on(table.clientProfileId, table.workspaceId, table.slackUserId),
}));

// Brand voice templates for consistent communication tone
export const brandVoiceTemplates = pgTable('brand_voice_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'), // nullable
  toneGuidelines: text('tone_guidelines').notNull(),
  approvedPhrases: jsonb('approved_phrases').$type<string[]>(), // nullable
  forbiddenPhrases: jsonb('forbidden_phrases').$type<string[]>(), // nullable
  responsePatterns: jsonb('response_patterns').$type<Array<{ situation: string; pattern: string }>>(), // nullable
  isDefault: boolean('is_default').default(false),
  applicableTo: text('applicable_to'), // nullable, values: 'all' | 'client_conversations' | 'internal_only'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('brand_voice_templates_org_idx').on(table.organizationId),
}));

// Knowledge base documents with embeddings for RAG
export const knowledgeBaseDocuments = pgTable('knowledge_base_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category'), // nullable
  tags: jsonb('tags').$type<string[]>(), // nullable
  embedding: text('embedding').notNull(), // stored as vector string, pgvector handles casting
  sourceUrl: text('source_url'), // nullable
  lastReviewedAt: timestamp('last_reviewed_at'), // nullable
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('knowledge_base_documents_org_idx').on(table.organizationId),
  categoryIdx: index('knowledge_base_documents_category_idx').on(table.category),
}));

// Escalation alerts for tension detection and SLA breaches
export const escalationAlerts = pgTable('escalation_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  clientProfileId: uuid('client_profile_id').references(() => clientProfiles.id), // nullable
  channelId: text('channel_id').notNull(),
  messageTs: text('message_ts').notNull(),
  alertType: text('alert_type').notNull(), // 'tension_detected' | 'sla_breach' | 'churn_risk'
  severity: text('severity').notNull(), // 'medium' | 'high' | 'critical'
  summary: text('summary').notNull(),
  suggestedAction: text('suggested_action'), // nullable
  sentiment: jsonb('sentiment'), // nullable, stores SentimentAnalysis object
  status: text('status').default('open'), // 'open' | 'acknowledged' | 'resolved' | 'false_positive'
  acknowledgedBy: text('acknowledged_by'), // nullable, Slack user ID
  acknowledgedAt: timestamp('acknowledged_at'), // nullable
  resolvedAt: timestamp('resolved_at'), // nullable
  resolutionNotes: text('resolution_notes'), // nullable
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgIdx: index('escalation_alerts_org_idx').on(table.organizationId),
  statusIdx: index('escalation_alerts_status_idx').on(table.status),
  severityIdx: index('escalation_alerts_severity_idx').on(table.severity),
}));

// Type exports for client context tables
export type ClientProfile = typeof clientProfiles.$inferSelect;
export type NewClientProfile = typeof clientProfiles.$inferInsert;
export type ClientContact = typeof clientContacts.$inferSelect;
export type NewClientContact = typeof clientContacts.$inferInsert;
export type BrandVoiceTemplate = typeof brandVoiceTemplates.$inferSelect;
export type NewBrandVoiceTemplate = typeof brandVoiceTemplates.$inferInsert;
export type KnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferSelect;
export type NewKnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferInsert;
export type EscalationAlert = typeof escalationAlerts.$inferSelect;
export type NewEscalationAlert = typeof escalationAlerts.$inferInsert;

// Org-wide style guidelines configuration
export const orgStyleSettings = pgTable('org_style_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  styleMode: text('style_mode').default('fallback'), // 'override' | 'layer' | 'fallback'
  tone: text('tone'),
  formality: text('formality'),
  preferredPhrases: jsonb('preferred_phrases').$type<string[]>(),
  avoidPhrases: jsonb('avoid_phrases').$type<string[]>(),
  customGuidance: text('custom_guidance'),
  yoloModeGlobal: boolean('yolo_mode_global').default(false),
  yoloModeUserOverrides: jsonb('yolo_mode_user_overrides').$type<Record<string, boolean>>(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: uniqueIndex('org_style_settings_org_idx').on(table.organizationId),
}));

// Shared response templates with approval workflow
export const responseTemplates = pgTable('response_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  templateType: text('template_type').notNull(), // 'canned' | 'starter' | 'playbook'
  content: text('content').notNull(),
  submittedBy: text('submitted_by').notNull(), // Slack user ID
  status: text('status').default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('response_templates_org_idx').on(table.organizationId),
  statusIdx: index('response_templates_status_idx').on(table.status),
}));

// Content guardrail configuration per org
export const guardrailConfig = pgTable('guardrail_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  enabledCategories: jsonb('enabled_categories').$type<string[]>().default(['legal_advice', 'pricing_commitments', 'competitor_bashing']),
  blockedKeywords: jsonb('blocked_keywords').$type<string[]>().default([]),
  triggerMode: text('trigger_mode').default('hard_block'), // 'hard_block' | 'regenerate' | 'soft_warning'
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: uniqueIndex('guardrail_config_org_idx').on(table.organizationId),
}));

// Log of guardrail triggers
export const guardrailViolations = pgTable('guardrail_violations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: text('user_id').notNull(), // Slack user ID
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  violationType: text('violation_type').notNull(), // 'category' | 'keyword'
  violatedRule: text('violated_rule').notNull(),
  suggestionText: text('suggestion_text'), // Plan-gated visibility
  action: text('action').notNull(), // 'blocked' | 'regenerated' | 'warned'
  channelId: text('channel_id'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgIdx: index('guardrail_violations_org_idx').on(table.organizationId),
  createdAtIdx: index('guardrail_violations_created_at_idx').on(table.createdAt),
}));

// Type exports for Phase 13 tables
export type OrgStyleSettings = typeof orgStyleSettings.$inferSelect;
export type NewOrgStyleSettings = typeof orgStyleSettings.$inferInsert;
export type ResponseTemplate = typeof responseTemplates.$inferSelect;
export type NewResponseTemplate = typeof responseTemplates.$inferInsert;
export type GuardrailConfig = typeof guardrailConfig.$inferSelect;
export type NewGuardrailConfig = typeof guardrailConfig.$inferInsert;
export type GuardrailViolation = typeof guardrailViolations.$inferSelect;
export type NewGuardrailViolation = typeof guardrailViolations.$inferInsert;
