-- Create watched_conversations table
CREATE TABLE IF NOT EXISTS "watched_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "user_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "watched_at" timestamp DEFAULT now()
);

-- Create indexes for watched_conversations
CREATE INDEX IF NOT EXISTS "watched_conversations_workspace_user_idx" ON "watched_conversations" ("workspace_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "watched_conversations_unique_watch_idx" ON "watched_conversations" ("workspace_id", "user_id", "channel_id");

-- Enable RLS on watched_conversations
ALTER TABLE "watched_conversations" ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy for watched_conversations
CREATE POLICY "tenant_isolation" ON "watched_conversations"
  USING ("workspace_id" = current_setting('app.current_workspace_id')::uuid);

-- Create thread_participants table
CREATE TABLE IF NOT EXISTS "thread_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "user_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "thread_ts" text NOT NULL,
  "last_message_at" timestamp DEFAULT now()
);

-- Create indexes for thread_participants
CREATE INDEX IF NOT EXISTS "thread_participants_workspace_channel_thread_idx" ON "thread_participants" ("workspace_id", "channel_id", "thread_ts");
CREATE UNIQUE INDEX IF NOT EXISTS "thread_participants_unique_participation_idx" ON "thread_participants" ("workspace_id", "user_id", "channel_id", "thread_ts");

-- Enable RLS on thread_participants
ALTER TABLE "thread_participants" ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy for thread_participants
CREATE POLICY "tenant_isolation" ON "thread_participants"
  USING ("workspace_id" = current_setting('app.current_workspace_id')::uuid);
