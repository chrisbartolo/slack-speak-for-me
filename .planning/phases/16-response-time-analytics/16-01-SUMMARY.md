---
phase: 16-response-time-analytics
plan: 01
subsystem: database
tags: [drizzle, postgresql, analytics, metrics]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Drizzle ORM schema foundation with database client
provides:
  - suggestion_metrics table with 6 pipeline stage timestamps
  - 4 composite indexes for workspace, org, user, and channel time-range queries
  - Unique constraint on suggestionId for upsert pattern
  - Type exports for SuggestionMetric insert/select
affects: [16-02, 16-03, 16-04, analytics, monitoring, performance-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Denormalized organizationId in metrics table for fast org-wide analytics"
    - "Computed duration columns (ms) stored for query performance"
    - "Incremental timestamp filling via upsert pattern"

key-files:
  created: []
  modified:
    - packages/database/src/schema.ts

key-decisions:
  - "Denormalized organizationId - Not a foreign key, filled at record time for query performance"
  - "Nullable pipeline timestamps - Filled incrementally as suggestion progresses through stages"
  - "Pre-computed duration columns - Stored in milliseconds to avoid calculating in every query"
  - "Unique constraint on suggestionId - Enables onConflictDoUpdate upsert pattern"

patterns-established:
  - "Metrics table design: timestamp columns for each pipeline stage, computed durations, composite indexes on entity+time"
  - "Upsert pattern for incremental metric recording via unique constraint"

# Metrics
duration: 4min
completed: 2026-02-04
---

# Phase 16 Plan 01: Response Time Analytics Foundation Summary

**PostgreSQL suggestion_metrics table with 6-stage pipeline timestamps, 3 computed duration columns, and 4 composite time-range indexes for fast analytics queries**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-04T07:47:50Z
- **Completed:** 2026-02-04T07:51:29Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added suggestion_metrics table to Drizzle schema with all 6 pipeline stage timestamps
- Created 4 composite indexes for efficient time-range queries by workspace, org, user, and channel
- Established pattern for incremental metric filling via unique constraint and upsert
- Pushed schema to development database

## Task Commits

Each task was committed atomically:

1. **Task 1: Add suggestionMetrics table to schema.ts** - `dcd269a` (feat)
2. **Task 2: Push schema to database** - No commit (database operation only)

## Files Created/Modified
- `packages/database/src/schema.ts` - Added suggestionMetrics table with indexes and type exports

## Decisions Made
1. **Denormalized organizationId** - Not a foreign key, filled at record time. Rationale: Fast org-wide analytics queries without joining through workspaces table.
2. **Nullable pipeline timestamps** - All stage timestamps nullable to support incremental filling as suggestion progresses.
3. **Pre-computed duration columns** - totalDurationMs, aiProcessingMs, queueDelayMs stored at completion. Rationale: Avoid recalculating durations in every analytics query.
4. **Unique constraint on suggestionId** - Enables `onConflictDoUpdate` upsert pattern for incremental metric recording.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None - schema addition and push completed successfully.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- suggestion_metrics table exists in PostgreSQL with all required columns and indexes
- Ready for Plan 02 (metrics service) to begin recording pipeline timestamps
- Schema supports all 6 stages: event received → job queued → AI started → AI completed → delivered → user action
- Indexes optimized for time-range queries at workspace, org, user, and channel levels

---
*Phase: 16-response-time-analytics*
*Completed: 2026-02-04*
