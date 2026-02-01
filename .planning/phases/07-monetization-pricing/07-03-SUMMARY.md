---
phase: 07-monetization-pricing
plan: 03
subsystem: payments
tags: [stripe, trial, subscription, checkout]

# Dependency graph
requires:
  - phase: 07-monetization-pricing/07-02
    provides: Stripe checkout session creation
provides:
  - Trial checkout with no payment upfront
  - trialEndsAt tracking on organizations
  - Plan-based pricing (starter/pro)
affects: [07-monetization-pricing/07-04, webhook-handlers, billing-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Trial checkout with payment_method_collection: if_required"
    - "Paused subscription on missing payment (not canceled)"
    - "Plan-based price ID environment variables"

key-files:
  created: []
  modified:
    - packages/database/src/schema.ts
    - apps/web-portal/lib/stripe.ts
    - apps/web-portal/app/api/stripe/checkout/route.ts

key-decisions:
  - "14-day default trial period via TRIAL_DAYS environment variable"
  - "missing_payment_method: pause keeps subscription recoverable"
  - "Backward compatible with legacy STRIPE_PRICE_ID env var"
  - "startTrial defaults to true if no existing subscription"

patterns-established:
  - "Plan-specific env vars: STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_PRO"
  - "Trial checkout helper separates trial from immediate checkout logic"

# Metrics
duration: 4min
completed: 2026-02-01
---

# Phase 07 Plan 03: Trial Period Support Summary

**Stripe checkout with 14-day free trial, no payment required upfront, subscription pauses on missing payment**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-01T10:50:25Z
- **Completed:** 2026-02-01T10:54:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added trialEndsAt column to organizations table for trial tracking
- Created createTrialCheckout helper with trial_period_days and pause behavior
- Updated checkout route to support planId (starter/pro) and startTrial parameters
- Maintained backward compatibility with existing STRIPE_PRICE_ID configuration

## Task Commits

Each task was committed atomically:

1. **Task 1: Add trialEndsAt column to organizations schema** - `20ec5a0` (feat)
2. **Task 2: Create trial checkout helper and update checkout route** - `d50d460` (feat)

## Files Created/Modified
- `packages/database/src/schema.ts` - Added trialEndsAt timestamp column to organizations
- `apps/web-portal/lib/stripe.ts` - Added createTrialCheckout function with trial settings
- `apps/web-portal/app/api/stripe/checkout/route.ts` - Added planId/startTrial support, plan-based pricing

## Decisions Made
- **14-day trial default:** Configurable via TRIAL_DAYS env var, reasonable SaaS standard
- **Pause on missing payment:** Using missing_payment_method: 'pause' allows subscription recovery without re-signup
- **Plan-based env vars:** STRIPE_PRICE_ID_STARTER and STRIPE_PRICE_ID_PRO for clear price separation
- **Backward compatibility:** Falls back to STRIPE_PRICE_ID if plan-specific vars not set
- **Auto-trial for new orgs:** startTrial defaults to true if no stripeSubscriptionId exists

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - database push and build both succeeded on first attempt.

## User Setup Required

**External services require manual configuration:**
- Create Starter and Pro products in Stripe Dashboard with recurring prices
- Set STRIPE_PRICE_ID_STARTER environment variable to Starter plan price ID
- Set STRIPE_PRICE_ID_PRO environment variable to Pro plan price ID
- Optionally set TRIAL_DAYS (default: 14) to customize trial length

## Next Phase Readiness
- Trial checkout ready for integration with billing UI
- Webhook handlers need to set trialEndsAt when subscription starts
- Billing UI can show trial countdown using trialEndsAt field

---
*Phase: 07-monetization-pricing*
*Completed: 2026-02-01*
