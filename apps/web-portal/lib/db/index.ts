import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  organizations,
  workspaces,
  installations,
  users,
  watchedConversations,
  threadParticipants,
  userStylePreferences,
  messageEmbeddings,
  refinementFeedback,
  gdprConsent,
  personContext,
  reportSettings,
  googleIntegrations,
  workflowConfig,
} from '@slack-speak/database';

const connectionString = process.env.DATABASE_URL || '';

// Use postgres.js to match the database package
const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create schema object explicitly for proper type inference
const schema = {
  organizations,
  workspaces,
  installations,
  users,
  watchedConversations,
  threadParticipants,
  userStylePreferences,
  messageEmbeddings,
  refinementFeedback,
  gdprConsent,
  personContext,
  reportSettings,
  googleIntegrations,
  workflowConfig,
};

export const db = drizzle(queryClient, { schema });

// Re-export schema for consistent type usage
export { schema };
