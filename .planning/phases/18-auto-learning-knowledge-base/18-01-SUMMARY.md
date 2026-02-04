---
phase: 18-auto-learning-knowledge-base
plan: 01
subsystem: database-schema
tags: [database, drizzle, schema, kb-candidates, kb-effectiveness, auto-learning]

requires:
  - 17-05: Communication insights tables (topicClassifications, communicationTrends)
  - knowledge_base_documents: Base KB table for RAG

provides:
  - kbCandidates table: Auto-learned knowledge patterns pending admin review
  - kbEffectiveness table: KB document usage tracking for impact measurement

affects:
  - 18-02: Candidate extraction service (will write to kbCandidates)
  - 18-03: Admin review UI (will read from kbCandidates)
  - 18-04: Effectiveness tracking (will write to kbEffectiveness)

tech-stack:
  added: []
  patterns:
    - "Denormalized organizationId pattern for fast org-wide queries"
    - "Non-foreign-key suggestionId pattern (same as suggestionMetrics, topicClassifications)"
    - "Status workflow pattern (pending -> approved/rejected/merged)"
    - "Quality scoring with multiple metrics (acceptance_count, unique_users, avg_similarity)"

key-files:
  created: []
  modified:
    - packages/database/src/schema.ts: "Added kbCandidates and kbEffectiveness tables"

decisions:
  - decision: "kbCandidates tracks status workflow (pending/approved/rejected/merged)"
    rationale: "Admin review workflow needs state machine for candidate lifecycle"
    alternatives: ["Single approved/rejected boolean", "Separate tables per state"]
    phase: 18
    plan: 01
  - decision: "Quality scoring with acceptance_count, unique_users_count, avg_similarity"
    rationale: "Multiple quality signals help admins prioritize high-value candidates"
    alternatives: ["Single composite score only", "Let admins manually sort"]
    phase: 18
    plan: 01
  - decision: "kbEffectiveness uses non-FK suggestionId (like suggestionMetrics)"
    rationale: "Follows established pattern, avoids table coupling, survives suggestion cleanup"
    alternatives: ["Foreign key to suggestionFeedback", "Embed in suggestionMetrics"]
    phase: 18
    plan: 01
  - decision: "Denormalized organizationId in kbEffectiveness"
    rationale: "Fast org-wide effectiveness queries without JOIN through knowledgeBaseDocuments"
    alternatives: ["Join through kbDocumentId", "Materialized view"]
    phase: 18
    plan: 01

metrics:
  tasks: 2
  commits: 2
  files_modified: 1
  duration: "1.7 minutes"
  completed: 2026-02-04
---

# Phase 18 Plan 01: Auto-Learning KB Schema Summary

Database schema foundation for KB auto-learning and effectiveness tracking via kbCandidates and kbEffectiveness tables.

## Objective

Add database schema for KB candidates (auto-learned knowledge) and KB effectiveness tracking tables.

**Purpose:** Foundation tables that all other Phase 18 plans depend on. KB candidates store auto-extracted knowledge patterns pending admin review. KB effectiveness links KB document usage to suggestion outcomes for impact measurement.

**Output:** Two new tables in schema.ts with indexes, type exports, and drizzle push applied.

## What Was Built

### kbCandidates Table
Complete lifecycle tracking for auto-learned knowledge patterns:

**Core fields:**
- `title`, `content`, `category`, `tags`: Pattern description and organization
- `embedding`: Vector for similarity search (matches knowledgeBaseDocuments pattern)
- `reasoning`: Claude's explanation for why this is reusable
- `source_suggestion_id`: First suggestion that triggered this candidate

**Quality metrics:**
- `acceptance_count`: How many times similar patterns were accepted
- `unique_users_count`: How many distinct users accepted similar patterns
- `avg_similarity`: Average similarity score 0-100 with existing KB docs
- `quality_score`: Composite score 0-100 for admin prioritization

**Workflow management:**
- `status`: 'pending' | 'approved' | 'rejected' | 'merged'
- `reviewed_by`, `reviewed_at`: Admin review tracking
- `rejection_reason`: Why rejected (for learning)
- `published_document_id`: Link to KB doc if approved
- `merged_into_id`: Self-reference for duplicate merging
- `last_seen_at`: Last time similar pattern was accepted

**Indexes:**
- `kb_candidates_org_idx`: Organization filtering
- `kb_candidates_status_idx`: Status-based queries (org + status)
- `kb_candidates_quality_idx`: Admin review list sorting (org + quality_score)

### kbEffectiveness Table
Links KB document usage to suggestion outcomes for impact measurement:

**Core fields:**
- `suggestion_id`: Links to suggestion (NOT a foreign key, same pattern as suggestionMetrics)
- `kb_document_id`: Which KB doc was used (foreign key to knowledgeBaseDocuments)
- `organization_id`: Denormalized for fast org-wide queries
- `similarity`: 0-100 score of KB doc relevance to query
- `created_at`: When this KB doc was used

**Indexes:**
- `kb_effectiveness_suggestion_idx`: Per-suggestion queries
- `kb_effectiveness_doc_idx`: Per-document effectiveness analysis (doc + time)
- `kb_effectiveness_org_idx`: Org-wide effectiveness queries (org + time)

**Usage pattern:**
- Written when AI service uses KB docs during suggestion generation
- Joined with suggestionFeedback to measure KB doc impact (acceptance rate)
- Aggregated to show which KB docs are most/least effective

## Technical Implementation

**Schema patterns followed:**
1. **UUID primary keys with defaultRandom()** - Consistent with all tables
2. **Snake_case column names** - PostgreSQL convention
3. **JSONB for arrays** - `tags.$type<string[]>()`
4. **Integer for scores** - 0-100 scale stored as integer
5. **Nullable timestamps** - Workflow timestamps filled incrementally
6. **Index naming** - `{table}_{columns}_idx` convention

**Type exports:**
- `KbCandidate` / `NewKbCandidate` - Full select/insert types via `$inferSelect`/`$inferInsert`
- `KbEffectiveness` / `NewKbEffectiveness` - Same pattern

**Database push:**
- Ran `npm run db:push -w packages/database`
- Successfully applied schema changes to database
- No migrations needed (using drizzle-kit push for dev)

## Deviations from Plan

None - plan executed exactly as written. All columns, indexes, and type exports implemented as specified.

## Key Decisions Made

### 1. Status Workflow (pending/approved/rejected/merged)
**Context:** Need state machine for admin review process

**Decision:** Four-state workflow with status field

**Why:** Matches real admin workflow - candidates are pending until reviewed, then approved (→ KB doc), rejected (→ archive), or merged (→ another candidate). Separate "merged" state prevents confusion with "approved" which publishes to KB.

**Impact:** Clean admin UI filtering (show pending, show rejected for learning), clear lifecycle tracking.

### 2. Multiple Quality Signals
**Context:** How should admins prioritize which candidates to review first?

**Decision:** Three separate metrics (acceptance_count, unique_users_count, avg_similarity) plus composite quality_score

**Why:** Different quality signals matter in different contexts:
- `acceptance_count`: High volume = widely applicable
- `unique_users_count`: Many users = not user-specific
- `avg_similarity`: Low similarity = novel knowledge vs duplicate

Admin can sort by individual metrics OR use quality_score composite.

**Impact:** Flexible prioritization in admin UI, richer quality data for future ML models.

### 3. Non-FK suggestionId Pattern
**Context:** Should kbEffectiveness use a foreign key to suggestionFeedback?

**Decision:** Text field with no foreign key constraint (same as suggestionMetrics, topicClassifications)

**Why:** Established pattern in codebase - survives suggestion cleanup, avoids table coupling, allows eventual suggestion data archival without breaking KB effectiveness history.

**Impact:** Consistent with existing patterns, prevents cascading deletes, enables long-term effectiveness tracking.

### 4. Denormalized organizationId
**Context:** kbEffectiveness needs org filtering for analytics

**Decision:** Store organizationId directly (not just via knowledgeBaseDocuments relation)

**Why:** Same pattern as suggestionMetrics - enables fast org-wide queries without JOIN. Analytics queries like "org effectiveness over time" are frequent and should be fast.

**Impact:** Slight data duplication (organizationId in both kbEffectiveness and knowledgeBaseDocuments), major query performance gain for org-level analytics.

## Integration Points

### Upstream Dependencies
1. **knowledgeBaseDocuments table** (Phase 11): Foreign key for kbEffectiveness.kbDocumentId
2. **organizations table** (Phase 10): Foreign key for kbCandidates.organizationId
3. **suggestionFeedback** (Phase 3): Not a FK, but effectiveness analysis joins on suggestionId

### Downstream Consumers
1. **Phase 18-02 (Candidate Extraction):** Will write to kbCandidates when detecting reusable patterns
2. **Phase 18-03 (Admin Review UI):** Will read from kbCandidates for review queue
3. **Phase 18-04 (Effectiveness Tracking):** Will write to kbEffectiveness when using KB docs
4. **Phase 18-05 (Analytics):** Will JOIN both tables for impact measurement

## Testing Notes

**Manual verification:**
- TypeScript compiles without errors (`npx tsc --noEmit`)
- Both tables exported from schema.ts
- Type exports available: `KbCandidate`, `NewKbCandidate`, `KbEffectiveness`, `NewKbEffectiveness`
- Schema pushed successfully to database

**Future testing needs:**
- Insert test data to verify constraints
- Test self-reference on kbCandidates.merged_into_id
- Test foreign key on publishedDocumentId
- Verify index performance on quality_score sorting

## Performance Considerations

**kbCandidates indexes:**
- `kb_candidates_quality_idx`: Composite (organizationId, qualityScore) supports admin review list sorted by quality
- `kb_candidates_status_idx`: Composite (organizationId, status) supports filtering pending/rejected/merged

**kbEffectiveness indexes:**
- `kb_effectiveness_doc_idx`: Composite (kbDocumentId, createdAt) supports per-doc time-series effectiveness queries
- `kb_effectiveness_org_idx`: Composite (organizationId, createdAt) supports org-wide time-series analytics

**Future optimization needs:**
- If kbCandidates grows large, consider partitioning by status (archive old rejected/merged)
- If kbEffectiveness grows large, consider time-based partitioning (monthly/quarterly)

## Documentation Impact

**Schema documentation:**
- Added inline comments for all nullable fields
- Type exports follow existing patterns
- Index naming follows conventions

**No external docs updated** - This is foundation schema, user-facing docs come with Phase 18-03 admin UI.

## Next Phase Readiness

### Phase 18-02 (Candidate Extraction) is unblocked:
- ✅ kbCandidates table exists
- ✅ Type exports available for TypeScript service
- ✅ All required columns present (content, embedding, reasoning, quality metrics)
- ✅ Indexes support duplicate detection queries (org + embedding similarity)

### Phase 18-03 (Admin Review UI) is unblocked:
- ✅ kbCandidates table exists
- ✅ Status workflow columns present (status, reviewed_by, reviewed_at, rejection_reason)
- ✅ Quality sorting index present (kb_candidates_quality_idx)
- ✅ publishedDocumentId and mergedIntoId support approval/merge actions

### Phase 18-04 (Effectiveness Tracking) is unblocked:
- ✅ kbEffectiveness table exists
- ✅ Type exports available
- ✅ All linking fields present (suggestionId, kbDocumentId, organizationId)
- ✅ Similarity field supports relevance tracking

## Summary

**One-liner:** Foundation schema for auto-learning KB with candidate workflow and effectiveness tracking via two new tables.

**What works:**
- Clean status workflow for admin review
- Multi-dimensional quality scoring for prioritization
- Denormalized org fields for fast analytics
- Consistent with existing codebase patterns

**What's next:**
- Phase 18-02: Build candidate extraction service
- Phase 18-03: Build admin review UI
- Phase 18-04: Build effectiveness tracking service
- Phase 18-05: Build analytics queries

**Blockers:** None - all dependencies satisfied, downstream plans unblocked.
