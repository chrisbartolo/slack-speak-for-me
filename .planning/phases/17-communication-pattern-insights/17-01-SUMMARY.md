---
phase: 17-communication-pattern-insights
plan: 01
subsystem: database
tags: [drizzle-orm, postgres, schema, topic-classification, communication-trends]

# Dependency graph
requires:
  - phase: 16-response-time-analytics
    provides: suggestionMetrics table pattern with denormalized organizationId and suggestionId unique index
provides:
  - topicClassifications table for per-suggestion topic tracking with sentiment analysis
  - communicationTrends table for daily aggregate pattern analysis
  - Type exports for both tables (TopicClassification, NewTopicClassification, CommunicationTrend, NewCommunicationTrend)
affects: [17-02-topic-classifier-service, 17-03-trends-aggregation, 17-04-insights-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [denormalized-org-id-pattern, suggestionId-as-unique-key, jsonb-for-complex-data]

key-files:
  created: []
  modified: [packages/database/src/schema.ts]

key-decisions:
  - "suggestionId as unique key (not foreign key) following suggestionMetrics pattern"
  - "Confidence stored as integer 0-100 for consistency with other metrics"
  - "JSONB columns for flexible sentiment and aggregate data structures"
  - "Unique index on (organizationId, trendDate, trendPeriod) to prevent duplicate trend records"

patterns-established:
  - "Denormalized organizationId pattern: Copy org ID to classification record for fast org-wide queries without joins"
  - "suggestionId unique index pattern: Enables upsert operations and links to suggestions without foreign key constraint"
  - "Multi-column time indexes: org/time, topic/time, channel/time, user/time for various query patterns"

# Metrics
duration: 5min
completed: 2026-02-04
---

# Phase 17 Plan 01: Database Schema for Pattern Insights Summary

**Added topicClassifications and communicationTrends tables with proper indexes for real-time topic tracking and daily aggregate analysis**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-04T12:17:00+01:00
- **Completed:** 2026-02-04T12:22:36+01:00
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added topic_classifications table with 7 topic types (scheduling, complaint, technical, status_update, request, escalation, general)
- Added communication_trends table for daily aggregates with topic/sentiment distributions
- Implemented 5 indexes on topicClassifications (org/time, topic, suggestion, channel, user)
- Implemented 2 indexes on communicationTrends (unique org/date/period, trendDate)
- Included proper type exports for TypeScript type safety

## Task Commits

Each task was committed atomically:

1. **Task 1 & 2: Add both tables** - `6eae6b8` (feat)

## Files Created/Modified
- `packages/database/src/schema.ts` - Added topicClassifications and communicationTrends tables after suggestionMetrics

## Decisions Made

1. **suggestionId as unique key (not foreign key)** - Follows suggestionMetrics pattern where suggestionId is a unique text field rather than a foreign key. This allows flexibility in recording classifications even if suggestion records are deleted or in different systems.

2. **Confidence stored as integer 0-100** - Matches existing patterns in codebase (e.g., actionableItems.confidenceScore). Float 0.0-1.0 values should be multiplied by 100 before insert.

3. **JSONB for sentiment and aggregates** - sentiment column stores SentimentAnalysis object (same type as escalationAlerts.sentiment). Trend aggregates use JSONB for flexible schema evolution.

4. **Unique constraint on trend records** - uniqueIndex on (organizationId, trendDate, trendPeriod) ensures exactly one daily trend record per org, enabling safe upsert operations.

5. **Denormalized organizationId** - Following Phase 16's pattern, organizationId is stored directly in topicClassifications for fast org-wide queries without joining through workspace.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - schema followed existing Drizzle ORM patterns consistently.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Database schema ready for:
- Phase 17-02: Topic classifier service can insert into topicClassifications
- Phase 17-03: Aggregation jobs can compute daily trends into communicationTrends
- Phase 17-04: Dashboard can query both tables for insights visualization

**Blockers:** None

**Concerns:** Ensure pgvector extension is enabled in production database before Phase 17 if any similarity search is planned (noted in STATE.md from Phase 3).

---
*Phase: 17-communication-pattern-insights*
*Completed: 2026-02-04*
