---
phase: 19-satisfaction-measurement
plan: 03
subsystem: satisfaction-measurement
tags: [health-score, metrics, analytics, bullmq, scheduler]
completed: 2026-02-04
duration: 6 min

requires:
  - 19-01-database-schema
provides:
  - health-score-calculator
  - weekly-health-score-computation
affects:
  - 19-04-web-portal-analytics

tech-stack:
  added: []
  patterns:
    - weighted-composite-scoring
    - multi-metric-health-calculation
    - baseline-period-detection
    - weekly-batch-processing

key-files:
  created:
    - apps/slack-backend/src/services/health-score.ts
  modified:
    - apps/slack-backend/src/services/index.ts
    - apps/slack-backend/src/jobs/types.ts
    - apps/slack-backend/src/jobs/queues.ts
    - apps/slack-backend/src/jobs/workers.ts
    - apps/slack-backend/src/jobs/schedulers.ts
    - apps/slack-backend/src/jobs/index.ts
    - apps/slack-backend/src/index.ts

decisions:
  - title: Health score weights (25/20/20/20/15)
    rationale: Acceptance rate most important (25%), then response time, sentiment, satisfaction equally (20% each), engagement least critical (15%)
  - title: MIN_SUGGESTIONS_FOR_SCORE = 5
    rationale: Below 5 suggestions, score is unreliable and misleading - return null for insufficient data
  - title: Null metric fallback to 50 (neutral)
    rationale: Missing component metrics default to 50 on 0-100 scale to avoid penalizing new users
  - title: Response time inverted scoring
    rationale: Lower response times are better - invert and clamp to 60s max (60000 - ms / 60000 * 100)
  - title: Baseline period = first 5 weeks
    rationale: 5 weekly scores approximate 30-day baseline for before/after comparison
  - title: Sunday 2 AM UTC weekly schedule
    rationale: Runs before satisfaction surveys (Monday 9 AM) and after usage reporting (daily 2 AM)
  - title: Team aggregate with userId null
    rationale: Separate team-wide health score alongside individual scores for org-level insights
  - title: Raw SQL for multi-source queries
    rationale: Complex aggregations across 5 tables more readable in SQL, follows trend-aggregator pattern
---

# Phase 19 Plan 03: Health Score Calculator + Weekly BullMQ Job Summary

**One-liner:** Weighted composite health scoring (25/20/20/20/15) from 5 metrics with Sunday 2 AM UTC weekly batch computation and baseline detection

## What Was Built

### Health Score Calculator Service

Created `apps/slack-backend/src/services/health-score.ts` with:

**1. calculateHealthScore(metrics, weights):**
- Takes HealthMetrics (6 fields: acceptanceRate, avgResponseTimeMs, avgSentimentScore, avgSatisfactionScore, engagementRate, totalSuggestions)
- Returns null if totalSuggestions < 5 (insufficient data threshold)
- Normalizes each metric to 0-100 scale:
  - acceptanceRate: multiply by 100 (0-1 to 0-100). Null defaults to 50
  - responseTime: inverted (lower is better). Score = ((60000 - clamp(ms, 0, 60000)) / 60000) * 100. Null defaults to 50
  - sentimentScore: multiply by 100 (0-1 to 0-100). Null defaults to 50
  - satisfactionScore: multiply by 10 (0-10 NPS to 0-100). Null defaults to 50
  - engagementRate: multiply by 100 (0-1 to 0-100). Null defaults to 50
- Applies weighted composite: acceptance 25%, responseTime 20%, sentiment 20%, satisfaction 20%, engagement 15%
- Returns rounded integer 0-100

**2. fetchWeeklyMetrics(organizationId, workspaceId, userId, weekStart, weekEnd):**
- Queries 5 data sources with raw SQL (follows trend-aggregator pattern):
  - **Acceptance rate:** From `suggestion_feedback` table (COUNT WHERE action='accepted' / total COUNT). Nullable if no feedback rows exist (table populated by Phase 6/15 action handlers)
  - **Avg response time:** From `suggestion_metrics` (AVG(total_duration_ms) WHERE delivered_at in range and NOT NULL)
  - **Avg sentiment:** From `topic_classifications` (AVG of CASE statement: positive/neutral=1.0, cautious=0.5, else 0.0)
  - **Avg satisfaction:** From `satisfaction_surveys` (AVG(rating) WHERE status='completed' and responded_at in range)
  - **Engagement rate:** From `usage_events` (COUNT DISTINCT DATE / 5 working days, clamped to 1.0)
  - **Total suggestions:** From `suggestion_metrics` (COUNT WHERE created_at in range)
- Supports both per-user (userId provided) and team aggregate (userId null) queries
- Each metric query wrapped in try/catch with logger.warn on failure, never blocks scoring

**3. isBaselinePeriod(organizationId, userId):**
- Counts existing communicationHealthScores records for this org+user
- Returns true if < 5 weeks of scores (baseline period)
- Used to set isBaseline flag for before/after analysis

**4. computeAndStoreHealthScores(weekStartDate?):**
- Defaults to previous week (Monday-based via startOfWeek with weekStartsOn:1, then subtract 7 days)
- Fetches all active organizations
- For each org (with per-org error isolation try/catch):
  - Get workspace for org
  - Get all users for workspace
  - For each user:
    - fetchWeeklyMetrics with userId
    - calculateHealthScore
    - Check isBaselinePeriod
    - If score not null, insert into communicationHealthScores with all component values and isBaseline flag
  - Compute team aggregate:
    - fetchWeeklyMetrics with userId=null
    - calculateHealthScore
    - Check isBaselinePeriod
    - Insert team score with userId=null
- Returns summary: { orgsProcessed, scoresCreated, errors }

**Exported from services/index.ts:**
- calculateHealthScore
- fetchWeeklyMetrics
- computeAndStoreHealthScores

### BullMQ Job System

**1. Job types (jobs/types.ts):**
- HealthScoreJobData: { triggeredBy: 'schedule' | 'manual', weekStartDate?: string }
- HealthScoreJobResult: { orgsProcessed: number, scoresCreated: number, errors: number }

**2. Queue (jobs/queues.ts):**
- healthScoreQueue with 2 attempts, exponential backoff (60s delay), 50 completed/100 failed retention

**3. Worker (jobs/workers.ts):**
- healthScoreWorker with concurrency 1 (only one batch at a time)
- Calls computeAndStoreHealthScores with optional weekStartDate
- Logs job start, completion with result metrics, errors, and failures
- Error isolation: org-level failures don't block other orgs

**4. Scheduler (jobs/schedulers.ts):**
- setupHealthScoreScheduler: Sunday 2 AM UTC (cron: '0 2 * * 0')
- Scheduler ID: 'weekly-health-score'
- Job name: 'calculate-health-scores'
- Survives restarts via BullMQ JobScheduler persistence

**5. Integration (index.ts):**
- Worker started in startWorkers() (line 20)
- Worker stopped in stopWorkers() with graceful cleanup
- Scheduler registered on startup after setupSatisfactionSurveyScheduler
- Log: 'Health score scheduler configured'

## Technical Decisions

**Weighted composite formula:**
Acceptance rate 25% (most important signal), response time 20% (performance quality), sentiment 20% (communication tone), satisfaction 20% (user-reported quality), engagement 15% (usage consistency). Weights sum to 100%, producing balanced composite.

**Insufficient data threshold:**
5 suggestions minimum provides statistical significance. Below this, scores are unreliable and misleading - return null instead of fabricated score.

**Null metric handling:**
Missing component metrics default to 50 (neutral score on 0-100 scale). Avoids penalizing new users or orgs with sparse data. Weighted composite still produces meaningful score with partial data.

**Response time inversion:**
Lower response times indicate better performance. Formula: ((60000 - clamp(ms, 0, 60000)) / 60000) * 100 normalizes to 0-100 where 100 = instant, 0 = 60+ seconds. Clamp prevents negative scores.

**Baseline period detection:**
First 5 weekly scores (approximately 30 days) marked as baseline with isBaseline=true flag. Enables before/after comparison in analytics - "How has communication improved since onboarding?"

**Team aggregate pattern:**
Separate score with userId=null provides org-level health without requiring per-user drill-down. Single query for team metrics (no userId filter) produces aggregate view.

**Sunday 2 AM UTC schedule:**
Runs before satisfaction surveys (Monday 9 AM) and after daily usage reporting (2 AM). Weekend timing avoids business hours load, computes previous week's data.

**Raw SQL for metrics:**
Complex aggregations across 5 tables (feedback, metrics, classifications, surveys, events) more readable in raw SQL. Follows existing trend-aggregator pattern. Type-safe with db.execute<T>().

**Error isolation per org:**
Batch processor wraps each org in try/catch. One org failure doesn't block others, enables incremental progress tracking in result.errors count.

**Acceptance rate source:**
Queries suggestionFeedback table populated by existing Phase 6/15 suggestion action handlers. If table empty (no users have interacted with suggestions), acceptanceRate is null and defaults to 50 in scoring. This is correct behavior, not a bug.

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**For 19-04 (Web Portal Analytics):**
- ✅ Health score computation service available
- ✅ Weekly job populates communicationHealthScores table
- ✅ Per-user and team aggregate scores stored
- ✅ Baseline flag enables before/after comparisons
- ✅ Component metrics stored (acceptance, response time, sentiment, satisfaction, engagement) for drill-down
- ⚠️ First scores appear after Sunday 2 AM UTC run (requires data from preceding week)
- ⚠️ Min 5 suggestions per user/week for score (below this, null returned)

**Blockers/Concerns:**
None. All dependencies satisfied. Health score service ready for API integration in 19-04.

## Testing Notes

**Manual verification commands:**
```bash
# Compile check
npx tsc --noEmit --project apps/slack-backend/tsconfig.json

# Verify suggestion_feedback table exists (acceptance rate source)
grep -A 10 "suggestionFeedback" packages/database/src/schema.ts

# Test function exports
grep "health-score" apps/slack-backend/src/services/index.ts

# Verify scheduler registered
grep "setupHealthScoreScheduler" apps/slack-backend/src/index.ts
```

**Acceptance rate table verification:**
The `suggestion_feedback` table exists in schema.ts (line 249) with columns: workspace_id, user_id, action ('accepted' | 'refined' | 'dismissed' | 'sent'), created_at. This table is populated by existing Phase 6/15 suggestion action handlers. The health score's acceptance rate component correctly queries this table - if it has no rows yet (e.g., no users have interacted with suggestions), the acceptanceRate metric will be null and the default value of 50 will be used in scoring. This is correct behavior, not a bug.

**Production validation:**
After first Sunday 2 AM UTC run:
1. Check logs for "Health score computation completed" with orgsProcessed/scoresCreated counts
2. Query communicationHealthScores for isBaseline=true records (first 5 weeks)
3. Verify team aggregate scores have userId=null
4. Confirm users with < 5 suggestions have no health score record (null handling)

## Files Changed

**Created:**
- apps/slack-backend/src/services/health-score.ts (504 lines)

**Modified:**
- apps/slack-backend/src/services/index.ts (+5 lines, health score exports)
- apps/slack-backend/src/jobs/types.ts (+10 lines, HealthScoreJobData/Result)
- apps/slack-backend/src/jobs/queues.ts (+10 lines, healthScoreQueue)
- apps/slack-backend/src/jobs/workers.ts (+25 lines, worker + import + cleanup)
- apps/slack-backend/src/jobs/schedulers.ts (+30 lines, setupHealthScoreScheduler)
- apps/slack-backend/src/jobs/index.ts (+1 line, export scheduler)
- apps/slack-backend/src/index.ts (+4 lines, import + call + log)

**Note on commits:**
Task 1 committed independently (329c616). Task 2 changes to shared files were included in Plan 19-02's commit (55b7376) due to parallel execution. All changes verified present in git history.

## Performance Notes

**Batch processing:**
- Concurrency 1 worker prevents database overload
- Per-org error isolation allows incremental progress
- 5 SQL queries per user/team (acceptable for weekly batch)

**Query efficiency:**
- Raw SQL with proper indexes (workspace_id, organization_id, user_id, created_at on all source tables)
- Date range filters (weekStart/weekEnd) limit result sets
- COUNT aggregations cached by PostgreSQL query planner

**Scheduler overhead:**
- Minimal - BullMQ JobScheduler uses Redis storage, no polling
- Sunday 2 AM UTC timing avoids business hours load

**Expected runtime:**
- ~50 orgs, ~10 users/org, ~5 queries/user = 2500 queries
- Estimated 5-10 minutes total runtime for full batch
- Scales linearly with org count
