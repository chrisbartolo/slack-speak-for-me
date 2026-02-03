---
phase: 13-team-org-dashboard
plan: 06
subsystem: admin-dashboard
tags: [guardrails, content-policy, compliance, admin, typescript, nextjs, tremor]
dependencies:
  requires: [13-01-database-schema, plan-features]
  provides: [guardrails-service, content-filtering, violation-tracking]
  affects: [ai-suggestion-generation]
tech-stack:
  added: [@radix-ui/react-tabs, tremor-charts]
  patterns: [word-boundary-regex, client-server-separation, plan-gated-features]
key-files:
  created:
    - apps/web-portal/lib/admin/guardrails.ts
    - apps/web-portal/app/api/admin/guardrails/route.ts
    - apps/web-portal/app/api/admin/guardrails/violations/route.ts
    - apps/web-portal/app/admin/guardrails/page.tsx
    - apps/web-portal/app/admin/guardrails/guardrails-config.tsx
    - apps/web-portal/app/admin/guardrails/violations-report.tsx
    - apps/web-portal/components/ui/tabs.tsx
  modified:
    - apps/web-portal/components/dashboard/sidebar.tsx
decisions:
  - title: "Word Boundary Matching for Keywords"
    rationale: "Use regex `\\b${keyword}\\b` for precise matching without false positives"
    alternatives: ["Simple string.includes()", "Full NLP parsing"]
    chosen: "Word boundary regex - balanced precision and performance"
  - title: "3 Trigger Modes"
    rationale: "Provide flexibility from strictest (hard block) to least strict (soft warning)"
    modes: ["hard_block: suppress entirely", "regenerate: AI retries without violation", "soft_warning: deliver with flag"]
  - title: "Predefined Categories"
    rationale: "7 common risk categories covering legal, financial, medical, HR, confidential"
    categories: ["legal_advice", "pricing_commitments", "competitor_bashing", "medical_advice", "financial_advice", "hr_decisions", "nda_confidential"]
metrics:
  duration: 308s
  tasks: 2
  files: 8
  commits: 2
completed: 2026-02-03
---

# Phase 13 Plan 06: Content Guardrails Summary

**One-liner:** Predefined category and custom keyword guardrails with violation logging, trigger modes (hard block/regenerate/warning), and Tremor-powered analytics dashboard.

## What Was Built

Content guardrails system that enables admins to define prohibited content types and track violations.

### Core Service (`lib/admin/guardrails.ts`)

**PREDEFINED_CATEGORIES (7 categories):**
- Legal Advice: "hereby", "pursuant", "legally binding", "sue", etc.
- Pricing Commitments: "guarantee price", "lock in rate", "special discount"
- Competitor Mentions: "better than", "unlike", "competitor fails"
- Medical Advice: "diagnose", "prescribe", "treatment plan"
- Financial Advice: "invest in", "financial advice", "guaranteed returns"
- HR Decisions: "you are fired", "terminated", "promote you"
- Confidential Information: "confidential", "proprietary", "trade secret"

**checkGuardrails(text, config):**
- Word boundary regex matching: `\\b${keyword}\\b` prevents false positives
- Checks custom keywords first, then enabled category keywords
- Returns ALL violations found (not just first)
- Case-insensitive matching

**Violation Logging:**
- logViolation(): Records to guardrailViolations table
- Tracks: organizationId, workspaceId, userId, violationType, violatedRule, action
- suggestionText included for audit (plan-gated visibility)

**Statistics:**
- getViolationStats(orgId, days): Aggregate violations by type, rule, action
- Daily trend data for charts
- Most triggered rule and most common action
- Recent violations list (last 50)

### API Routes

**GET /api/admin/guardrails:**
- Returns current config + predefined categories
- requireAdmin auth

**PUT /api/admin/guardrails:**
- Validates categories against PREDEFINED_CATEGORIES ids
- Validates keyword count against plan limit (getPlanFeatures)
- Validates keyword length (max 100 chars each)
- Validates triggerMode enum
- requireAdmin auth

**GET /api/admin/guardrails/violations:**
- Query param: ?days=30 (default)
- Returns violation stats for period
- requireAdmin auth

### Admin Dashboard

**Configuration Tab:**
1. **Trigger Mode Selector (3 radio cards):**
   - Hard Block: Suppress suggestion entirely, show warning to user (Strictest)
   - Warning + Regenerate: AI regenerates without prohibited content (Balanced)
   - Soft Warning: Deliver suggestion with visible warning flag (Least strict)

2. **Predefined Categories Grid:**
   - 2 columns on desktop, 1 on mobile
   - Toggle switch for each category
   - Shows "Default" badge for default-enabled categories
   - Displays category description and keyword examples
   - Blue border when enabled

3. **Custom Keywords Section:**
   - Input + "Add" button for new keywords
   - Removable badge chips for each keyword
   - Counter: "X/Y keywords used" from plan limits
   - Disabled when at limit with upgrade prompt
   - Enter key adds keyword

4. **Save Configuration Button:**
   - Saves to API with toast feedback
   - Refreshes page on success

**Violations Report Tab:**
1. **Summary Stats Cards (3):**
   - Total Violations (amber)
   - Most Triggered Rule (blue)
   - Most Common Action (purple)

2. **Charts (Tremor):**
   - Top Triggered Rules: BarList (top 10)
   - Violations by Type: DonutChart (category vs keyword)
   - Actions Taken: DonutChart (blocked/regenerated/warned)
   - Daily Trend: Custom bar visualization (last 7 days)

3. **Recent Violations Table:**
   - Columns: Date, User, Type, Rule, Action
   - Last 50 entries
   - Badge colors: destructive (blocked), default (warned), secondary (regenerated)

4. **Period Selector:**
   - Buttons: 7 days | 30 days | 90 days
   - Live reload from API on change

### Navigation

**Sidebar Update:**
- Added "Guardrails" to admin NavGroup as LAST item
- Position: after Coupons (for super admins)
- Visible only to admins

## Plan Gating

**maxBlockedKeywords:**
- Free: 0 (no custom keywords)
- Starter: 10
- Pro: 50
- Team: 100
- Business: 500

**aiCategoryDetection:**
- Pro+: true (enables AI-powered category detection beyond keyword matching)
- Starter/Free: false (keyword matching only)

## Technical Decisions

### Word Boundary Matching
Used regex `\\b${keyword}\\b` instead of simple `includes()`:
- Prevents false positives (e.g., "sue" won't match "issue")
- Case-insensitive with 'gi' flags
- Escapes special regex characters in keywords

### All Violations Returned
checkGuardrails() returns array of ALL violations, not just first:
- Enables comprehensive reporting
- Admin sees full scope of issues
- Can track multiple rule triggers per suggestion

### Sensible Defaults
New orgs get 3 categories enabled by default:
- legal_advice
- pricing_commitments
- competitor_bashing

Covers most common risk areas without being overly restrictive.

### Trigger Mode Flexibility
3 modes provide balance between safety and UX:
- Hard Block: Maximum safety (compliance-critical orgs)
- Regenerate: Balanced (most orgs)
- Soft Warning: Minimal friction (mature teams with trust)

## UI Components

**New Components:**
- `components/ui/tabs.tsx`: Radix UI tabs primitive (shadcn pattern)

**Tremor Charts:**
- BarList: Top 10 triggered rules
- DonutChart: Type and action distribution

**Existing Components:**
- Card, Button, Badge, Switch, Input from shadcn/ui
- toast from sonner

## Integration Points

**plan-features.ts:**
- maxBlockedKeywords enforcement
- aiCategoryDetection flag (for future AI enhancement)

**Database Schema:**
- guardrailConfig table (org-level config)
- guardrailViolations table (tracking log)

**Future Integration:**
AI suggestion generation will call:
```typescript
const result = checkGuardrails(suggestionText, config);
if (result.violated) {
  switch (config.triggerMode) {
    case 'hard_block': // Suppress, log, warn user
    case 'regenerate': // Regenerate with violation context
    case 'soft_warning': // Deliver with warning flag
  }
  logViolation(...);
}
```

## Testing Considerations

**Unit Tests Needed:**
- checkGuardrails() with various keywords/categories
- Word boundary matching edge cases
- Plan limit validation in upsertGuardrailConfig()
- Stats aggregation logic

**Integration Tests:**
- API route auth (requireAdmin)
- Config CRUD operations
- Violation logging and retrieval
- Period filtering in stats

**E2E Tests:**
- Admin enables categories, sees immediate effect
- Add custom keyword, save, reload shows persisted
- Violation stats update after triggering guardrail
- Period selector changes data correctly

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Phase 13 Wave 2 Progress:**
- ✅ 13-02: Analytics (complete)
- ✅ 13-03: Org Style Settings (complete)
- ✅ 13-04: Templates (complete)
- ✅ 13-05: Audit Trail (complete)
- ✅ 13-06: Guardrails (complete)

**Wave 2 Complete!** All admin dashboard features delivered.

**Blockers:** None

**Recommendations:**
1. Integrate checkGuardrails() into AI suggestion pipeline (slack-backend)
2. Add real-time violation alerts for high-severity triggers
3. Consider AI-powered category detection (beyond keyword matching) for Pro+ plans
4. Add guardrail templates (industry-specific presets: healthcare, finance, legal)

## Success Criteria Met

✅ Admin can toggle predefined categories on/off
✅ Admin can add/remove custom keywords (within plan limit)
✅ Admin can select trigger mode (hard block/regenerate/soft warning)
✅ Sensible defaults active for new orgs (3 categories enabled)
✅ Violations report shows frequency, trends, top rules
✅ Configuration persists across page reloads
✅ Guardrails link in admin sidebar

## Files Modified

**Created (7):**
- `apps/web-portal/lib/admin/guardrails.ts` (328 lines): Service with PREDEFINED_CATEGORIES, checkGuardrails, logViolation, getViolationStats
- `apps/web-portal/app/api/admin/guardrails/route.ts` (90 lines): GET/PUT config API
- `apps/web-portal/app/api/admin/guardrails/violations/route.ts` (42 lines): GET violations stats API
- `apps/web-portal/app/admin/guardrails/page.tsx` (48 lines): Server component page
- `apps/web-portal/app/admin/guardrails/guardrails-config.tsx` (302 lines): Configuration client component
- `apps/web-portal/app/admin/guardrails/violations-report.tsx` (257 lines): Violations report client component
- `apps/web-portal/components/ui/tabs.tsx` (61 lines): Radix UI tabs primitive

**Modified (1):**
- `apps/web-portal/components/dashboard/sidebar.tsx`: Added Guardrails nav link

## Commits

1. **aecc9be**: feat(13-06): create guardrails service with checking logic and APIs
   - PREDEFINED_CATEGORIES with 7 categories
   - checkGuardrails() with word boundary matching
   - logViolation() and getViolationStats()
   - GET/PUT /api/admin/guardrails
   - GET /api/admin/guardrails/violations
   - Plan limit validation

2. **84097b0**: feat(13-06): build guardrails admin page with categories and violations report
   - Tabs component from shadcn/ui
   - Configuration tab with trigger mode, categories, keywords
   - Violations Report tab with Tremor charts
   - Period selector with live reload
   - Sidebar navigation link
