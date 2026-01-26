---
phase: 01-foundation-infrastructure
plan: 02
subsystem: auth
tags: [slack, oauth, encryption, aes-256-gcm, bolt, zod]

# Dependency graph
requires:
  - phase: 01-01
    provides: Database schema with workspaces and installations tables
provides:
  - AES-256-GCM encryption utilities for OAuth token storage
  - Slack Bolt app with OAuth configuration
  - InstallationStore with encrypted token storage/retrieval
  - Environment validation with clear error messages
affects: [01-05-slack-event-handlers, 02-ai-integration]

# Tech tracking
tech-stack:
  added: [@slack/bolt, zod]
  patterns: [encrypted-at-rest-tokens, environment-validation, oauth-installation-store]

key-files:
  created:
    - packages/database/src/encryption.ts
    - apps/slack-backend/src/env.ts
    - apps/slack-backend/src/oauth/installation-store.ts
    - apps/slack-backend/src/app.ts
    - apps/slack-backend/src/middleware/error-handler.ts
    - apps/slack-backend/src/utils/logger.ts
  modified:
    - packages/database/src/index.ts
    - apps/slack-backend/src/index.ts

key-decisions:
  - "AES-256-GCM for OAuth token encryption (authenticated encryption prevents tampering)"
  - "Zod for environment validation (clear error messages, type safety)"
  - "InstallationStore pattern from Bolt (enables multi-workspace support)"
  - "Minimal OAuth scopes (channels:history, channels:read, chat:write, users:read, app_mentions:read)"

patterns-established:
  - "Encrypt before insert, decrypt after select for sensitive data"
  - "Environment validation at startup with user-friendly error messages"
  - "Structured logging with pino and sensitive field redaction"

# Metrics
duration: 5min
completed: 2026-01-26
---

# Phase 01 Plan 02: OAuth Token Security Summary

**AES-256-GCM encrypted OAuth tokens with Bolt InstallationStore and environment validation using Zod**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-26T16:45:28Z
- **Completed:** 2026-01-26T16:50:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- OAuth tokens encrypted before database storage with AES-256-GCM
- InstallationStore implementation with encrypted token storage and retrieval
- Slack Bolt app configured with OAuth and minimal required scopes
- Environment validation with clear, actionable error messages for missing/invalid variables
- Error handling middleware for global Bolt app error catching
- Structured logging with pino and sensitive field redaction

## Task Commits

Each task was committed atomically:

1. **Task 1: Create encryption utilities and environment validation** - `ca63229` (feat)
2. **Task 2: Create OAuth installation store and Bolt app** - `04e1de2` (feat) *[Tagged as 01-04 but contains 01-02 work]*

**Note:** Task 2 was completed in a prior session and committed with tag 01-04. The work includes all requirements from this plan.

## Files Created/Modified
- `packages/database/src/encryption.ts` - AES-256-GCM encrypt/decrypt functions with IV and auth tag
- `packages/database/src/encryption.test.ts` - Round-trip encryption tests
- `packages/database/src/index.ts` - Export encryption utilities
- `apps/slack-backend/src/env.ts` - Zod schema for environment validation with helpful error messages
- `apps/slack-backend/src/oauth/installation-store.ts` - Bolt InstallationStore with encrypted token storage
- `apps/slack-backend/src/app.ts` - Bolt app with OAuth configuration and minimal scopes
- `apps/slack-backend/src/index.ts` - App startup and graceful shutdown
- `apps/slack-backend/src/middleware/error-handler.ts` - Global error handling
- `apps/slack-backend/src/utils/logger.ts` - Pino logger with redaction

## Decisions Made

**1. AES-256-GCM over AES-256-CBC**
- Rationale: Authenticated encryption prevents tampering attacks. GCM mode provides both confidentiality and authenticity.

**2. 64-character hex string for ENCRYPTION_KEY**
- Rationale: Forces 32-byte (256-bit) key. Validation ensures key is proper length.

**3. Zod over manual validation**
- Rationale: Type-safe environment parsing with clear error messages. Catches missing/invalid env vars at startup.

**4. Minimal OAuth scopes**
- Rationale: Follow least-privilege principle. Only request channels:history, channels:read, chat:write, users:read, app_mentions:read.
- Impact: Reduces security risk, makes approval easier for workspace admins.

**5. directInstall: true in installerOptions**
- Rationale: Simplifies OAuth flow for single-workspace installations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added error handling middleware**
- **Found during:** Task 2 (Creating Bolt app)
- **Issue:** No global error handler for Bolt app - unhandled errors would crash the process
- **Fix:** Created middleware/error-handler.ts with global error handler registered via app.error()
- **Files modified:** apps/slack-backend/src/middleware/error-handler.ts, apps/slack-backend/src/app.ts
- **Verification:** Error handler logs errors and sends user-friendly messages
- **Committed in:** 04e1de2 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added structured logging**
- **Found during:** Task 2 (App initialization)
- **Issue:** No logging infrastructure - can't debug production issues
- **Fix:** Created utils/logger.ts with pino logger and sensitive field redaction (tokens, API keys)
- **Files modified:** apps/slack-backend/src/utils/logger.ts
- **Verification:** Logger redacts sensitive fields, provides structured JSON logs
- **Committed in:** 04e1de2 (Task 2 commit)

**3. [Rule 2 - Missing Critical] Added user field to Installation return**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Bolt Installation type requires user field, but it's optional in our storage
- **Fix:** Always return user object with token: undefined when no user token exists
- **Files modified:** apps/slack-backend/src/oauth/installation-store.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 04e1de2 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 missing critical)
**Impact on plan:** All auto-fixes essential for production readiness (error handling, logging, type safety). No scope creep.

## Issues Encountered

**1. TypeScript Installation type strictness**
- **Issue:** Bolt's Installation type requires `user` field, but it should be optional for bot-only installations
- **Solution:** Always include user object with undefined token when no user installation exists
- **Outcome:** Satisfies TypeScript while maintaining nullable semantics

**2. Commit tagging mismatch**
- **Issue:** Task 2 work was committed in a prior session with tag 01-04 instead of 01-02
- **Solution:** Document actual commit hashes in summary, note the tagging discrepancy
- **Outcome:** All work is tracked, despite non-sequential commit tags

## User Setup Required

**External services require manual configuration.** See [01-02-USER-SETUP.md](./01-02-USER-SETUP.md) for:
- Environment variables to add (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, SLACK_STATE_SECRET, ENCRYPTION_KEY)
- Slack App dashboard configuration (Create app, configure OAuth, add redirect URLs)
- Verification commands (npm run dev should start Bolt app)

**Key environment variables:**
```bash
SLACK_CLIENT_ID=<from Slack API Dashboard>
SLACK_CLIENT_SECRET=<from Slack API Dashboard>
SLACK_SIGNING_SECRET=<from Slack API Dashboard>
SLACK_STATE_SECRET=<32+ character random string>
ENCRYPTION_KEY=<64-character hex string (32 bytes)>
ANTHROPIC_API_KEY=<from Anthropic Console>
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```

## Next Phase Readiness

**Ready for:**
- 01-05: Slack event handlers can now use app.event(), app.message(), app.action()
- Phase 2: AI integration can retrieve bot tokens via fetchInstallation()

**Blockers:** None

**Security notes:**
- OAuth tokens are encrypted at rest (AES-256-GCM)
- Environment validation prevents startup with missing credentials
- Minimal scopes reduce attack surface
- Structured logging redacts sensitive data

**Performance notes:**
- Encryption/decryption adds ~1ms per token operation (negligible)
- InstallationStore queries are indexed by workspace_id

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-01-26*
