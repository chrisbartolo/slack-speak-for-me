---
phase: 11-individual-billing
plan: 02
subsystem: payments
tags: [stripe, checkout, webhook, subscription, individual-billing]

# Dependency graph
requires:
  - phase: 11-01
    provides: userSubscriptions table schema, session email field
provides:
  - Individual checkout mode (mode=individual) for authenticated users
  - createIndividualCheckout function with email-based identity
  - Webhook routing based on metadata.type (individual vs organization)
  - userSubscriptions table population from Stripe webhooks
affects: [11-03, 11-04, 11-05, seat-enforcement, billing-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - metadata.type field for subscription type routing
    - email-based individual subscription identity
    - upsert pattern for userSubscriptions on webhook events

key-files:
  created: []
  modified:
    - apps/web-portal/lib/stripe.ts
    - apps/web-portal/app/api/stripe/checkout/route.ts
    - apps/web-portal/app/api/stripe/webhook/route.ts

key-decisions:
  - "Individual checkout uses customer_email instead of pre-created customer"
  - "metadata.type='individual' distinguishes individual from org subscriptions"
  - "Webhook uses upsert (onConflictDoUpdate) for individual subscription records"
  - "Invoice events fall back to customer lookup since invoices lack subscription metadata"

patterns-established:
  - "Dual-mode checkout endpoint: mode parameter routes to individual or organization handler"
  - "Subscription type detection via getSubscriptionType(metadata) helper"
  - "Modular webhook handlers: separate functions for individual vs organization events"

# Metrics
duration: 8min
completed: 2026-02-02
---

# Phase 11 Plan 02: Checkout and Webhook Extension Summary

**Dual-mode Stripe checkout (individual/organization) with webhook routing based on subscription metadata type**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-02T14:15:00Z
- **Completed:** 2026-02-02T14:23:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended checkout endpoint to support mode=individual for any authenticated user
- Added createIndividualCheckout function using email-based customer identity
- Webhook now routes all subscription events based on metadata.type field
- Individual subscriptions populate userSubscriptions table with upsert pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Add individual checkout support** - `e4f2e53` (feat)
2. **Task 2: Extend webhook to handle individual subscriptions** - `a2446cb` (feat)

## Files Created/Modified

- `apps/web-portal/lib/stripe.ts` - Added createIndividualCheckout function with email and trial support
- `apps/web-portal/app/api/stripe/checkout/route.ts` - Dual-mode checkout with handleIndividualCheckout and handleOrganizationCheckout
- `apps/web-portal/app/api/stripe/webhook/route.ts` - Extended with individual subscription handlers and type-based routing

## Decisions Made

1. **Individual checkout uses customer_email** - Instead of creating a Stripe customer first, individual checkout passes email directly to checkout session. Stripe creates the customer automatically.

2. **metadata.type distinguishes subscription type** - Both individual and organization checkouts now include type='individual' or type='organization' in metadata at both session and subscription levels.

3. **Upsert pattern for individual subscriptions** - Webhook uses onConflictDoUpdate to handle both new and returning users on the same email.

4. **Invoice events use customer lookup fallback** - Since invoices don't have subscription metadata, we check organizations table first, then userSubscriptions table.

5. **Added type='organization' to existing org checkouts** - Updated createTrialCheckout and immediate checkout to include type='organization' for explicit routing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation straightforward following existing patterns.

## User Setup Required

**Environment variables to add for individual pricing:**
- `STRIPE_PRICE_ID_INDIVIDUAL_STARTER` - Price ID for individual starter plan
- `STRIPE_PRICE_ID_INDIVIDUAL_PRO` - Price ID for individual pro plan

If not set, the checkout will fall back to base plan price IDs (STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_PRO).

## Next Phase Readiness

- Checkout endpoint ready for individual subscriptions
- Webhook correctly populates userSubscriptions table
- Ready for Phase 11-03: Access control enforcement based on subscription status

---
*Phase: 11-individual-billing*
*Completed: 2026-02-02*
