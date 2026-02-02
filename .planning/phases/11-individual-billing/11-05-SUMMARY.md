---
phase: 11-individual-billing
plan: 05
subsystem: ui
tags: [billing, subscription, sidebar, dashboard, stripe]

# Dependency graph
requires:
  - phase: 11-03
    provides: checkUserAccess function, getIndividualSubscription, user portal endpoint
provides:
  - /settings/billing page for individual subscription management
  - Billing link in sidebar for all users
  - Unified access checking in dashboard layout
affects: [11-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Access source detection (individual vs organization)
    - Overlap warning for dual subscriptions

key-files:
  created:
    - apps/web-portal/app/settings/billing/page.tsx
  modified:
    - apps/web-portal/components/dashboard/sidebar.tsx
    - apps/web-portal/app/dashboard/layout.tsx

key-decisions:
  - "Billing link shown to all users (not admin-only)"
  - "Overlap warning when user has both individual and org subscription"
  - "Access source banner indicates subscription type"
  - "Upgrade link routes to individual billing page for non-admins"

patterns-established:
  - "Dual access path handling: individual subscription checked first, org fallback"
  - "Subscription banner with dynamic upgrade links based on access source"

# Metrics
duration: 5min
completed: 2026-02-02
---

# Phase 11 Plan 05: Individual Billing Settings Page Summary

**Individual billing settings page with subscription management, overlap detection, and sidebar integration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-02T12:00:00Z
- **Completed:** 2026-02-02T12:05:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created /settings/billing page for personal subscription management
- Added Billing nav link to sidebar (visible to all users)
- Integrated checkUserAccess in dashboard layout for unified access checking
- Show overlap warning when user has both individual and org subscriptions
- Access source banner indicates whether access is through individual or organization
- Dynamic upgrade links route to appropriate billing page based on user role

## Task Commits

Each task was committed atomically:

1. **Task 1: Create individual billing settings page** - `7405627` (feat)
2. **Task 2: Add Billing link to sidebar and integrate access checking** - `3b4e6bb` (feat)

## Files Created/Modified
- `apps/web-portal/app/settings/billing/page.tsx` - Individual billing settings page with subscription status, portal access, org info, and overlap warning
- `apps/web-portal/components/dashboard/sidebar.tsx` - Added Billing nav item with CreditCard icon
- `apps/web-portal/app/dashboard/layout.tsx` - Integrated checkUserAccess for unified subscription status and dynamic upgrade links

## Decisions Made
- Billing link shown to all users in sidebar (not just admins) - individuals need access to manage their personal subscriptions
- Overlap warning displayed when user has both individual and organization coverage - helps users avoid paying twice
- Access source banner clearly indicates where access comes from (individual vs org)
- Upgrade links dynamically route based on access source: admins go to /admin/billing, non-admins go to /settings/billing
- Used null coalescing for trialEndsAt fields to satisfy TypeScript strict null checks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Minor TypeScript error with undefined vs null for trialEndsAt field - resolved with null coalescing operator (`?? null`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Individual billing page complete and accessible
- Dashboard correctly shows subscription status based on access source
- Ready for Phase 11-06 (end-to-end testing) to verify complete flow

---
*Phase: 11-individual-billing*
*Completed: 2026-02-02*
