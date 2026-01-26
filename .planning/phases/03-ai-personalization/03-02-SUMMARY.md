---
phase: 03-ai-personalization
plan: 02
subsystem: personalization
tags: [preferences, validation, zod, database, crud]

requires:
  phases: [02-core-slack]
  patterns: [database-schema, service-layer]

provides:
  services: [preferencesStore]
  validation: [StylePreferencesSchema]
  types: [StylePreferences, StylePreferencesInput, ToneOption, FormalityOption]

affects:
  future_plans: [03-03, 03-04, 03-05]
  integration_points: [ai-service, dashboard]

tech-stack:
  added:
    - zod: "Validation schemas for preference input"
  patterns:
    - injection-protection: "Regex-based detection of prompt injection patterns in user input"
    - type-assertions: "Cast database string types to TypeScript enums"
    - upsert-pattern: "Check-then-insert-or-update for idempotent operations"

key-files:
  created:
    - packages/validation/src/style-preferences.ts: "Zod schemas with injection protection"
    - apps/slack-backend/src/services/personalization/preferencesStore.ts: "CRUD operations for user preferences"
    - apps/slack-backend/src/services/personalization/index.ts: "Personalization service exports"
  modified:
    - packages/validation/src/index.ts: "Added style preferences exports"
    - apps/slack-backend/src/services/index.ts: "Added personalization service exports"
    - packages/database/src/schema.ts: "Added userStylePreferences table (dependency fix)"

decisions:
  - title: "Injection protection on preference fields"
    rationale: "User-provided phrases and custom guidance go into AI prompts - must block spotlighting markers and system tags"
    alternatives: ["Server-side sanitization only", "No validation (trust AI filtering)"]

  - title: "Phrase limit of 20 items, 100 chars each"
    rationale: "Prevents prompt bloat while allowing sufficient personalization"
    alternatives: ["Unlimited phrases", "Single text field"]

  - title: "Custom guidance limit of 500 chars"
    rationale: "Balances user expressiveness with prompt token budget"
    alternatives: ["No limit", "200 char limit"]

  - title: "Enum validation for tone and formality"
    rationale: "Controlled vocabulary ensures consistent AI behavior and prevents injection via free-text tone"
    alternatives: ["Free-text tone/formality", "Single combined 'style' field"]

metrics:
  duration: 3
  completed: 2026-01-26
---

# Phase 03 Plan 02: Style Preferences Service Summary

**One-liner:** Zod-validated CRUD service for user style preferences with injection protection on phrases and custom guidance fields.

## What Was Built

### Validation Layer (packages/validation)
- **StylePreferencesSchema**: Full schema with IDs and timestamps
- **StylePreferencesInputSchema**: User input validation
- **Enums**: ToneEnum (6 options), FormalityEnum (3 options), RefinementTypeEnum (4 types)
- **Injection Protection**: Regex patterns detect spotlighting markers, system tags, instruction markers
- **Length Limits**:
  - Phrases: Max 100 chars each, max 20 per array
  - Custom guidance: Max 500 chars
  - Prevents prompt bloat and token budget overflow

### Service Layer (apps/slack-backend)
- **getStylePreferences(workspaceId, userId)**: Fetch user preferences or null
- **upsertStylePreferences(workspaceId, userId, input)**: Create or update with validation
- **deleteStylePreferences(workspaceId, userId)**: Remove preferences
- All functions properly type database string fields to TypeScript enums

### Database (packages/database)
- **userStylePreferences table**: Added to schema with proper indexes
- Unique constraint on (workspaceId, userId) prevents duplicates
- JSONB arrays for preferredPhrases and avoidPhrases
- Text fields for tone, formality, customGuidance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added userStylePreferences table to schema**
- **Found during:** Task 1 - Starting validation schema creation
- **Issue:** Plan 03-02 depends on plan 03-01 (database schema), but 03-01 hadn't been executed. The userStylePreferences table didn't exist in schema.ts.
- **Fix:** Added the missing table definition directly to schema.ts to unblock Task 1 work. Table includes all columns specified in 03-01 plan.
- **Files modified:** packages/database/src/schema.ts
- **Commit:** f05b93d (included in Task 1 commit)
- **Rationale:** Cannot build validation schemas without the database types being available. This is a critical dependency.

## Integration Points

### Inbound Dependencies
- `@slack-speak/database`: Database client and userStylePreferences table schema
- `drizzle-orm`: Query builder for database operations
- `zod`: Runtime validation

### Outbound Consumers (Future)
- **AI Service** (Plan 03-05): Will fetch preferences to customize prompt generation
- **Dashboard** (Phase 04): UI for users to set preferences
- **Refinement Service** (Plan 03-04): May update preferences based on feedback patterns

## Verification Results

All verification checks passed:

1. ✅ `npm run build -w packages/validation` succeeds
2. ✅ `npx tsc --noEmit -p apps/slack-backend/tsconfig.json` succeeds (0 non-test errors)
3. ✅ StylePreferencesSchema enforces tone/formality enums
4. ✅ Injection protection blocks data markers in phrases
5. ✅ Phrase length and count limits enforced
6. ✅ Exports accessible from service index

## Next Phase Readiness

**Blockers:** None

**Recommendations for next plans:**
1. **Plan 03-03** can now use `getStylePreferences()` to fetch user preferences
2. **Plan 03-04** should track which preferences are actually used vs ignored
3. **Plan 03-05** must integrate preferences as highest-priority style source
4. Consider adding preference versioning if we need to track changes over time

**Database migrations:**
- The userStylePreferences table needs migration 0003_personalization_tables.sql from plan 03-01
- Migration should be run before deploying this service to production

## Artifacts

**Commits:**
- `f05b93d` - feat(03-02): add Zod validation schemas for style preferences
- `db257a4` - feat(03-02): create preferences store service
- `53b1420` - feat(03-02): export personalization services from main index

**Key exports:**
```typescript
// From @slack-speak/validation
import {
  StylePreferencesSchema,
  StylePreferencesInputSchema,
  ToneEnum,
  FormalityEnum,
  type StylePreferences,
  type StylePreferencesInput,
  type ToneOption,
  type FormalityOption
} from '@slack-speak/validation';

// From apps/slack-backend/src/services
import {
  getStylePreferences,
  upsertStylePreferences,
  deleteStylePreferences
} from './services';
```

**Usage example:**
```typescript
// Save user preferences
const prefs = await upsertStylePreferences(
  workspaceId,
  userId,
  {
    tone: 'professional',
    formality: 'balanced',
    preferredPhrases: ['I appreciate', 'Thank you for'],
    avoidPhrases: ['Hey', 'No problem'],
    customGuidance: 'Use active voice and be concise'
  }
);

// Retrieve preferences
const existing = await getStylePreferences(workspaceId, userId);
if (existing) {
  console.log('User prefers tone:', existing.tone);
}
```
