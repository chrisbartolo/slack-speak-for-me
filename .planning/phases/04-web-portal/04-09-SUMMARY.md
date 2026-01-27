---
phase: 04
plan: 09
subsystem: web-portal
tags: [reports, settings, forms, database, drizzle]
dependency-graph:
  requires: [04-02, 04-04]
  provides: [report-settings-page, report-settings-table, report-settings-form]
  affects: [05-reports]
tech-stack:
  added: []
  patterns: [server-actions, form-validation, shadcn-form-components]
key-files:
  created:
    - packages/database/src/schema.ts (reportSettings table added)
    - apps/web-portal/lib/validations/report-settings.ts
    - apps/web-portal/app/(dashboard)/reports/actions.ts
    - apps/web-portal/app/(dashboard)/reports/page.tsx
    - apps/web-portal/components/forms/report-settings-form.tsx
    - apps/web-portal/components/ui/switch.tsx
    - apps/web-portal/components/ui/checkbox.tsx
  modified:
    - apps/web-portal/lib/db/queries.ts
    - apps/web-portal/lib/db/index.ts
    - apps/web-portal/lib/validations/style.ts
    - apps/web-portal/lib/validations/person-context.ts
    - apps/web-portal/app/(dashboard)/style/actions.ts
    - apps/web-portal/app/(dashboard)/people/actions.ts
decisions:
  - id: 04-09-01
    title: Explicit interface types for Zod schemas with refine()
    choice: Use explicit interface types instead of z.infer when schemas use refine()
    rationale: Zod refine() causes type inference to become 'unknown', breaking FormData operations
metrics:
  duration: 8 min
  completed: 2026-01-27
---

# Phase 04 Plan 09: Weekly Reports Settings Page Summary

Report settings page with schedule, format, and delivery configuration for weekly reports.

## What Was Built

### 1. Database Schema (Task 1)
Added `reportSettings` table to store user report preferences:
- Schedule settings: enabled, dayOfWeek, timeOfDay, timezone
- Format settings: format (concise/detailed), sections (jsonb array)
- Delivery settings: autoSend, recipientChannelId
- Unique constraint on (workspaceId, userId)

### 2. Server Actions and Queries (Task 2)
- `reportSettingsSchema` - Zod validation for report settings form
- `getReportSettings()` - Cached query to fetch user's report settings
- `saveReportSettings()` - Server action with upsert pattern for saving

### 3. Report Settings Form and Page (Task 3)
- `ReportSettingsForm` component with:
  - Enable/disable toggle for scheduled reports
  - Day, time, and timezone selectors (disabled when reports disabled)
  - Format selector (concise vs detailed)
  - Section checkboxes (achievements, focus, blockers, shoutouts)
  - Auto-send toggle for draft vs automatic delivery
- Reports page at `/reports` with:
  - Page header and description
  - Report settings form
  - "How reports work" explainer card

### UI Components Added
- Switch component (shadcn/ui)
- Checkbox component (shadcn/ui)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d198cbf | feat | Add reportSettings table to database schema |
| d53f95c | feat | Add server actions and queries for report settings |
| 20ec2b5 | feat | Add report settings form and page |
| 4724afe | fix | Fix TypeScript type inference issues in validation schemas |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod refine() type inference issues**
- **Found during:** Task 3 build verification
- **Issue:** Zod schemas using `refine()` at the top level cause type inference to become `unknown`, breaking FormData.set() calls
- **Fix:** Restructured schemas to place refine() after base string transformations, added explicit interface types
- **Files modified:**
  - apps/web-portal/lib/validations/style.ts
  - apps/web-portal/lib/validations/person-context.ts
- **Commit:** 4724afe

**2. [Rule 1 - Bug] Fixed db/schema type inference across action files**
- **Found during:** Task 3 build verification
- **Issue:** Using `db` from `@/lib/db` and schema tables from `@slack-speak/database` caused type mismatch in insert operations
- **Fix:** Updated action files to use consistent `db, schema` pattern from `@/lib/db`
- **Files modified:**
  - apps/web-portal/app/(dashboard)/reports/actions.ts
  - apps/web-portal/lib/db/index.ts (added reportSettings to schema export)
  - apps/web-portal/lib/db/queries.ts
- **Commit:** 4724afe

## Technical Notes

### Form Pattern Used
The report settings form follows the same pattern as style-preferences-form:
- React Hook Form with Zod resolver
- FormData serialization for server action
- Toast notifications via Sonner
- useTransition for pending state

### Database Migration
Schema pushed via `npm run db:push --workspace=@slack-speak/database`

### Type Safety Pattern
Due to Drizzle ORM type inference limitations when schemas are re-exported, action files now use:
```typescript
import { db, schema } from '@/lib/db';
const { reportSettings } = schema;
```

## Next Phase Readiness

This plan prepares for Phase 5 report generation:
- Report settings stored in database
- Schedule configuration ready (day, time, timezone)
- Format and sections preferences captured
- Auto-send vs draft delivery mode stored

Phase 5 will implement:
- Scheduled job to generate reports based on settings
- Team update submission workflow
- AI aggregation and summarization
- Report delivery via Slack
