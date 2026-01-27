---
phase: 05-weekly-reports
plan: 06
subsystem: jobs, scheduling
tags: [bullmq, job-scheduler, cron, timezone, automation]

# Dependency graph
requires:
  - phase: 05-04
    provides: Report generator service and settings table
affects: [05-07-report-ui, future-scheduled-operations]

# Tech tracking
tech-stack:
  added: []
  patterns: [BullMQ Job Schedulers, Cron pattern generation, Startup scheduler sync]

key-files:
  created:
    - apps/slack-backend/src/jobs/schedulers.ts
    - apps/slack-backend/src/jobs/schedulers.test.ts
  modified:
    - apps/slack-backend/src/jobs/index.ts
    - apps/slack-backend/src/index.ts

key-decisions:
  - "BullMQ Job Schedulers for persistent cron-style scheduling"
  - "Cron pattern format: minute hour day-of-month month day-of-week"
  - "Day of week convention: 0=Sunday to 6=Saturday (matches cron)"
  - "Scheduler ID format: report-{workspaceId}-{userId}"
  - "Startup sync restores all enabled schedulers from database"
  - "Timezone passed to BullMQ for correct local time execution"

patterns-established:
  - "Scheduler management pattern: upsert creates/updates, remove deletes, sync restores on startup"
  - "Settings-driven scheduler: enabled flag and schedule fields control scheduler lifecycle"
  - "Non-fatal scheduler removal: errors logged but don't crash sync process"

# Metrics
duration: 4min
completed: 2026-01-27
---

# Phase 05 Plan 06: Job Schedulers for Reports Summary

**BullMQ Job Scheduler management for automated weekly report generation with cron patterns and timezone support**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-27T14:13:32Z
- **Completed:** 2026-01-27T14:17:37Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Scheduler management service with 4 exported functions: upsertReportScheduler, removeReportScheduler, syncAllReportSchedulers, getReportSchedulers
- Cron pattern conversion from dayOfWeek (0-6) and timeOfDay (HH:mm) format
- Timezone support for correct local time execution
- Startup sync restores all enabled schedulers from database
- Comprehensive unit tests with 10 test cases covering all scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scheduler management service** - `b651aaa` (feat)
2. **Task 2: Add scheduler sync on server startup** - `bd82022` (feat)
3. **Task 3: Add unit tests for scheduler service** - `c6eca72` (test)

## Files Created/Modified

- `apps/slack-backend/src/jobs/schedulers.ts` - Scheduler management service with upsert/remove/sync functions
- `apps/slack-backend/src/jobs/schedulers.test.ts` - Unit tests with mocked database and BullMQ
- `apps/slack-backend/src/jobs/index.ts` - Added exports for scheduler functions
- `apps/slack-backend/src/index.ts` - Added syncAllReportSchedulers call on startup

## Decisions Made

**BullMQ Job Schedulers for persistent scheduling**
- Uses BullMQ's built-in Job Scheduler feature with cron patterns
- Schedulers survive server restarts by being recreated on startup from database
- Each user's report has a unique scheduler ID: `report-{workspaceId}-{userId}`
- Scheduler metadata stored in Redis by BullMQ

**Cron pattern generation**
- Converts settings format (dayOfWeek: 0-6, timeOfDay: "HH:mm") to cron
- Cron format: `{minutes} {hours} * * {dayOfWeek}`
- Example: dayOfWeek=1, timeOfDay="09:00" → "0 9 * * 1" (Monday 9am)
- Day of week convention matches cron: 0=Sunday through 6=Saturday

**Timezone handling**
- Timezone from reportSettings.timezone passed to BullMQ upsertJobScheduler
- BullMQ uses timezone to calculate next execution time in user's local time
- Supports any IANA timezone string (e.g., "America/New_York", "Europe/London")

**Startup synchronization**
- syncAllReportSchedulers() called after workers start in index.ts
- Fetches all enabled report settings from database
- Calls upsertReportScheduler for each to recreate schedulers
- Individual errors logged but don't stop sync of other schedulers

**Settings-driven lifecycle**
- enabled=true: upsertReportScheduler creates/updates scheduler
- enabled=false: removeReportScheduler deletes scheduler
- Missing dayOfWeek/timeOfDay/timezone: scheduler not created, warning logged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript build errors from unrelated code**
- workers.ts has a Slack block type error from previous plan
- This doesn't block scheduler functionality
- Will be fixed in a future cleanup pass

**Vitest mock complexity in loop**
- Initial test iterated through multiple cron patterns in a loop
- Mock state wasn't properly reset between iterations
- Fixed by using separate test cases instead of loop
- All 10 tests pass successfully

## Technical Implementation

**Scheduler service exports:**

1. **upsertReportScheduler(workspaceId, userId)**
   - Fetches reportSettings from database
   - If disabled: calls removeReportScheduler and returns
   - Validates required fields (dayOfWeek, timeOfDay, timezone)
   - Converts to cron pattern
   - Calls reportQueue.upsertJobScheduler with pattern and timezone

2. **removeReportScheduler(workspaceId, userId)**
   - Calls reportQueue.removeJobScheduler with scheduler ID
   - Errors logged but not thrown (non-fatal)

3. **syncAllReportSchedulers()**
   - Fetches all enabled reportSettings from database
   - Iterates and calls upsertReportScheduler for each
   - Individual errors logged but don't stop sync

4. **getReportSchedulers()**
   - Calls reportQueue.getJobSchedulers()
   - Maps to simplified format: { id, pattern, tz }

**Cron pattern conversion:**
```typescript
function toCronPattern(dayOfWeek: number, timeOfDay: string): string {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  return `${minutes} ${hours} * * ${dayOfWeek}`;
}
```

**Scheduler ID format:**
```typescript
function getSchedulerId(workspaceId: string, userId: string): string {
  return `report-${workspaceId}-${userId}`;
}
```

**Test coverage:**
- Scheduler creation when enabled
- Scheduler removal when disabled
- Missing settings handling
- Cron pattern conversion (Wednesday 14:15)
- Remove scheduler by ID
- Error handling in remove
- Sync all enabled schedulers
- Continue sync despite individual failures
- Get scheduler list
- Empty scheduler list

## Next Phase Readiness

**Ready for next plan (05-07):**
- Scheduler management fully operational
- Startup sync ensures persistence
- Cron patterns and timezones correctly handled
- Unit tests verify all scenarios

**Next steps:**
- Plan 05-07 will add UI for configuring report settings (day, time, timezone)
- UI will call upsertReportScheduler when user saves settings
- UI will call removeReportScheduler when user disables reports

**Integration points:**
- Web portal needs to import upsertReportScheduler and removeReportScheduler
- Settings form needs timezone picker component
- Settings form needs day-of-week selector (0-6 or Mon-Sun)
- Settings form needs time picker (HH:mm format)

**Outstanding questions:**
- Should we show users when their next report will run in the UI?
  - Can calculate from cron pattern and timezone
  - BullMQ provides next execution time via scheduler metadata
- Should we allow users to test/preview reports before scheduling?
  - Could add "Generate Now" button that creates one-time job
- Should we surface scheduler status in UI?
  - "Active" vs "Inactive" vs "Error"
  - Last run time and success/failure status

---
*Phase: 05-weekly-reports*
*Completed: 2026-01-27*
