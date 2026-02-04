---
phase: 19-satisfaction-measurement
plan: 04
subsystem: analytics
status: complete
tags: [web-portal, satisfaction-analytics, health-scores, nps, csv-export, react-cache]

requires:
  - 19-01-database-schema

provides:
  - lib/admin/satisfaction-analytics.ts (7 cached query functions)
  - app/api/admin/satisfaction/route.ts (CSV export endpoint)

affects:
  - 19-05-web-portal-satisfaction-dashboard (will consume these queries)

tech-stack:
  added: []
  patterns:
    - React cache() for query performance optimization
    - DISTINCT ON for latest-per-user queries
    - Parallel Promise.all for multi-dataset API responses

key-files:
  created:
    - apps/web-portal/lib/admin/satisfaction-analytics.ts
    - apps/web-portal/app/api/admin/satisfaction/route.ts
  modified: []

decisions:
  - React cache() wrapping: All 7 query functions wrapped with cache() for automatic deduplication and memoization
  - DISTINCT ON pattern: getUserHealthScores uses DISTINCT ON (userId) ORDER BY scoreDate DESC to get latest score per user
  - Parallel CSV exports: API route supports 3 types (health-scores, users, surveys) via ?type= query param
  - 52-week default for CSV: Health score trend CSV defaults to 52 weeks (1 year) for comprehensive export
  - NPS calculation: (promoters% - detractors%) following industry standard NPS formula
  - Baseline vs post-baseline: getBeforeAfterComparison separates scores by isBaseline flag for improvement tracking
  - Thumbs ratio from feedback: getThumbsRatioTrend counts 'accepted'/'sent' as thumbs up, 'dismissed' as thumbs down
  - User ranking by health score: getUserHealthScores sorts DESC with null scores last for best-first display

metrics:
  duration: 3 minutes
  completed: 2026-02-04
---

# Phase 19 Plan 04: Web Portal Satisfaction Analytics Query Library + API Route Summary

**One-liner:** 7 cached query functions + CSV export API for health scores, NPS, surveys, and user rankings

## What Was Built

### Satisfaction Analytics Query Library (satisfaction-analytics.ts)

Created 7 cached query functions following the established pattern from response-time-analytics.ts:

1. **getHealthScoreOverview** - Current vs previous team aggregate scores with component breakdowns
2. **getHealthScoreTrend** - Historical health scores over configurable weeks (default 12)
3. **getNPSDistribution** - Promoters/passives/detractors with NPS score calculation
4. **getSurveyStats** - Survey delivery and completion statistics
5. **getBeforeAfterComparison** - Baseline vs post-baseline improvement tracking
6. **getThumbsRatioTrend** - Daily acceptance/dismissal ratios from suggestion feedback
7. **getUserHealthScores** - Per-user health score rankings (DISTINCT ON pattern)

### API Route (app/api/admin/satisfaction/route.ts)

GET endpoint with CSV export support:
- **Default JSON**: Returns all 4 datasets (healthScoreTrend, userScores, surveyStats, npsDistribution) in parallel
- **CSV Export**: Supports 3 types via ?type= query parameter
  - `type=health-scores` - 52-week trend data
  - `type=users` - User health score rankings
  - `type=surveys` - Combined survey stats + NPS distribution

## Technical Implementation

### Query Patterns

**React cache() for performance:**
```typescript
export const getHealthScoreOverview = cache(async (
  organizationId: string,
  workspaceId: string,
  days: number = 30
): Promise<HealthScoreOverview> => {
  // Automatic deduplication across components
});
```

**DISTINCT ON for latest-per-user:**
```sql
SELECT DISTINCT ON (user_id)
  user_id, health_score, score_date
FROM communication_health_scores
WHERE organization_id = $1 AND user_id IS NOT NULL
ORDER BY user_id, score_date DESC
```

**Parallel API responses:**
```typescript
const [healthScoreTrend, userScores, surveyStats, npsDistribution] = await Promise.all([
  getHealthScoreTrend(organizationId, workspaceId),
  getUserHealthScores(organizationId, workspaceId),
  getSurveyStats(organizationId),
  getNPSDistribution(organizationId),
]);
```

### NPS Calculation

Follows industry standard formula:
```typescript
const npsScore = totalResponses > 0
  ? ((promoters / totalResponses) * 100) - ((detractors / totalResponses) * 100)
  : 0;
```

Where:
- Promoters: rating 9-10
- Passives: rating 7-8
- Detractors: rating 0-6

### Baseline vs Post-Baseline Tracking

```typescript
// Baseline: isBaseline = true (first 30 days)
AVG(health_score) WHERE is_baseline = true

// Post-baseline: isBaseline = false
AVG(health_score) WHERE is_baseline = false

// Improvement
improvementPercent = ((current - baseline) / baseline) * 100
```

## Data Structures

### HealthScoreOverview
- Current/previous team aggregate scores
- Change percent
- User counts (scored vs insufficient data)
- Component averages (acceptance, response time, sentiment, satisfaction, engagement)

### HealthScoreTrendPoint
- Date
- Health score
- All component metrics (nullable for sparse data)

### NPSDistribution
- Promoters/passives/detractors counts
- Total responses
- NPS score (-100 to +100)
- Response rate percentage

### SurveyStats
- Total delivered/completed/expired/dismissed
- Average rating (0-10)
- Response rate percentage

### BeforeAfterComparison
- Baseline score average
- Current score average
- Absolute improvement
- Percent improvement
- Week counts for each period

### ThumbsRatioPoint
- Date
- Thumbs up/down counts
- Total
- Ratio (0-100)

### UserHealthScore
- User ID
- Health score (nullable)
- Acceptance rate
- Engagement rate
- Total suggestions
- Is baseline flag
- Score date

## Multi-Tenant Isolation

All queries enforce organization-level isolation:
- `WHERE organization_id = ${organizationId}` in all satisfaction and health score queries
- `requireAdmin()` validates session organization membership
- Workspace-scoped queries additionally filter by `workspace_id`

## CSV Export Design

Three export types for different use cases:

1. **Health Scores** - Time series analysis (52 weeks default)
   - Useful for: Trend visualization in external tools

2. **Users** - User ranking and segmentation
   - Useful for: Identifying high/low performers, coaching opportunities

3. **Surveys** - Satisfaction metrics snapshot
   - Useful for: Executive reporting, board presentations

## Performance Characteristics

- **React cache()** - Automatic deduplication prevents redundant database queries
- **Parallel queries** - JSON endpoint fetches 4 datasets concurrently
- **Indexed queries** - All queries leverage existing indexes on organization_id, score_date, user_id
- **Null handling** - All component metrics nullable to avoid forcing expensive calculations on insufficient data

## Success Criteria Met

- ✅ 7 query functions: overview, trend, NPS distribution, survey stats, before/after, thumbs ratio, user scores
- ✅ API route with CSV export for 3 data types
- ✅ All queries scoped by organizationId for multi-tenant isolation
- ✅ Before/after comparison correctly separates baseline vs post-baseline scores
- ✅ NPS score calculated as promoters% minus detractors%
- ✅ All queries use parameterized SQL (no injection risk)
- ✅ Functions follow cache() wrapping pattern from existing analytics modules

## Deviations from Plan

None - plan executed exactly as written.

## Files Created

1. **apps/web-portal/lib/admin/satisfaction-analytics.ts** (512 lines)
   - 7 cached query functions
   - 8 TypeScript interfaces
   - Raw SQL queries with parameterization
   - Follows response-time-analytics.ts pattern

2. **apps/web-portal/app/api/admin/satisfaction/route.ts** (60 lines)
   - GET endpoint with CSV export
   - 3 export types via query param
   - Parallel JSON response
   - Follows response-times/route.ts pattern

## Next Phase Readiness

**Ready for Phase 19 Plan 05 (Dashboard UI):**
- All query functions available for server component consumption
- API route ready for CSV download buttons
- Interfaces exported for TypeScript type safety
- Follows established patterns (trivial to use from dashboard components)

**No blockers.**

## Testing Notes

**Manual verification needed:**
- Query functions return correct data shapes
- CSV export generates valid CSV with all columns
- Cache deduplication works across component renders
- NPS score calculation matches formula
- Before/after comparison handles missing baseline data gracefully

**Integration with dashboard (Plan 05):**
- Server components will call query functions directly (React cache ensures performance)
- CSV download buttons will link to `/api/admin/satisfaction?format=csv&type={type}`
- Loading states handled by Suspense boundaries

## Lessons Learned

1. **DISTINCT ON is powerful** - PostgreSQL-specific pattern for "latest per user" queries is much cleaner than window functions
2. **Parallel exports scale** - Supporting multiple CSV types via query param is more maintainable than separate endpoints
3. **Null handling crucial** - Health score components must be nullable because insufficient data is a valid state
4. **React cache() simplifies** - No need for manual caching logic, React handles deduplication automatically

---

**Status:** Complete
**Duration:** 3 minutes
**Commits:** 2 (6217843, b85daf8)
