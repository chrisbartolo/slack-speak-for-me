---
phase: 06-production-polish-and-admin
plan: 03
subsystem: feedback-tracking
tags: [database, drizzle, feedback, analytics]

dependency-graph:
  requires: ["06-02"]
  provides: ["suggestionFeedback schema", "feedback-tracker service", "web portal feedback queries"]
  affects: ["06-04", "06-05"]

tech-stack:
  added: []
  patterns:
    - "Upsert with onConflictDoUpdate for idempotent tracking"
    - "Non-throwing error handling for non-critical operations"
    - "Unique index on composite key (suggestionId + action)"

file-tracking:
  key-files:
    created:
      - apps/slack-backend/src/services/feedback-tracker.ts
    modified:
      - packages/database/src/schema.ts
      - apps/slack-backend/src/services/index.ts
      - apps/web-portal/lib/db/index.ts
      - apps/web-portal/lib/db/queries.ts

decisions:
  - id: "06-03-01"
    decision: "Unique index on suggestionId + action combo"
    reason: "Prevents duplicate entries while allowing multiple action types per suggestion"
  - id: "06-03-02"
    decision: "Non-throwing trackFeedback function"
    reason: "Feedback tracking is non-critical - failures should not break main user flows"
  - id: "06-03-03"
    decision: "finalText stored even for accepted suggestions"
    reason: "Enables consistent data model and potential future analytics on text changes"

metrics:
  duration: "2m 46s"
  completed: "2026-02-01"
---

# Phase 06 Plan 03: Suggestion Feedback Tracking Summary

**One-liner:** Database schema and service for tracking accepted, refined, dismissed suggestion actions

## What Was Built

### 1. suggestionFeedback Table (packages/database/src/schema.ts)

New database table to track all user interactions with AI suggestions:

```typescript
export const suggestionFeedback = pgTable('suggestion_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  suggestionId: text('suggestion_id').notNull(),
  action: text('action').notNull(), // 'accepted' | 'refined' | 'dismissed' | 'sent'
  originalText: text('original_text'),
  finalText: text('final_text'),
  triggerContext: text('trigger_context'),
  channelId: text('channel_id'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  workspaceUserIdx: index(...).on(table.workspaceId, table.userId),
  createdAtIdx: index(...).on(table.createdAt),
  actionIdx: index(...).on(table.action),
  suggestionIdx: uniqueIndex(...).on(table.suggestionId, table.action),
}));
```

### 2. Feedback Tracker Service (apps/slack-backend/src/services/feedback-tracker.ts)

Service with specialized tracking functions:

- **trackFeedback**: Core upsert function with conflict handling
- **trackAcceptance**: When user copies suggestion without changes
- **trackRefinement**: When user modifies then accepts
- **trackDismissal**: When user dismisses suggestion

All functions are non-throwing to avoid breaking main user flows.

### 3. Web Portal Queries (apps/web-portal/lib/db/queries.ts)

- **getSuggestionFeedback**: Fetch feedback history with action type
- **getSuggestionFeedbackStats**: Aggregate counts by action type for analytics

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Unique index on suggestionId + action | Allows multiple action types per suggestion while preventing duplicates |
| onConflictDoUpdate for upserts | Idempotent tracking - retries are safe |
| Non-throwing error handling | Feedback tracking is analytics, not core functionality |
| finalText for all actions | Consistent data model enables future text analytics |

## Commits

| Hash | Message |
|------|---------|
| 132e07e | feat(06-03): add suggestionFeedback table to schema |
| c055f41 | feat(06-03): create feedback-tracker service |
| f1785b0 | feat(06-03): add suggestion feedback queries for web portal |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- Database migration applied successfully
- Backend build: PASS
- Web portal build: PASS
- All TypeScript types valid

## Next Phase Readiness

**Ready for 06-04:** The feedback tracking infrastructure is complete. The next plan can:
- Wire up the tracking calls to actual Slack button handlers
- Display feedback stats in the web portal AI Learning tab
