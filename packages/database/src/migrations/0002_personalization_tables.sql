-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create user_style_preferences table
CREATE TABLE IF NOT EXISTS "user_style_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "user_id" text NOT NULL,
  "tone" text,
  "formality" text,
  "preferred_phrases" jsonb DEFAULT '[]'::jsonb,
  "avoid_phrases" jsonb DEFAULT '[]'::jsonb,
  "custom_guidance" text,
  "updated_at" timestamp DEFAULT now()
);

-- Create unique index for user_style_preferences
CREATE UNIQUE INDEX IF NOT EXISTS "user_style_preferences_workspace_user_idx" ON "user_style_preferences" ("workspace_id", "user_id");

-- Enable RLS on user_style_preferences
ALTER TABLE "user_style_preferences" ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy for user_style_preferences
CREATE POLICY "tenant_isolation" ON "user_style_preferences"
  USING ("workspace_id" = current_setting('app.current_workspace_id')::uuid);

-- Create message_embeddings table with vector column
CREATE TABLE IF NOT EXISTS "message_embeddings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "user_id" text NOT NULL,
  "message_text" text NOT NULL,
  "thread_context" text,
  "embedding" vector(1536) NOT NULL,
  "created_at" timestamp DEFAULT now()
);

-- Create indexes for message_embeddings
CREATE INDEX IF NOT EXISTS "message_embeddings_workspace_user_idx" ON "message_embeddings" ("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "message_embeddings_created_at_idx" ON "message_embeddings" ("created_at");

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS "message_embeddings_embedding_idx" ON "message_embeddings"
  USING hnsw (embedding vector_cosine_ops);

-- Enable RLS on message_embeddings
ALTER TABLE "message_embeddings" ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy for message_embeddings
CREATE POLICY "tenant_isolation" ON "message_embeddings"
  USING ("workspace_id" = current_setting('app.current_workspace_id')::uuid);

-- Create refinement_feedback table
CREATE TABLE IF NOT EXISTS "refinement_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "user_id" text NOT NULL,
  "suggestion_id" text NOT NULL,
  "original_text" text NOT NULL,
  "modified_text" text NOT NULL,
  "refinement_type" text,
  "created_at" timestamp DEFAULT now()
);

-- Create index for refinement_feedback
CREATE INDEX IF NOT EXISTS "refinement_feedback_workspace_user_idx" ON "refinement_feedback" ("workspace_id", "user_id");

-- Enable RLS on refinement_feedback
ALTER TABLE "refinement_feedback" ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy for refinement_feedback
CREATE POLICY "tenant_isolation" ON "refinement_feedback"
  USING ("workspace_id" = current_setting('app.current_workspace_id')::uuid);

-- Create gdpr_consent table
CREATE TABLE IF NOT EXISTS "gdpr_consent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "user_id" text NOT NULL,
  "consent_type" text NOT NULL,
  "consented_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

-- Create indexes for gdpr_consent
CREATE INDEX IF NOT EXISTS "gdpr_consent_workspace_id_idx" ON "gdpr_consent" ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "gdpr_consent_unique_idx" ON "gdpr_consent" ("workspace_id", "user_id", "consent_type");

-- Enable RLS on gdpr_consent
ALTER TABLE "gdpr_consent" ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy for gdpr_consent
CREATE POLICY "tenant_isolation" ON "gdpr_consent"
  USING ("workspace_id" = current_setting('app.current_workspace_id')::uuid);
