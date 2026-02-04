---
phase: 19-satisfaction-measurement
plan: 02
subsystem: backend
tags: [slack, block-kit, nps, surveys, bullmq, scheduled-jobs]

# Dependency graph
requires:
  - phase: 19-01
    provides: Database schema (satisfactionSurveys, communicationHealthScores tables)
provides:
  - NPS survey delivery via Slack DM with 0-10 radio buttons
  - 30-day frequency cap per user
  - Survey response recording (rating, NPS category, feedback text)
  - Weekly BullMQ job for automated delivery (Monday 9 AM UTC)
  - Survey expiration (7+ days unanswered)
  - Slack action handlers for submit/dismiss
affects: [19-03-health-score, 19-04-web-portal-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Block Kit DM surveys with radio_buttons for rating scale
    - Fire-and-forget survey delivery (failures logged but don't throw)
    - Weekly scheduled job pattern (Monday 9 AM UTC)
    - Org→Workspace→User traversal for broadcast jobs

key-files:
  created:
    - apps/slack-backend/src/services/satisfaction-survey.ts
    - apps/slack-backend/src/handlers/actions/satisfaction-survey.ts
  modified:
    - apps/slack-backend/src/services/index.ts
    - apps/slack-backend/src/handlers/actions/index.ts
    - apps/slack-backend/src/handlers/index.ts
    - apps/slack-backend/src/app.ts
    - apps/slack-backend/src/jobs/types.ts
    - apps/slack-backend/src/jobs/queues.ts
    - apps/slack-backend/src/jobs/workers.ts
    - apps/slack-backend/src/jobs/schedulers.ts
    - apps/slack-backend/src/jobs/index.ts
    - apps/slack-backend/src/index.ts

key-decisions:
  - "Block Kit radio_buttons for 0-10 rating scale (11 options, plain_text labels)"
  - "30-day frequency cap prevents survey fatigue"
  - "7-day expiration window for unanswered surveys"
  - "Weekly Monday 9 AM UTC delivery schedule"
  - "Fire-and-forget delivery pattern (errors logged, job completes successfully)"
  - "NPS categorization: 9-10 promoter, 7-8 passive, 0-6 detractor"

patterns-established:
  - "Survey Block Kit pattern: header → section → radio_buttons → optional input → action buttons"
  - "Type narrowing for Slack body.state: typeof body.state !== 'string' check"
  - "Org→Workspace→User traversal with per-user try/catch isolation"

# Metrics
duration: 6min
completed: 2026-02-04
---

# Phase 19 Plan 02: Survey Service and Delivery Summary

**NPS surveys delivered via Slack DM with Block Kit radio buttons, 30-day frequency cap, and weekly BullMQ automation (Monday 9 AM UTC)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-04T20:54:16Z
- **Completed:** 2026-02-04T21:00:12Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Satisfaction survey service with Block Kit builder, delivery, frequency check, response recording, and expiration
- Slack action handlers for submit (with rating extraction from state), dismiss, and radio button acknowledgment
- BullMQ scheduled job delivers surveys weekly to all eligible users across all active organizations
- 7-day survey expiration automatically cleans up unanswered surveys

## Task Commits

Each task was committed atomically:

1. **Task 1: Create satisfaction survey service** - `f4c3bfe` (feat)
2. **Task 2: Create action handlers and BullMQ survey delivery job** - `55b7376` (feat)

## Files Created/Modified

**Created:**
- `apps/slack-backend/src/services/satisfaction-survey.ts` - Survey Block Kit builder, delivery, frequency check, response recording, expiration
- `apps/slack-backend/src/handlers/actions/satisfaction-survey.ts` - Slack action handlers for submit/dismiss/rating

**Modified:**
- `apps/slack-backend/src/services/index.ts` - Export satisfaction survey functions
- `apps/slack-backend/src/handlers/actions/index.ts` - Export registerSatisfactionSurveyActions
- `apps/slack-backend/src/handlers/index.ts` - Re-export action registration
- `apps/slack-backend/src/app.ts` - Register satisfaction survey actions
- `apps/slack-backend/src/jobs/types.ts` - Add SatisfactionSurveyJobData/Result types
- `apps/slack-backend/src/jobs/queues.ts` - Add satisfactionSurveyQueue
- `apps/slack-backend/src/jobs/workers.ts` - Add satisfaction survey worker (org→workspace→user traversal, eligibility check, delivery, expiration)
- `apps/slack-backend/src/jobs/schedulers.ts` - Add setupSatisfactionSurveyScheduler (Monday 9 AM UTC)
- `apps/slack-backend/src/jobs/index.ts` - Export setupSatisfactionSurveyScheduler
- `apps/slack-backend/src/index.ts` - Call setupSatisfactionSurveyScheduler on startup

## Decisions Made

**Block Kit radio_buttons for 0-10 rating scale:**
- 11 options (0-10) as plain_text labels
- block_id includes surveyId for state extraction: `satisfaction_survey_${surveyId}`
- action_id `satisfaction_rating` requires acknowledgment

**30-day frequency cap:**
- canSurveyUser queries most recent survey, checks 30+ days elapsed
- Fire-and-forget pattern: eligibility failures don't throw

**7-day expiration window:**
- expireOldSurveys updates status='expired' for delivered surveys older than 7 days
- Called at end of survey delivery job

**Weekly Monday 9 AM UTC delivery:**
- Cron pattern: `0 9 * * 1`
- BullMQ upsertJobScheduler ensures scheduler persists across restarts

**Fire-and-forget delivery pattern:**
- Per-user delivery wrapped in try/catch
- Errors logged with logger.warn, errors count tracked in job result
- Job completes successfully even if some deliveries fail

**NPS categorization:**
- 9-10 = promoter, 7-8 = passive, 0-6 = detractor
- Stored in npsCategory column on response

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript type narrowing for body.state:**
- Issue: Slack body.state can be `string | { values: ... }`, TypeScript couldn't narrow with `'state' in body` alone
- Fix: Added `typeof body.state !== 'string'` check before accessing body.state.values
- Verification: `npx tsc --noEmit` passed

**Parallel plan 19-03 execution:**
- Plan 19-03 (health score) ran concurrently, added HealthScoreJobData types, healthScoreQueue, and setupHealthScoreScheduler
- No conflicts - both plans touched different parts of shared files
- Coordination: Re-read shared files before each edit as instructed in plan frontmatter

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 19 Plan 03 (Health Score Computation):**
- Survey delivery and response recording complete
- satisfactionSurveys table populated with rating and npsCategory data
- Ready to compute health scores from survey responses

**Ready for Phase 19 Plan 04 (Web Portal Analytics):**
- Survey data available for NPS calculation and visualization
- Action handlers provide complete user interaction flow

**No blockers or concerns.**

---
*Phase: 19-satisfaction-measurement*
*Completed: 2026-02-04*
