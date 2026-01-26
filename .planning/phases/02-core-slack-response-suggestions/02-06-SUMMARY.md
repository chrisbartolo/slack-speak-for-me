---
phase: 02-core-slack-response-suggestions
plan: 06
subsystem: messaging
tags: [slack, block-kit, ephemeral-messages, bullmq, webclient]

# Dependency graph
requires:
  - phase: 02-02
    provides: AI suggestion generation with Claude Sonnet 4
  - phase: 01-02
    provides: OAuth installation store with encrypted tokens
  - phase: 01-03
    provides: BullMQ job processing infrastructure
provides:
  - Ephemeral message delivery with Block Kit formatting
  - Copy, Refine, and Dismiss action buttons
  - Integration of suggestion delivery into BullMQ worker
affects: [02-07-button-handlers, 02-08-refine-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ephemeral messages for private user notifications"
    - "Block Kit action buttons for user interaction"
    - "Installation token lookup and decryption in workers"
    - "Non-fatal delivery errors in job processing"

key-files:
  created:
    - apps/slack-backend/src/services/suggestion-delivery.ts
  modified:
    - apps/slack-backend/src/services/index.ts
    - apps/slack-backend/src/jobs/workers.ts
    - apps/slack-backend/src/handlers/events/app-mention.ts

key-decisions:
  - "Ephemeral messages ensure suggestions are private to target user"
  - "Three-button layout: Copy (primary), Refine, Dismiss"
  - "Delivery failure doesn't fail job (suggestion already generated)"
  - "Installation token decryption happens in worker, not main app"

patterns-established:
  - "buildSuggestionBlocks pattern for Block Kit message construction"
  - "Try-catch around delivery with logging but no throw"
  - "Trigger context labels map internal codes to user-friendly text"

# Metrics
duration: 2min
completed: 2026-01-26
---

# Phase 2 Plan 6: Suggestion Delivery Summary

**Ephemeral message delivery with Block Kit formatting, Copy/Refine/Dismiss buttons, and BullMQ worker integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-26T17:46:04Z
- **Completed:** 2026-01-26T17:48:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created suggestion delivery service with Block Kit formatted ephemeral messages
- Added Copy to Clipboard, Refine, and Dismiss action buttons
- Integrated delivery into BullMQ worker with installation token lookup
- Implemented non-fatal delivery error handling (suggestion generation succeeds even if delivery fails)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create suggestion delivery service with Block Kit formatting** - `44f05ec` (feat)
2. **Task 2: Wire suggestion delivery into BullMQ worker** - `dd9a427` (feat)

## Files Created/Modified
- `apps/slack-backend/src/services/suggestion-delivery.ts` - Block Kit message construction and ephemeral delivery
- `apps/slack-backend/src/services/index.ts` - Export suggestion delivery functions
- `apps/slack-backend/src/jobs/workers.ts` - Fetch installation, decrypt token, deliver suggestion
- `apps/slack-backend/src/handlers/events/app-mention.ts` - Add user ID validation (bug fix)

## Decisions Made

**1. Ephemeral message delivery pattern**
- Rationale: Ensures suggestions are private to target user, aligns with Slack best practices for bot notifications

**2. Three-button action layout**
- Copy to Clipboard (primary style) - Main action
- Refine - Alternative path for adjustment
- Dismiss - Explicit rejection
- Rationale: Clear hierarchy, primary action emphasized

**3. Non-fatal delivery errors**
- Delivery failures logged but don't throw
- Rationale: Suggestion generation is the core job - delivery is "best effort"

**4. Installation token lookup in worker**
- Workers decrypt tokens directly from database
- Rationale: Workers are isolated, need independent access to Slack API

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing user ID validation in app-mention handler**
- **Found during:** Task 1 (building and verifying)
- **Issue:** TypeScript error - event.user can be undefined, causing job queue to fail
- **Fix:** Added null check before queuing job, with error logging
- **Files modified:** apps/slack-backend/src/handlers/events/app-mention.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 44f05ec (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix essential for type safety. No scope creep.

## Issues Encountered
None - all tasks executed as planned after fixing pre-existing TypeScript error.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Button interaction handlers (Copy, Refine, Dismiss)
- Refine flow with modal input
- Suggestion tracking and analytics

**Technical foundation complete:**
- Ephemeral messages work with Block Kit
- Installation tokens can be accessed from workers
- Action button IDs defined and ready for handlers

**No blockers identified.**

---
*Phase: 02-core-slack-response-suggestions*
*Completed: 2026-01-26*
