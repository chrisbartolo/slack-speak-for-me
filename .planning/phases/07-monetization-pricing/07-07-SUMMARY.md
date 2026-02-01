---
phase: 07-monetization-pricing
plan: 07
subsystem: payments
tags: [resend, email, stripe-webhooks, billing-notifications]

# Dependency graph
requires:
  - phase: 07-04
    provides: Stripe webhook handlers for subscription lifecycle events
provides:
  - Resend email client with lazy initialization
  - Email templates for trial ending, subscription paused, payment failed, subscription resumed
  - Webhook handlers integrated with email sending
affects: [user-communications, billing-admin]

# Tech tracking
tech-stack:
  added: [resend]
  patterns: [lazy-client-initialization, template-functions-for-email]

key-files:
  created:
    - apps/web-portal/lib/email/resend.ts
    - apps/web-portal/lib/email/templates.ts
  modified:
    - apps/web-portal/app/api/stripe/webhook/route.ts

key-decisions:
  - "Lazy Resend client initialization to support builds without API key"
  - "Graceful skip of email sending when RESEND_API_KEY not configured"
  - "Query organization for billingEmail before sending each notification"
  - "Calculate days remaining from subscription.trial_end for trial ending email"

patterns-established:
  - "Email templates as pure functions returning {subject, html, text}"
  - "Lazy initialization pattern for external service clients in Next.js"

# Metrics
duration: 3min
completed: 2026-02-01
---

# Phase 7 Plan 7: Billing Notifications Summary

**Resend email integration with 4 billing notification templates triggered by Stripe webhook events**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T11:00:58Z
- **Completed:** 2026-02-01T11:04:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Resend email client with lazy initialization and graceful degradation
- Email templates for trial ending, subscription paused, payment failed, subscription resumed
- Webhook handlers automatically send emails on billing events
- All emails include CTA buttons linking to billing/dashboard pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Resend email client and billing email templates** - `0ee34f9` (feat)
2. **Task 2: Integrate email sending into Stripe webhook handlers** - `869dbab` (feat)

## Files Created/Modified
- `apps/web-portal/lib/email/resend.ts` - Resend email client with lazy initialization and error handling
- `apps/web-portal/lib/email/templates.ts` - Email template functions for billing events
- `apps/web-portal/app/api/stripe/webhook/route.ts` - Webhook handlers with email sending integration

## Decisions Made
- **Lazy Resend client initialization:** Client created on first use rather than import time to support builds without RESEND_API_KEY environment variable
- **Graceful degradation:** When RESEND_API_KEY not configured, email sending is skipped with a warning log instead of throwing
- **Organization lookup per event:** Each webhook handler queries organization by stripeCustomerId to get billingEmail
- **Days remaining calculation:** Trial ending email calculates days from subscription.trial_end Unix timestamp

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed build-time Resend client initialization error**
- **Found during:** Task 2 (Build verification)
- **Issue:** Resend client instantiation at module load time fails when RESEND_API_KEY not set during build
- **Fix:** Changed to lazy initialization pattern - client created on first sendEmail call, with early return when API key missing
- **Files modified:** apps/web-portal/lib/email/resend.ts
- **Verification:** `npm run build --workspace=web-portal` completes successfully
- **Committed in:** 869dbab (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Essential fix for build compatibility. No scope creep.

## Issues Encountered
None - build error was handled as auto-fix deviation.

## User Setup Required

**External services require manual configuration.** The following environment variables must be set:

| Variable | Source |
|----------|--------|
| `RESEND_API_KEY` | Resend Dashboard -> API Keys -> Create API Key |
| `EMAIL_FROM` | Configure in .env, e.g., 'Speak for Me <noreply@speakforme.app>' |

**Dashboard configuration:**
- Verify domain in Resend Dashboard -> Domains -> Add Domain

## Next Phase Readiness
- Email infrastructure complete, ready for additional notification types
- Billing page at /admin/billing needs to exist for CTA links to work
- Consider adding email for successful payment/invoice.paid in future

---
*Phase: 07-monetization-pricing*
*Completed: 2026-02-01*
