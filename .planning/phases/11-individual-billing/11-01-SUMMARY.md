---
phase: 11-individual-billing
plan: 01
subsystem: database, auth
tags: [postgres, drizzle, jwt, session, email, stripe, billing]

# Dependency graph
requires:
  - phase: 07-monetization-pricing
    provides: Stripe integration for organization billing
  - phase: 08-production-security-compliance
    provides: Audit logging infrastructure
provides:
  - userSubscriptions table for individual billing
  - Session with email field for cross-workspace identity
  - Email scope in OAuth for user identity
affects: [11-individual-billing, subscription-queries, billing-enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Email as cross-workspace identifier for individual billing
    - OpenID Connect userinfo endpoint for Slack email fetch
    - Lowercase email normalization at application layer

key-files:
  created: []
  modified:
    - packages/database/src/schema.ts
    - apps/web-portal/lib/db/index.ts
    - apps/web-portal/lib/auth/session.ts
    - apps/web-portal/lib/auth/dal.ts
    - apps/web-portal/lib/auth/slack-oauth.ts
    - apps/web-portal/app/(auth)/callback/route.ts

key-decisions:
  - "Email unique index (not primary key) for flexibility in user_subscriptions"
  - "Email normalized to lowercase at fetch time in fetchUserEmail"
  - "OpenID Connect userinfo endpoint for Slack email retrieval"
  - "User email persisted to users table on login for reference"

patterns-established:
  - "Email as stable identifier: Use email for cross-workspace identity, not Slack user ID"
  - "Lowercase normalization: Always normalize email to lowercase before storing/comparing"

# Metrics
duration: 4min
completed: 2026-02-02
---

# Phase 11 Plan 01: User Subscriptions Schema and Session Email Summary

**userSubscriptions table for individual billing with email-based identity, session extended to include email for cross-workspace lookup**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-02T13:08:09Z
- **Completed:** 2026-02-02T13:12:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created userSubscriptions table with email-based identity and Stripe billing fields
- Extended session to include email for individual subscription lookup
- Added email scope to Slack OAuth and implemented email fetch via OpenID Connect
- Email automatically persisted to users table on login

## Task Commits

Each task was committed atomically:

1. **Task 1: Add userSubscriptions table to database schema** - `3ec4431` (feat)
2. **Task 2: Extend session to include email** - `95563bb` (feat)

## Files Created/Modified
- `packages/database/src/schema.ts` - Added userSubscriptions table with email unique index
- `apps/web-portal/lib/db/index.ts` - Exported userSubscriptions to schema object
- `apps/web-portal/lib/auth/session.ts` - Added email field to SessionPayload type
- `apps/web-portal/lib/auth/dal.ts` - Updated verifySession and getOptionalSession to return email
- `apps/web-portal/lib/auth/slack-oauth.ts` - Added email scope, created fetchUserEmail function
- `apps/web-portal/app/(auth)/callback/route.ts` - Fetch and pass email to createSession

## Decisions Made
- **Email unique index vs primary key:** Used unique index on email for flexibility - allows potential email changes while maintaining email-based lookup
- **OpenID Connect for email:** Used Slack's openid.connect.userInfo endpoint rather than users.info API - cleaner integration with OAuth flow
- **Email persistence to users table:** On each login, update user record with current email - keeps user table in sync for reference queries
- **Lowercase normalization point:** Normalized at fetchUserEmail function return - single point of normalization before any storage or comparison

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- userSubscriptions table ready for subscription creation
- Session includes email for subscription lookup queries
- Ready for: Individual checkout flow, subscription enforcement, billing portal

---
*Phase: 11-individual-billing*
*Completed: 2026-02-02*
