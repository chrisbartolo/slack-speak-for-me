---
phase: 18-auto-learning-knowledge-base
plan: 04
subsystem: api-routes
tags: [api, admin, kb-candidates, kb-effectiveness, next.js, drizzle]

requires:
  - 18-01: kbCandidates and kbEffectiveness tables
  - knowledge_base_documents: For publishing approved candidates
  - suggestion_feedback: For effectiveness tracking

provides:
  - KB candidates list API with filtering and pagination
  - KB candidate review actions API (approve/reject/merge)
  - KB effectiveness metrics API
  - Growth trend analytics

affects:
  - 18-05: Admin UI will consume these API endpoints
  - Future analytics dashboards

tech-stack:
  added: []
  patterns:
    - "Next.js API routes with requireAdmin middleware"
    - "Drizzle ORM with raw SQL for complex aggregations"
    - "Parameterized SQL for org-scoped queries"
    - "Pagination with limit/offset pattern"

key-files:
  created:
    - apps/web-portal/app/api/admin/kb-candidates/route.ts: "List endpoint with filters"
    - apps/web-portal/app/api/admin/kb-candidates/[id]/route.ts: "Single candidate and review actions"
    - apps/web-portal/app/api/admin/kb-effectiveness/route.ts: "Effectiveness metrics and analytics"
  modified:
    - apps/web-portal/lib/db/index.ts: "Added kbCandidates and kbEffectiveness exports"

decisions:
  - decision: "Raw SQL for effectiveness queries"
    rationale: "Complex JOINs with aggregations more readable and performant in raw SQL vs ORM builder"
    alternatives: ["Drizzle query builder with subqueries", "Multiple separate queries"]
    phase: 18
    plan: 04
  - decision: "Quality score sorting as default"
    rationale: "Admins want to review highest-quality candidates first for maximum impact"
    alternatives: ["Acceptance count default", "Creation date default"]
    phase: 18
    plan: 04
  - decision: "12-week growth trend window"
    rationale: "Quarter-view shows seasonal patterns without overwhelming chart UI"
    alternatives: ["4 weeks (monthly)", "26 weeks (half-year)"]
    phase: 18
    plan: 04
  - decision: "Null coalescing on acceptanceCount merge"
    rationale: "TypeScript sees integer with default as nullable, defensive programming prevents NaN"
    alternatives: ["Assert non-null", "Update schema to notNull()"]
    phase: 18
    plan: 04

metrics:
  tasks: 2
  commits: 2
  files_modified: 4
  duration: "3.6 minutes"
  completed: 2026-02-04
---

# Phase 18 Plan 04: KB Management API Routes Summary

API endpoints for KB candidate management (list, approve, reject, merge) and effectiveness metrics for admin dashboard.

## Objective

Create API routes for KB candidate management and effectiveness metrics.

**Purpose:** The web portal dashboard needs API endpoints to display KB candidates for admin review, perform review actions, and show effectiveness metrics.

**Output:** Three API route files providing candidate CRUD, review actions, and effectiveness data.

## What Was Built

### KB Candidates API (route.ts)

**GET /api/admin/kb-candidates** - List candidates with filtering and pagination:
- Query params: `status` (default 'pending'), `category`, `limit` (default 20, max 100), `offset`, `sort` ('quality_score' by default)
- Returns: `{ candidates, total, limit, offset }` for pagination UI
- Filters by organizationId from admin session
- Supports sorting by quality_score, acceptance_count, or created_at

**Implementation highlights:**
- Uses `and()` to combine WHERE conditions dynamically based on query params
- Separate count query for total (pagination needs)
- Drizzle `desc()` for quality-based sorting

### KB Candidates Actions API ([id]/route.ts)

**GET /api/admin/kb-candidates/[id]** - Get single candidate:
- Returns full candidate object with all metadata
- Org-scoped for security (can only access own org's candidates)

**PATCH /api/admin/kb-candidates/[id]** - Review actions:

**Approve action:**
1. Reads candidate record
2. Inserts into knowledgeBaseDocuments (title, content, category, tags, embedding, isActive=true)
3. Updates candidate: status='approved', reviewedBy, reviewedAt, publishedDocumentId
4. Returns `{ success: true, documentId }`

**Reject action:**
1. Updates candidate: status='rejected', reviewedBy, reviewedAt, rejectionReason
2. Rejection reason required (captured for learning)
3. Returns `{ success: true }`

**Merge action:**
1. Validates mergeWithId exists in same org
2. Adds this candidate's acceptanceCount to target's acceptanceCount
3. Updates this candidate: status='merged', mergedIntoId, reviewedBy, reviewedAt
4. Returns `{ success: true }`

**Validation:** Zod schema validates action type and required fields per action.

### KB Effectiveness API (route.ts)

**GET /api/admin/kb-effectiveness** - Comprehensive analytics:

**Query params:**
- `days` (default 30, max 90) - Time window for metrics

**Response structure:**
```typescript
{
  documentEffectiveness: DocumentEffectiveness[],
  candidateStats: CandidateStats,
  growthTrend: GrowthTrendPoint[]
}
```

**Query 1: Per-document effectiveness**
- JOINs kbEffectiveness → knowledgeBaseDocuments → LEFT JOIN suggestionFeedback
- Calculates:
  - `timesUsed`: Distinct suggestionIds using this doc
  - `acceptedCount`: Suggestions with action='accepted'
  - `dismissedCount`: Suggestions with action='dismissed'
  - `acceptanceRate`: (acceptedCount / timesUsed) * 100
  - `avgSimilarity`: Average similarity score
- Orders by timesUsed DESC (most-used first)
- Limits to top 50 documents

**Query 2: Candidate stats by status**
- GROUP BY status from kbCandidates
- Returns counts: pending, approved, rejected, merged
- Shows learning loop health (high pending = review bottleneck)

**Query 3: KB growth over time**
- Last 12 weeks of candidate creation activity
- DATE_TRUNC('week') for Monday-based week grouping
- Counts: created, approved, rejected per week
- Shows learning acceleration trends

**Implementation:** Uses `db.execute(sql\`...\`)` for complex aggregations with parameterized organizationId.

## Technical Implementation

### Admin Authentication
All three routes use `requireAdmin()` middleware:
- Validates session
- Returns admin object with userId and organizationId
- Returns 400 if no organizationId (shouldn't happen, defensive)

### Organization Scoping
Every query filters by admin.organizationId:
- Security: Admins can only see/modify their org's data
- Multi-tenancy: Shared database, isolated data
- Pattern: `and(eq(table.id, id), eq(table.organizationId, orgId))`

### Error Handling
Consistent pattern across all routes:
```typescript
try {
  // Route logic
} catch (error) {
  console.error('Error context:', error);
  return NextResponse.json({ error: 'User message' }, { status: 500 });
}
```

### Type Safety
- Zod validation for request bodies
- TypeScript interfaces for response shapes
- Drizzle inferred types from schema

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing kbCandidates/kbEffectiveness exports**
- **Found during:** Task 1 compilation
- **Issue:** lib/db/index.ts didn't export new tables from Phase 18-01
- **Fix:** Added kbCandidates and kbEffectiveness to imports and schema object, added type exports
- **Files modified:** apps/web-portal/lib/db/index.ts
- **Commit:** fe31b76

**2. [Rule 1 - Bug] Null coalescing for acceptanceCount merge**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** TypeScript sees integer with default() as nullable (Drizzle type inference quirk)
- **Fix:** Changed to `(targetCandidate.acceptanceCount || 0) + (candidate.acceptanceCount || 0)`
- **Files modified:** apps/web-portal/app/api/admin/kb-candidates/[id]/route.ts
- **Commit:** fe31b76

Both fixes follow established patterns in codebase (defensive null handling).

## Key Decisions Made

### 1. Raw SQL for Effectiveness Queries
**Context:** Complex JOINs with multiple aggregations needed for effectiveness metrics

**Decision:** Use `db.execute(sql\`...\`)` with parameterized queries instead of Drizzle query builder

**Why:**
- More readable: Complex aggregations easier to understand in SQL
- Performance: Database optimizer sees full query structure
- Maintainability: Future developers can read standard SQL
- Drizzle query builder would require nested subqueries and multiple passes

**Impact:** Clearer code, better query plans, easier debugging.

### 2. Quality Score Sorting as Default
**Context:** Admin review list can sort by multiple columns

**Decision:** Default to qualityScore DESC sorting

**Why:**
- Admins have limited time - want to review highest-impact candidates first
- Quality score composite metric (acceptance_count + unique_users + avg_similarity) surfaces best candidates
- Clicking through in quality order maximizes KB improvement per review session

**Impact:** Admin efficiency, better KB content curation.

### 3. 12-Week Growth Trend Window
**Context:** Growth trend chart shows KB candidate creation over time

**Decision:** Show last 12 weeks (quarter-view)

**Why:**
- Quarter-view (3 months) shows seasonal patterns
- Not too short (4 weeks = noisy) or too long (26 weeks = cluttered UI)
- Aligns with business planning cycles (quarterly reviews)
- 12 data points = readable line chart

**Impact:** Useful analytics without overwhelming chart UI.

### 4. 50-Document Limit for Effectiveness
**Context:** Per-document effectiveness could return thousands of docs

**Decision:** TOP 50 by timesUsed (most frequently used documents)

**Why:**
- Most orgs have < 50 KB docs (Phase 11 usage data)
- Long tail of rarely-used docs not actionable for admin
- 50 rows = fast query, fast render
- Admin can see which docs are actually being used vs sitting idle

**Impact:** Focused, actionable effectiveness data.

## Integration Points

### Upstream Dependencies
1. **kbCandidates table** (Phase 18-01): All candidate queries depend on this
2. **knowledgeBaseDocuments table** (Phase 11): Approve action inserts here
3. **kbEffectiveness table** (Phase 18-01): Effectiveness metrics query
4. **suggestionFeedback table** (Phase 3): JOIN for acceptance rate calculation
5. **Admin auth** (Phase 10): requireAdmin middleware

### Downstream Consumers
1. **Phase 18-05 (Admin UI):** Will fetch from these endpoints to render:
   - Candidate review queue
   - Candidate detail view
   - Review action buttons (approve/reject/merge)
   - Effectiveness dashboard charts
   - Growth trend visualization

### API Contract

**KB Candidates List Response:**
```typescript
{
  candidates: KbCandidate[],
  total: number,
  limit: number,
  offset: number
}
```

**Review Action Response:**
```typescript
// Approve
{ success: true, documentId: string }

// Reject
{ success: true }

// Merge
{ success: true }
```

**Effectiveness Response:**
```typescript
{
  documentEffectiveness: Array<{
    documentId: string,
    title: string,
    category: string | null,
    timesUsed: number,
    acceptedCount: number,
    dismissedCount: number,
    acceptanceRate: number,
    avgSimilarity: number
  }>,
  candidateStats: {
    pending: number,
    approved: number,
    rejected: number,
    merged: number
  },
  growthTrend: Array<{
    week: string,
    created: number,
    approved: number,
    rejected: number
  }>
}
```

## Testing Notes

**Manual verification completed:**
- TypeScript compiles without errors in web-portal
- All three route files created under correct paths
- Admin auth middleware imported correctly
- Database package exports available
- Zod validation schemas in place

**Future testing needs:**
- Integration test: POST /api/admin/kb-candidates/[id] with approve action
- Verify knowledgeBaseDocuments insert on approve
- Integration test: Merge action consolidates acceptance counts
- Effectiveness query returns correct aggregations
- Org scoping prevents cross-org access

**Test data needed:**
- Sample kbCandidates with different statuses
- Sample kbEffectiveness records linked to suggestionFeedback
- Multiple orgs to test isolation

## Performance Considerations

### Query Optimization

**KB Candidates List:**
- Uses `kb_candidates_quality_idx` (organizationId, qualityScore) for default sort
- Uses `kb_candidates_status_idx` (organizationId, status) for filtered lists
- COUNT query separate from SELECT to avoid full-table scan with offset

**Effectiveness Query:**
- `kb_effectiveness_doc_idx` (kbDocumentId, createdAt) speeds up per-doc aggregation
- `kb_effectiveness_org_idx` (organizationId, createdAt) for org-wide filtering
- LEFT JOIN suggestionFeedback on suggestionId (indexed)
- Limits to 50 documents (prevents large result sets)

**Growth Trend:**
- Simple GROUP BY on indexed createdAt
- 12 weeks = max ~12 rows returned
- DATE_TRUNC uses PostgreSQL built-in optimization

### Scalability

**Current design handles:**
- 1000s of candidates per org (indexed sorting)
- 100s of KB docs per org (top 50 limit)
- 10000s of effectiveness records (date filtering + indexes)

**Future optimization if needed:**
- Materialized view for effectiveness (if real-time not required)
- Candidate pagination server-side (currently loads 20 at a time)
- Growth trend caching (changes slowly, can cache for 1 hour)

## Documentation Impact

**API documentation needed:**
- Add these three endpoints to admin API docs
- Document query parameters and response schemas
- Example curl commands for testing
- Error response codes (400, 404, 500)

**Admin UI docs:**
- Phase 18-05 will document how to use review actions
- Effectiveness metrics interpretation guide

## Next Phase Readiness

### Phase 18-05 (Admin UI) is unblocked:
- ✅ List API available with pagination
- ✅ Single candidate GET for detail view
- ✅ Review actions (approve/reject/merge) available
- ✅ Effectiveness metrics for dashboard charts
- ✅ Growth trend data for visualization
- ✅ All responses typed for TypeScript UI

**Ready to build:**
- Candidate review queue table
- Candidate detail modal/page
- Review action buttons with confirmation
- Effectiveness dashboard with charts
- Growth trend line chart

## Summary

**One-liner:** Admin API for KB candidate review (approve/reject/merge) and effectiveness metrics (per-doc usage, acceptance rates, growth trends).

**What works:**
- Complete API surface for Phase 18-05 admin UI
- Approve action publishes candidates to live KB
- Effectiveness tracking shows which KB docs are valuable
- Growth trends show learning loop health
- All queries org-scoped for security

**What's next:**
- Phase 18-05: Build admin UI components consuming these APIs
- Phase 18-02: KB learner service starts populating candidates
- Phase 18-03: Effectiveness tracking integration

**Blockers:** None - all dependencies satisfied, downstream UI unblocked.
