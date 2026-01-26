---
phase: 02-core-slack-response-suggestions
plan: 05
subsystem: slack-integration
tags: [slack-bolt, slash-commands, watch-commands, user-control]

# Dependency graph
requires:
  - phase: 02-01
    provides: Watch service and database schema for tracking watched conversations
provides:
  - /watch and /unwatch slash commands for user control of AI suggestions
  - Commands scope added to OAuth configuration
  - Integration between Slack commands and watch service

affects: [02-06-user-feedback-suggestions, 02-07-manual-trigger]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Slash command handler pattern with immediate ack() and ephemeral responses
    - Status checking before toggling (prevent duplicate watches)

key-files:
  created:
    - apps/slack-backend/src/handlers/commands/watch.ts
    - apps/slack-backend/src/handlers/commands/index.ts
  modified:
    - apps/slack-backend/src/handlers/index.ts
    - apps/slack-backend/src/app.ts
    - apps/slack-backend/src/handlers/events/message-reply.ts

key-decisions:
  - "Check watch status before toggling to provide accurate feedback"
  - "Use ephemeral messages for command responses (private to user)"
  - "Commands scope required for slash command support"

patterns-established:
  - "Slash command pattern: ack() → check state → call service → respond with ephemeral message"
  - "Separate commands directory under handlers for command organization"

# Metrics
duration: 4min
completed: 2026-01-26
---

# Phase 02 Plan 05: Watch Commands Summary

**/watch and /unwatch slash commands enable users to control AI suggestions per conversation with ephemeral status feedback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-26T17:46:05Z
- **Completed:** 2026-01-26T17:49:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Users can toggle watch status on conversations via /watch and /unwatch commands
- Watch status checked before toggling for accurate feedback messages
- Commands respond with clear ephemeral messages visible only to the user
- Commands scope added to OAuth for slash command support

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /watch and /unwatch slash command handlers** - `55edbe4` (feat)
2. **Task 2: Register slash commands with Bolt app** - `58d88d1` (feat)

**Blocking fix:** `6554769` (fix: TypeScript type narrowing in message-reply handler)
**Plan metadata:** (pending final commit)

## Files Created/Modified
- `apps/slack-backend/src/handlers/commands/watch.ts` - /watch and /unwatch command handlers with status checking
- `apps/slack-backend/src/handlers/commands/index.ts` - Export registerWatchCommands
- `apps/slack-backend/src/handlers/index.ts` - Export command and event handlers
- `apps/slack-backend/src/app.ts` - Register commands, add commands scope
- `apps/slack-backend/src/handlers/events/message-reply.ts` - Fixed TypeScript type narrowing issue

## Decisions Made
- **Check watch status before toggling:** Prevents duplicate database operations and provides accurate user feedback ("already watching" vs "now watching")
- **Ephemeral responses:** Command responses are ephemeral (response_type: 'ephemeral') so only the user who ran the command sees the feedback
- **Immediate ack():** Call ack() immediately at start of handler to meet Slack's 3-second acknowledgment requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript type narrowing in message-reply handler**
- **Found during:** Task 2 (Build verification)
- **Issue:** User added message-reply.ts file during execution with TypeScript compilation errors. The Bolt message type union wasn't narrowing properly after type guards, causing "Property 'user' does not exist on type 'never'" errors
- **Fix:** Added explicit type assertion after type guards to help TypeScript understand the message shape
- **Files modified:** apps/slack-backend/src/handlers/events/message-reply.ts
- **Verification:** TypeScript compilation succeeds with no errors
- **Committed in:** 6554769 (separate fix commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary to unblock compilation. The message-reply.ts file was added by user during execution and required type narrowing fix to compile.

## Issues Encountered
None with planned tasks. The blocking issue was external code added during execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Watch commands implemented and ready for user testing
- Users can now control which conversations trigger AI suggestions
- Ready for feedback submission commands (02-06) and manual triggers (02-07)
- Message reply detection handler also fixed and ready for integration

---
*Phase: 02-core-slack-response-suggestions*
*Completed: 2026-01-26*
