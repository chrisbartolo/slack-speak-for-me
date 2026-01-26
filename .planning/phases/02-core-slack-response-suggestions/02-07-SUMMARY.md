---
phase: 02-core-slack-response-suggestions
plan: 07
subsystem: api
tags: [slack, bolt, message-shortcut, actions, buttons]

# Dependency graph
requires:
  - phase: 02-06
    provides: AI response delivery with Copy, Refine, Dismiss buttons
provides:
  - Message shortcut "Help me respond" for any message
  - Copy button handler with clipboard instructions
  - Dismiss button handler for ephemeral messages
  - Manual trigger mechanism for DMs and ad-hoc responses
affects: [02-08, 02-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Message shortcuts for user-initiated actions"
    - "Action handlers with respond() for ephemeral updates"
    - "JSON-encoded button values for passing data"

key-files:
  created:
    - apps/slack-backend/src/handlers/shortcuts/help-me-respond.ts
    - apps/slack-backend/src/handlers/shortcuts/index.ts
    - apps/slack-backend/src/handlers/actions/copy-suggestion.ts
    - apps/slack-backend/src/handlers/actions/dismiss-suggestion.ts
    - apps/slack-backend/src/handlers/actions/index.ts
  modified:
    - apps/slack-backend/src/handlers/index.ts
    - apps/slack-backend/src/app.ts

key-decisions:
  - "Message shortcut triggers AI job regardless of watch status"
  - "Copy button shows code block with triple-click instructions"
  - "Dismiss button uses delete_original: true to remove ephemeral message"

patterns-established:
  - "Shortcut handlers queue jobs via queueAIResponse"
  - "Action handlers use respond() to update ephemeral messages"
  - "Button values encode JSON for passing suggestionId and suggestion text"

# Metrics
duration: 1min
completed: 2026-01-26
---

# Phase 2 Plan 07: Message Shortcut and Action Handlers Summary

**Message shortcut triggers AI suggestions on-demand with Copy/Dismiss button handlers for complete interaction flow**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-26T18:05:51Z
- **Completed:** 2026-01-26T18:06:34Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Message shortcut handler queues AI responses for any message
- Copy button provides user-friendly clipboard instructions
- Dismiss button cleanly removes ephemeral messages
- Complete manual trigger flow for DMs and ad-hoc responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Create "Help me respond" message shortcut handler** - `c8145e7` (feat)
2. **Task 2: Create Copy and Dismiss button action handlers** - `bb2ff61` (feat)

## Files Created/Modified
- `apps/slack-backend/src/handlers/shortcuts/help-me-respond.ts` - Message shortcut handler registering 'help_me_respond' callback
- `apps/slack-backend/src/handlers/shortcuts/index.ts` - Shortcut exports
- `apps/slack-backend/src/handlers/actions/copy-suggestion.ts` - Copy button handler showing code block with instructions
- `apps/slack-backend/src/handlers/actions/dismiss-suggestion.ts` - Dismiss button handler removing ephemeral message
- `apps/slack-backend/src/handlers/actions/index.ts` - Action handler exports
- `apps/slack-backend/src/handlers/index.ts` - Added shortcut and action exports
- `apps/slack-backend/src/app.ts` - Registered shortcut and action handlers

## Decisions Made

**Message shortcut triggers AI job regardless of watch status**
- Rationale: User-initiated actions should always work, providing manual override for any message including DMs

**Copy button shows code block with triple-click instructions**
- Rationale: Slack doesn't support programmatic clipboard access, so provide clear UX for manual copying

**Dismiss button uses delete_original: true to remove ephemeral message**
- Rationale: Cleanest UX - message disappears rather than replacing with "dismissed" text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

Message shortcut and action handlers complete. Ready for:
- Phase 02-08: Refine button handler with regeneration flow
- Phase 02-09: Integration testing with end-to-end Slack flows

All interaction patterns established for building on.

---
*Phase: 02-core-slack-response-suggestions*
*Completed: 2026-01-26*
