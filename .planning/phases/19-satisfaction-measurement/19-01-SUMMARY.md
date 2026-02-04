---
phase: 19-satisfaction-measurement
plan: 01
subsystem: database
tags: [drizzle, postgres, satisfaction, nps, health-scores]

# Dependency graph
requires:
  - phase: 17-communication-pattern-insights
    provides: Foundation for tracking communication metrics and trends
  - phase: 18-auto-learning-knowledge-base
    provides: KB effectiveness tracking patterns for survey-related metrics
provides:
  - satisfaction_surveys table with NPS ratings and feedback collection
  - communication_health_scores table for before/after analysis
  - Organization-wide query support via denormalized organizationId
affects: [19-02-nps-survey-delivery, 19-03-health-score-computation, 19-04-trend-visualization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Survey status workflow: delivered → completed/expired/dismissed"
    - "Health score aggregate pattern: nullable userId means team-wide score"
    - "Baseline tracking: isBaseline flag for first 30-day scores"
    - "NPS category computation: promoter/passive/detractor from 0-10 rating"

key-files:
  created: []
  modified:
    - packages/database/src/schema.ts
    - apps/web-portal/lib/db/index.ts

key-decisions:
  - "Survey unique constraint on (workspaceId, userId, surveyType, deliveredAt) prevents duplicate deliveries"
  - "Health scores support both individual (userId set) and team aggregate (userId null) tracking"
  - "NPS rating nullable until user responds, allows tracking delivery vs completion"
  - "7-day expiration window for surveys (expiredAt timestamp)"
  - "All component metrics nullable to handle insufficient data scenarios"

patterns-established:
  - "Survey lifecycle: delivered → respondedAt set on completion → expiredAt after 7 days"
  - "Health score composition: multiple component scores (acceptance, sentiment, satisfaction) rolled into composite healthScore (0-100)"
  - "Before/after analysis: isBaseline flag identifies first 30-day baseline scores for comparison"

# Metrics
duration: 23min
completed: 2026-02-04
---

# Phase 19 Plan 01: Database Schema for Satisfaction Measurement

**NPS survey tracking with satisfaction_surveys table and communication health scores with before/after baseline support**

## Performance

- **Duration:** 23 min
- **Started:** 2026-02-04T20:28:43Z
- **Completed:** 2026-02-04T20:51:56Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added satisfaction_surveys table with NPS rating (0-10), feedback text, delivery/response tracking, and status workflow
- Added communication_health_scores table with composite health score and component metrics (acceptance, sentiment, satisfaction, engagement)
- Both tables support org-wide queries via denormalized organizationId with proper indexes
- Schema pushed to database successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Add satisfactionSurveys and communicationHealthScores tables to schema.ts** - `f148bcf` (feat)
2. **Task 2: Register new tables in web portal db/index.ts and push schema** - `3ec9e31` (feat)

## Files Created/Modified
- `packages/database/src/schema.ts` - Added satisfactionSurveys and communicationHealthScores tables with indexes and type exports
- `apps/web-portal/lib/db/index.ts` - Registered new tables in web portal schema and exported types

## Decisions Made

1. **Survey status workflow** - Four states (delivered/completed/expired/dismissed) track full lifecycle from delivery to resolution
2. **Health score aggregation levels** - Nullable userId field enables both individual user scores and team-wide aggregate scores
3. **NPS category computation** - npsCategory field stores computed value (promoter/passive/detractor) for easier querying
4. **7-day expiration window** - expiredAt timestamp set after 7 days if no response received
5. **Baseline tracking** - isBaseline boolean identifies first 30-day scores for before/after comparisons
6. **Component metric nullability** - All component scores nullable to handle scenarios with insufficient data volume

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - schema compilation and database push completed successfully on first attempt.

## Next Phase Readiness

Database foundation complete for Phase 19. Ready for:
- Plan 02: NPS survey delivery system
- Plan 03: Health score computation algorithms
- Plan 04: Trend visualization and before/after dashboards

Tables in place with proper indexes and type safety. All future plans can query satisfaction_surveys and communication_health_scores with full TypeScript support.

---
*Phase: 19-satisfaction-measurement*
*Completed: 2026-02-04*
