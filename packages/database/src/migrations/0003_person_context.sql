-- Create person_context table for storing user notes about people
CREATE TABLE IF NOT EXISTS "person_context" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "user_id" text NOT NULL,
  "target_slack_user_id" text NOT NULL,
  "context_text" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create indexes for person_context
CREATE INDEX IF NOT EXISTS "person_context_workspace_user_idx" ON "person_context" ("workspace_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "person_context_unique_idx" ON "person_context" ("workspace_id", "user_id", "target_slack_user_id");

-- Enable RLS on person_context
ALTER TABLE "person_context" ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy for person_context
CREATE POLICY "tenant_isolation" ON "person_context"
  USING ("workspace_id" = current_setting('app.current_workspace_id')::uuid);
