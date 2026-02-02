---
phase: 11-individual-billing
plan: 03
subsystem: billing, api
tags: [stripe, subscription, access-control, dual-path, portal]

# Dependency graph
requires:
  - phase: 11-01
    provides: userSubscriptions table and session email
  - phase: 07-monetization-pricing
    provides: Stripe integration and createPortalSession
provides:
  - checkUserAccess function with dual-path (individual-first) logic
  - getIndividualSubscription and hasIndividualSubscription helpers
  - POST /api/stripe/user-portal for individual subscription management
affects: [11-individual-billing, subscription-enforcement, billing-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dual-path access checking with individual subscription priority
    - past_due status treated as active during Stripe retry period

key-files:
  created:
    - apps/web-portal/lib/billing/access-check.ts
    - apps/web-portal/app/api/stripe/user-portal/route.ts
  modified: []

key-decisions:
  - "Individual subscription checked before organization fallback"
  - "past_due status grants access (Stripe is actively retrying)"
  - "AccessResult type distinguishes source (individual vs organization)"
  - "User portal endpoint uses verifySession (any user, not admin-only)"

patterns-established:
  - "Dual-path access: checkUserAccess checks individual first, then org fallback"
  - "Subscription status normalization: past_due treated as active for access"

# Metrics
duration: 4min
completed: 2026-02-02
---

# Phase 11 Plan 03: Access Check and User Portal Summary

**Dual-path access checking service prioritizing individual subscriptions over org, with user portal endpoint for individual subscription management**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-02T13:20:00Z
- **Completed:** 2026-02-02T13:24:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created checkUserAccess function that checks individual subscription first, falls back to organization
- AccessResult type covers all access scenarios with source and status information
- Created POST /api/stripe/user-portal for individual subscription portal access
- Helper functions for subscription queries (getIndividualSubscription, hasIndividualSubscription)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dual-path access checking service** - `2d8b409` (feat)
2. **Task 2: Create user portal endpoint for individual subscriptions** - `03c6a69` (feat)

## Files Created/Modified
- `apps/web-portal/lib/billing/access-check.ts` - Dual-path access checking with AccessResult type
- `apps/web-portal/app/api/stripe/user-portal/route.ts` - Individual user portal endpoint

## Decisions Made
- **Individual-first priority:** Individual subscription is always checked before org fallback - ensures users who leave an org but have personal subs retain access
- **past_due treatment:** Treated as active to allow access while Stripe retries payment - consistent with existing org subscription behavior
- **AccessResult source field:** Returns 'individual' or 'organization' so UI can display appropriate messaging
- **No admin requirement:** User portal uses verifySession not requireAdmin - any authenticated user can manage their individual subscription

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Access checking service ready for use in enforcement middleware
- User portal endpoint ready for billing UI integration
- Ready for: Individual billing settings page, subscription enforcement middleware

---
*Phase: 11-individual-billing*
*Completed: 2026-02-02*
