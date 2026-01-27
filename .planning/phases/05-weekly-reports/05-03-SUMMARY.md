---
phase: 05-weekly-reports
plan: 03
subsystem: database, jobs, events
tags: [google-sheets, bullmq, workflow-submission, rate-limiting, postgresql]

# Dependency graph
requires:
  - phase: 05-01
    provides: Google OAuth integration with getGoogleClient() for Sheets API access
provides:
  - Workflow submission detection and parsing from bot messages
  - Google Sheets write service with append/read/status operations
  - BullMQ queue for Sheets operations with rate limiting (30/min)
  - workflowConfig table for channel monitoring configuration
affects: [05-04-weekly-report-generation, 05-05-weekly-report-scheduling]

# Tech tracking
tech-stack:
  added: []
  patterns: [Event-driven workflow submission detection, Queue-based Sheets writes, Heuristic parsing for form fields]

key-files:
  created:
    - apps/slack-backend/src/services/google-sheets.ts
    - apps/slack-backend/src/handlers/events/workflow-submission.ts
  modified:
    - packages/database/src/schema.ts
    - apps/slack-backend/src/jobs/types.ts
    - apps/slack-backend/src/jobs/queues.ts
    - apps/slack-backend/src/jobs/workers.ts

key-decisions:
  - "Heuristic parser for workflow form fields to handle varied formats"
  - "Auto-learning workflowBotId from first submission for future filtering"
  - "Rate limiting at 30 writes/min (well under 60/min Sheets API limit)"
  - "Concurrency 1 for Sheets worker to avoid conflicts on same spreadsheet"

patterns-established:
  - "Workflow submission parsing pattern: extract fields from section and rich_text blocks"
  - "Multiple config owner support: one submission can write to multiple sheets"
  - "Queue-based Sheets operations: prevents rate limit issues and provides retry logic"

# Metrics
duration: 3min
completed: 2026-01-27
---

# Phase 05 Plan 03: Workflow Submission Monitoring Summary

**Workflow submission detection from bot messages with Google Sheets write service and BullMQ queue for rate-limited processing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-27T14:01:46Z
- **Completed:** 2026-01-27T14:05:06Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- workflowConfig table for channel monitoring with auto-learned bot ID
- Google Sheets service with append, read, and status tracking operations
- Workflow submission event handler with heuristic form parsing
- BullMQ queue for Sheets writes with rate limiting and retry logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Add workflowConfig table for channel monitoring settings** - `864440a` (feat)
2. **Task 2: Create Google Sheets service for write operations** - `245040e` (feat)
3. **Task 3: Add Sheets queue and workflow submission handler** - `cda6357` (feat)

## Files Created/Modified
- `packages/database/src/schema.ts` - Added workflowConfig table with channel monitoring settings
- `apps/slack-backend/src/services/google-sheets.ts` - Google Sheets read/write service with 3 exported functions
- `apps/slack-backend/src/services/index.ts` - Exported Google Sheets service functions
- `apps/slack-backend/src/jobs/types.ts` - Added SheetsWriteJobData and SheetsWriteJobResult interfaces
- `apps/slack-backend/src/jobs/queues.ts` - Added sheetsQueue and queueSheetsWrite function
- `apps/slack-backend/src/jobs/workers.ts` - Added Sheets worker with rate limiting
- `apps/slack-backend/src/handlers/events/workflow-submission.ts` - Event handler for workflow submissions
- `apps/slack-backend/src/handlers/events/index.ts` - Exported workflow submission handler
- `apps/slack-backend/src/handlers/index.ts` - Exported workflow submission handler
- `apps/slack-backend/src/app.ts` - Registered workflow submission handler

## Decisions Made

**Heuristic parser for workflow form fields**
- Workflow Builder forms can vary in structure (section blocks vs rich_text blocks)
- Parser looks for both patterns with flexible field name matching
- Supports multiple field name variants (achievements/accomplishments, blockers/challenges, etc.)
- May need adjustment based on actual workflow structure when tested

**Auto-learning workflowBotId**
- First submission from monitored channel teaches system which bot posts workflow submissions
- Stored in workflowConfig.workflowBotId for future filtering
- Enables precise filtering without hardcoding bot IDs

**Rate limiting at 30 writes/min**
- Google Sheets API allows 60 writes/min per user per project
- Set to 30/min to provide safety margin and handle bursts
- Concurrency 1 ensures sequential processing per spreadsheet

**Multiple config owner support**
- Single workflow submission can write to multiple sheets
- Each user monitoring the channel gets their own copy
- Enables team leads to aggregate submissions from their teams

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed existing patterns from jobs/workers.ts and handlers/events/message-reply.ts.

## User Setup Required

None - no external service configuration required. Google OAuth setup was completed in plan 05-01.

## Next Phase Readiness

**Ready for next plan (05-04):**
- Workflow submission detection working for bot messages
- Google Sheets write queue with rate limiting operational
- workflowConfig table ready for UI configuration
- Submission parsing handles multiple field name variants

**Next steps:**
- Plan 05-04 will add UI for configuring which channels to monitor
- Plan 05-05 will add report generation from collected submissions
- Parser may need refinement based on actual Workflow Builder output

---
*Phase: 05-weekly-reports*
*Completed: 2026-01-27*
