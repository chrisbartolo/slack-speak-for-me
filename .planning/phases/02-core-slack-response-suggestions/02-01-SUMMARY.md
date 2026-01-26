---
phase: 02-core-slack-response-suggestions
plan: 01
subsystem: database
tags: [drizzle, postgres, rls, watch, thread-tracking]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: Database schema foundation with workspaces, installations, users tables
provides:
  - Watched conversations tracking with workspace/user/channel persistence
  - Thread participation tracking with 7-day activity window
  - Service layer for watch/unwatch operations and participation queries
affects: [02-02-ai-suggestions, 02-03-slack-events, trigger-detection, suggestion-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Upsert pattern with onConflictDoNothing for idempotent watch operations
    - Upsert pattern with onConflictDoUpdate for thread participation timestamp updates
    - 7-day activity window for thread participation detection

key-files:
  created:
    - packages/database/src/migrations/0001_watched_conversations.sql
    - apps/slack-backend/src/services/watch.ts
  modified:
    - packages/database/src/schema.ts
    - apps/slack-backend/src/services/index.ts

key-decisions:
  - "Unique constraint on (workspace_id, user_id, channel_id) prevents duplicate watches"
  - "7-day window for thread participation balances context freshness with user engagement"
  - "Separate threadParticipants table instead of column on watchedConversations for granular thread tracking"
  - "RLS policies use workspace_id for tenant isolation matching Phase 1 pattern"

patterns-established:
  - "Service layer pattern: db operations encapsulated in dedicated service modules"
  - "Barrel exports from services/index.ts for clean import paths"
  - "Snake_case column names in schema matching Phase 1 convention"

# Metrics
duration: 3min
completed: 2026-01-26
---

# Phase 02 Plan 01: Watched Conversations Database Schema & Service Summary

**Database schema for watched conversations and thread participation tracking with service layer for watch/unwatch operations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-26T18:38:28Z
- **Completed:** 2026-01-26T18:41:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created watchedConversations table with workspace/user/channel tracking and unique constraint
- Created threadParticipants table with last_message_at timestamp for 7-day activity window
- Implemented watch service with 6 functions: watch, unwatch, isWatching, getWatchedConversations, recordThreadParticipation, isParticipatingInThread
- Added RLS policies for tenant isolation on both tables

## Task Commits

Each task was committed atomically:

1. **Task 1: Add watched_conversations and thread_participants tables** - `3f4dc75` (feat)
2. **Task 2: Create watch service for conversation tracking** - `642c4cc` (feat)

## Files Created/Modified
- `packages/database/src/schema.ts` - Added watchedConversations and threadParticipants table definitions with indexes
- `packages/database/src/migrations/0001_watched_conversations.sql` - Migration with CREATE TABLE, indexes, and RLS policies
- `apps/slack-backend/src/services/watch.ts` - Service functions for watch/unwatch and thread participation tracking
- `apps/slack-backend/src/services/index.ts` - Barrel export for watch service functions

## Decisions Made

**Unique constraint approach:** Used uniqueIndex in Drizzle schema (not .unique() chaining) to enforce (workspace_id, user_id, channel_id) uniqueness for watch operations.

**7-day participation window:** Thread participation tracking uses 7-day window to balance detecting active engagement while not triggering on old threads.

**Separate threadParticipants table:** Instead of adding thread tracking to watchedConversations, created dedicated table for granular tracking per thread (user can watch channel but participate in specific threads).

**Upsert patterns:** watchConversation uses onConflictDoNothing (idempotent), recordThreadParticipation uses onConflictDoUpdate to update last_message_at timestamp.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Drizzle uniqueIndex syntax**
- **Found during:** Task 1 (schema compilation)
- **Issue:** Used `.unique()` chaining on index() which doesn't exist in Drizzle API - TypeScript error
- **Fix:** Imported uniqueIndex and used it instead of index().unique()
- **Files modified:** packages/database/src/schema.ts
- **Verification:** npm run build succeeded without errors
- **Committed in:** 3f4dc75 (Task 1 commit)

**2. [Rule 3 - Blocking] Added .js extension to service imports**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** TypeScript with node16 moduleResolution requires explicit .js extensions in import paths
- **Fix:** Changed `from './watch'` to `from './watch.js'` in index.ts
- **Files modified:** apps/slack-backend/src/services/index.ts
- **Verification:** npm run build succeeded without errors
- **Committed in:** 642c4cc (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes were necessary for compilation. No scope creep.

## Issues Encountered
None - plan executed smoothly after compilation fixes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Phase 02 Plan 02: AI suggestion service can now check if user is watching conversation before generating
- Phase 02 Plan 03: Slack event handlers can now record thread participation when user posts messages
- Phase 02 Plan 04+: Trigger detection logic can query watched conversations and active thread participation

**Database migration note:** 0001_watched_conversations.sql needs to be applied to database before next plans execute. Run via Drizzle migration tool or direct SQL execution.

**No blockers:** Schema is complete and service layer is ready for use.

---
*Phase: 02-core-slack-response-suggestions*
*Completed: 2026-01-26*
