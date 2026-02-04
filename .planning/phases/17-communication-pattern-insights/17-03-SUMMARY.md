---
phase: 17
plan: 03
subsystem: analytics
tags: [trends, aggregation, bullmq, scheduler, patterns]
requires: [17-01]
provides: [daily-trend-aggregation, pattern-insights]
affects: [17-04]
tech-stack:
  added: []
  patterns: [bullmq-scheduler, error-isolation, sql-aggregation]
key-files:
  created:
    - apps/slack-backend/src/services/trend-aggregator.ts
  modified:
    - apps/slack-backend/src/services/index.ts
    - apps/slack-backend/src/jobs/types.ts
    - apps/slack-backend/src/jobs/queues.ts
    - apps/slack-backend/src/jobs/workers.ts
    - apps/slack-backend/src/jobs/schedulers.ts
    - apps/slack-backend/src/jobs/index.ts
    - apps/slack-backend/src/index.ts
decisions:
  - id: daily-3am-schedule
    decision: Schedule trend aggregation at 3 AM UTC daily
    rationale: Same time as data retention job, runs after usage reporting (2 AM), aggregates yesterday's data
    alternatives: [real-time aggregation, hourly batches]
  - id: error-isolation-per-org
    decision: Isolate errors per organization during batch processing
    rationale: One org failure doesn't block aggregation for other orgs, incremental progress tracking
    alternatives: [fail-fast, transactional batch]
  - id: sql-aggregation-queries
    decision: Use raw SQL with db.execute() for aggregation queries
    rationale: GROUP BY queries with JSONB access are more readable in SQL, performance optimization
    alternatives: [drizzle query builder, separate service calls]
  - id: channel-hotspot-threshold
    decision: Require min 10 messages and 30% complaint/escalation ratio
    rationale: Filters noise from low-volume channels, focuses on statistically significant patterns
    alternatives: [fixed threshold, weighted scoring]
metrics:
  duration: 14m
  completed: 2026-02-04
---

# Phase 17 Plan 03: Trend Aggregator and Scheduler Summary

**One-liner:** Daily trend aggregation service that computes topic distributions, sentiment patterns, escalation counts, and channel hotspots for all organizations at 3 AM UTC

## What Was Built

### Trend Aggregator Service

Created `apps/slack-backend/src/services/trend-aggregator.ts`:

**Core function:** `aggregateDailyTrends(targetDate?: Date)`
- Defaults to yesterday if no date provided
- Fetches all organizations from database
- Processes each org with error isolation
- Returns `{ organizationsProcessed, trendsCreated, errors }`

**Per-organization aggregation steps:**

1. **Topic distribution** - GROUP BY topic, count classifications
2. **Sentiment distribution** - GROUP BY sentiment->>'tone' from JSONB
3. **Escalation counts** - GROUP BY severity from escalation_alerts
4. **Channel hotspots** - Identify channels with ≥10 messages and >30% complaint/escalation ratio
5. **Average confidence** - Compute avg(confidence) across all classifications
6. **Upsert into communication_trends** - onConflictDoUpdate on unique (org, date, period)

**Error handling:**
- Organization-level try/catch blocks
- Failed orgs don't block others
- Detailed logging for debugging
- Returns error count in result

### BullMQ Job System

**Job types** (`apps/slack-backend/src/jobs/types.ts`):
```typescript
export interface TrendAggregationJobData {
  triggeredBy: 'schedule' | 'manual';
  targetDate?: string; // ISO date string
}

export interface TrendAggregationJobResult {
  organizationsProcessed: number;
  trendsCreated: number;
  errors: number;
}
```

**Queue** (`apps/slack-backend/src/jobs/queues.ts`):
- Name: `trend-aggregation`
- Attempts: 3 with exponential backoff (1min, 2min, 4min)
- Retention: 50 completed, 100 failed jobs

**Worker** (`apps/slack-backend/src/jobs/workers.ts`):
- Concurrency: 1 (only one aggregation at a time)
- Parses optional targetDate from job data
- Logs job start, completion, and errors
- Event handlers for error/failed/completed

**Scheduler** (`apps/slack-backend/src/jobs/schedulers.ts`):
```typescript
export async function setupTrendAggregationScheduler()
```
- Cron pattern: `0 3 * * *` (daily at 3 AM UTC)
- Job name: `aggregate-daily-trends`
- Uses BullMQ Job Scheduler API (upsertJobScheduler)

**Startup integration** (`apps/slack-backend/src/index.ts`):
```typescript
await setupTrendAggregationScheduler();
logger.info('Trend aggregation scheduler configured');
```

### SQL Aggregation Queries

**Topic distribution:**
```sql
SELECT topic, COUNT(*) as count
FROM topic_classifications
WHERE organization_id = ? AND created_at >= ? AND created_at < ?
GROUP BY topic
```

**Sentiment distribution:**
```sql
SELECT sentiment->>'tone' as tone, COUNT(*) as count
FROM topic_classifications
WHERE organization_id = ? AND created_at >= ? AND created_at < ?
  AND sentiment IS NOT NULL
GROUP BY sentiment->>'tone'
```

**Escalation counts:**
```sql
SELECT severity, COUNT(*) as count
FROM escalation_alerts
WHERE organization_id = ? AND created_at >= ? AND created_at < ?
GROUP BY severity
```

**Channel hotspots:**
```sql
SELECT
  channel_id,
  COUNT(*) as total_messages,
  SUM(CASE WHEN topic = 'complaint' THEN 1 ELSE 0 END) as complaint_count,
  SUM(CASE WHEN topic = 'escalation' THEN 1 ELSE 0 END) as escalation_count
FROM topic_classifications
WHERE organization_id = ? AND created_at >= ? AND created_at < ?
  AND channel_id IS NOT NULL
GROUP BY channel_id
HAVING COUNT(*) >= 10
```

**Average confidence:**
```sql
SELECT AVG(confidence) as avg_confidence
FROM topic_classifications
WHERE organization_id = ? AND created_at >= ? AND created_at < ?
  AND confidence IS NOT NULL
```

## Technical Details

### Date Range Calculation

```typescript
const date = targetDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
const dayStart = new Date(date);
dayStart.setUTCHours(0, 0, 0, 0);
const dayEnd = new Date(dayStart);
dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
```

Aggregates full UTC days (00:00:00 to 23:59:59.999).

### Channel Hotspot Detection

```typescript
const hotspotRatio = (complaintCount + escalationCount) / totalMessages;
if (hotspotRatio > 0.3) {
  channelHotspots.push({
    channelId: row.channel_id,
    riskScore: Math.round(hotspotRatio * 100),
    messageCount: totalMessages,
  });
}
```

Identifies high-risk channels for admin attention.

### Upsert Strategy

```typescript
await db
  .insert(communicationTrends)
  .values({ ... })
  .onConflictDoUpdate({
    target: [
      communicationTrends.organizationId,
      communicationTrends.trendDate,
      communicationTrends.trendPeriod,
    ],
    set: { ... },
  });
```

Re-running aggregation for same date updates existing record.

## Files Modified

### Created
- `apps/slack-backend/src/services/trend-aggregator.ts` - Core aggregation logic

### Modified
- `apps/slack-backend/src/services/index.ts` - Export aggregateDailyTrends
- `apps/slack-backend/src/jobs/types.ts` - Add TrendAggregation job types
- `apps/slack-backend/src/jobs/queues.ts` - Add trendAggregationQueue
- `apps/slack-backend/src/jobs/workers.ts` - Add trend aggregation worker
- `apps/slack-backend/src/jobs/schedulers.ts` - Add setupTrendAggregationScheduler
- `apps/slack-backend/src/jobs/index.ts` - Re-export scheduler setup
- `apps/slack-backend/src/index.ts` - Call scheduler setup on startup

## Testing Verification

```bash
# TypeScript compilation
cd apps/slack-backend && npx tsc --noEmit
# ✅ Passed

# Manual test (requires running backend)
curl -X POST http://localhost:3000/api/jobs/trend-aggregation
```

## Decisions Made

### 1. Daily 3 AM UTC Schedule

**Decision:** Run trend aggregation at 3:00 AM UTC every day

**Rationale:**
- Same time as data retention cleanup
- Runs after usage reporting (2 AM)
- Aggregates previous day's data when activity is lowest
- Consistent with other scheduled jobs

**Alternatives considered:**
- Real-time aggregation (too expensive, not needed for daily insights)
- Hourly batches (more complex, overkill for daily trends)

### 2. Error Isolation Per Organization

**Decision:** Wrap each organization's aggregation in try/catch, continue on failure

**Rationale:**
- One org's data issues don't block others
- Enables incremental progress tracking
- Failed orgs can be retried independently
- Better operational resilience

**Alternatives considered:**
- Fail-fast (would block all orgs on first error)
- Transactional batch (would require complex rollback logic)

### 3. SQL Aggregation Queries

**Decision:** Use raw SQL with `db.execute()` for GROUP BY aggregations

**Rationale:**
- More readable for complex GROUP BY with JSONB access
- Better performance than ORM-generated queries
- Explicit query structure for debugging
- Standard pattern for analytics queries

**Alternatives considered:**
- Drizzle query builder (verbose for GROUP BY with JSONB)
- Separate service calls (would require N+1 queries)

### 4. Channel Hotspot Threshold

**Decision:** Require minimum 10 messages and >30% complaint/escalation ratio

**Rationale:**
- Filters out noise from low-volume channels
- Focuses on statistically significant patterns
- 30% threshold catches problem channels without false positives
- Minimum 10 messages provides sufficient sample size

**Alternatives considered:**
- Fixed threshold (ignores channel volume)
- Weighted scoring (more complex, less interpretable)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

### Ready for 17-04 (Analytics API Endpoints)

**Provides:**
- Daily trend aggregation populates communication_trends table
- Trend data available for API queries
- Historical pattern analysis ready

**API endpoints can now:**
- Query communication_trends for date ranges
- Show topic distribution over time
- Identify sentiment trends
- Surface channel hotspots
- Track escalation patterns

**Schema ready:**
- topicDistribution: `Record<string, number>`
- sentimentDistribution: `Record<string, number>`
- escalationCounts: `Record<string, number>`
- channelHotspots: `Array<{ channelId, riskScore, messageCount }>`
- totalClassifications: `number`
- avgConfidence: `number`

## Commits

- d8220e7: feat(17-03): add trend aggregator service and daily scheduler

**Duration:** 14 minutes
