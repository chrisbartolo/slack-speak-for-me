---
phase: 11-individual-billing
plan: 04
subsystem: ui
tags: [react, pricing, billing, toggle]

# Dependency graph
requires:
  - phase: 11-02
    provides: Individual checkout flow
provides:
  - Billing mode toggle on pricing page
  - Individual plans with /month pricing
  - Team plans with /seat/month pricing
  - Mode-aware CTA links
affects: [checkout-flow, signup-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [billing-mode-toggle, mode-aware-pricing]

key-files:
  created: []
  modified:
    - apps/web-portal/components/pricing/pricing-table.tsx
    - apps/web-portal/app/pricing/page.tsx

key-decisions:
  - "BillingModeToggle uses 'For Myself' / 'For My Team' labels"
  - "Individual mode shows /month, Team mode shows /seat/month"
  - "Plan IDs: starter, pro, team-starter, team-pro"
  - "Mode passed to login via query parameter"

patterns-established:
  - "BillingMode type: 'individual' | 'team' for consistent mode handling"
  - "Plan arrays separated by mode for easy maintenance"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 11 Plan 04: Pricing Page Billing Mode Toggle Summary

**Pricing page toggle between Individual (/month) and Team (/seat/month) billing with mode-aware CTAs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T13:18:20Z
- **Completed:** 2026-02-02T13:21:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- BillingModeToggle component with "For Myself" / "For My Team" tabs
- INDIVIDUAL_PLANS array: Starter ($10/month), Pro ($15/month)
- TEAM_PLANS array: Team Starter ($10/seat/month), Team Pro ($15/seat/month)
- CTA links include plan and mode query parameters for checkout routing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add billing mode toggle to pricing table** - `0c2c68e` (feat)
2. **Task 2: Update pricing page metadata** - `ac7a322` (feat)

## Files Created/Modified
- `apps/web-portal/components/pricing/pricing-table.tsx` - Added BillingModeToggle, INDIVIDUAL_PLANS, TEAM_PLANS arrays, mode-aware PricingCard
- `apps/web-portal/app/pricing/page.tsx` - Updated metadata description and hero subheadline for dual billing modes

## Decisions Made
- Toggle uses "For Myself" and "For My Team" as user-friendly labels (clearer than "Individual" / "Team")
- Individual mode displays /month, Team mode displays /seat/month
- Plan IDs match expected values for checkout routing: starter, pro, team-starter, team-pro
- CTA href format: `/login?plan=${planId}&mode=${mode}`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pricing page ready with both billing modes
- Login page can consume plan/mode query params for checkout flow
- Ready for checkout integration testing

---
*Phase: 11-individual-billing*
*Completed: 2026-02-02*
