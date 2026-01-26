# Phase 01 Plan 01: Foundation - Monorepo & Database Schema Summary

**One-liner:** NPM workspaces monorepo with TypeScript, Drizzle ORM schema, and PostgreSQL RLS for multi-tenant isolation

---

## What Was Built

**Foundation established:**
- Monorepo structure using npm workspaces (apps/slack-backend, packages/database, packages/validation)
- TypeScript configuration with strict mode, ES2022 target, NodeNext module resolution
- Turbo.json for build orchestration
- Database schema with Drizzle ORM defining workspaces, installations, and users tables
- PostgreSQL Row-Level Security policies for tenant isolation on users table
- Snake_case column naming convention (team_id, workspace_id, slack_user_id) matching RLS policy syntax

**Key deliverables:**
1. Working monorepo with workspace dependencies
2. Slack backend app with @slack/bolt, ioredis, bullmq, drizzle-orm dependencies
3. Database package with schema, client, and withWorkspaceContext helper
4. Validation package scaffold for future zod schemas
5. Initial migration SQL with RLS policy: `tenant_isolation ON users USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid)`

---

## Tasks Completed

| # | Task | Type | Commit | Status |
|---|------|------|--------|--------|
| 1 | Scaffold monorepo with TypeScript | auto | 696fed6 | Complete |
| 2 | Create database schema with Drizzle and RLS | auto | 1ea5c85 | Complete |

---

## Files Created/Modified

**Created:**
- `package.json` - Root monorepo configuration with workspaces
- `tsconfig.json` - TypeScript strict config
- `turbo.json` - Build orchestration
- `.gitignore` - Standard Node.js ignores
- `.env.example` - Environment variable documentation
- `apps/slack-backend/package.json` - Backend app dependencies
- `apps/slack-backend/tsconfig.json` - Backend TypeScript config
- `apps/slack-backend/src/index.ts` - Entry point placeholder
- `packages/database/package.json` - Database package config
- `packages/database/tsconfig.json` - Database TypeScript config
- `packages/database/src/schema.ts` - Drizzle schema with workspaces, installations, users
- `packages/database/src/client.ts` - Database client with withWorkspaceContext helper
- `packages/database/src/index.ts` - Package exports
- `packages/database/drizzle.config.ts` - Drizzle kit configuration
- `packages/database/src/migrations/0000_initial_schema.sql` - Initial migration with RLS
- `packages/validation/package.json` - Validation package config
- `packages/validation/tsconfig.json` - Validation TypeScript config
- `packages/validation/src/index.ts` - Validation placeholder

**Modified:**
None (fresh project)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed workspace protocol for npm**

- **Found during:** Task 1 - npm install
- **Issue:** Used `workspace:*` protocol which is pnpm/yarn syntax, npm uses `*`
- **Fix:** Changed `"@slack-speak/database": "workspace:*"` to `"@slack-speak/database": "*"` in apps/slack-backend/package.json
- **Files modified:** apps/slack-backend/package.json
- **Impact:** Unblocked npm install

**2. [Rule 3 - Blocking] Fixed postgres client usage in withWorkspaceContext**

- **Found during:** Task 2 - TypeScript compilation
- **Issue:** Used `postgres.unsafe()` instead of `queryClient.unsafe()` - postgres is the module, queryClient is the instance
- **Fix:** Changed to use queryClient instance method
- **Files modified:** packages/database/src/client.ts
- **Impact:** Unblocked TypeScript compilation

---

## Decisions Made

1. **NPM workspaces over pnpm/yarn:** Kept tooling simple per plan instructions
2. **Snake_case for database columns:** Explicit naming in pgTable definitions (team_id, workspace_id) to match PostgreSQL convention and RLS policy syntax
3. **RLS only on users table:** Installations table accessed by system during OAuth, not per-tenant queries
4. **Drizzle kit generates second migration:** 0000_parallel_beyonder.sql auto-generated alongside manual 0000_initial_schema.sql; both included in commits

---

## Verification Results

All success criteria met:

- ✅ `npm install` completes successfully (287 packages)
- ✅ `npm run build --workspaces --if-present` compiles without TypeScript errors
- ✅ packages/database/src/schema.ts defines workspaces, installations, users tables
- ✅ packages/database/src/client.ts exports withWorkspaceContext helper
- ✅ Migration includes `ALTER TABLE users ENABLE ROW LEVEL SECURITY`
- ✅ Migration includes `CREATE POLICY tenant_isolation` with workspace_id (snake_case)
- ✅ Schema uses explicit snake_case column names matching RLS policy

---

## Technical Debt / Future Work

- Database migrations need to be applied to actual PostgreSQL instance (requires DATABASE_URL)
- Encryption implementation needed for bot_token and user_token columns
- Transaction handling in withWorkspaceContext may need refinement for error scenarios
- TypeScript build outputs (*.tsbuildinfo) should be added to .gitignore

---

## Next Phase Readiness

**Ready for Phase 01 Plan 02 (OAuth & Installation Storage):**
- ✅ Database schema with installations table
- ✅ Workspace package available for import
- ✅ TypeScript environment functional

**Potential blockers:**
- None identified

**Recommendations:**
- Consider using drizzle-kit push for development to apply schema changes quickly
- Set up DATABASE_URL in .env for local testing once PostgreSQL is running

---

## Metadata

**Phase:** 01 - Foundation & Infrastructure
**Plan:** 01
**Type:** Foundation
**Wave:** 1
**Dependencies:** None (first plan)

**Subsystem:** Infrastructure
**Tags:** monorepo, typescript, drizzle-orm, postgresql, rls, multi-tenant

**Tech Stack:**
- **Added:** npm workspaces, TypeScript 5.7, Turbo 2.3, Drizzle ORM 0.38, postgres 3.4, @slack/bolt 3.22, ioredis 5.4, bullmq 5.28, zod 3.24, pino 9.6
- **Patterns:** Monorepo, Row-Level Security, Workspace-based multi-tenancy

**Key Files:**
- **Created:** package.json, tsconfig.json, packages/database/src/schema.ts, packages/database/src/client.ts
- **Modified:** None

**Decisions:** 2 (npm workspaces, snake_case columns)

**Metrics:**
- Duration: 2 minutes
- Tasks: 2/2 completed
- Commits: 2 (task-level)
- Deviations: 2 auto-fixed (blocking issues)

**Completed:** 2026-01-26
