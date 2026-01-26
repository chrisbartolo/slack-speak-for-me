-- Create workspaces table
CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" text NOT NULL,
	"enterprise_id" text,
	"name" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "workspaces_team_id_unique" UNIQUE("team_id")
);

-- Create installations table
CREATE TABLE IF NOT EXISTS "installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"bot_token" text NOT NULL,
	"bot_user_id" text,
	"bot_scopes" text,
	"user_token" text,
	"user_id" text,
	"user_scopes" text,
	"installed_at" timestamp DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slack_user_id" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "installations" ADD CONSTRAINT "installations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "installations_workspace_id_idx" ON "installations" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "users_workspace_id_idx" ON "users" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "users_slack_user_id_idx" ON "users" USING btree ("slack_user_id");

-- Enable Row-Level Security on users table
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY tenant_isolation ON "users"
USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
