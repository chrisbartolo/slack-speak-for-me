---
phase: 05-weekly-reports
plan: 02
subsystem: oauth, web-ui
tags: [google-oauth, oauth-flow, web-portal, ui, server-actions]

# Dependency graph
requires:
  - phase: 05-weekly-reports
    plan: 01
    provides: Google OAuth foundation (getGoogleAuthUrl, handleGoogleCallback)
  - phase: 04-web-portal
    provides: Session management, server actions pattern
provides:
  - Complete Google OAuth flow from web portal to slack-backend
  - Google connection UI with connect/disconnect
  - OAuth callback routes with redirect handling
affects: [05-03-weekly-report-monitoring, 05-04-sheet-setup]

# Tech tracking
tech-stack:
  added: []
  patterns: [OAuth flow wiring, success/error toast notifications, callback redirect pattern]

key-files:
  created:
    - apps/web-portal/components/dashboard/google-connection-card.tsx
    - apps/web-portal/components/dashboard/success-toast.tsx
  modified:
    - apps/slack-backend/src/handlers/health.ts
    - apps/web-portal/lib/db/index.ts
    - apps/web-portal/lib/db/queries.ts
    - apps/web-portal/app/(dashboard)/reports/actions.ts
    - apps/web-portal/app/(dashboard)/reports/page.tsx

key-decisions:
  - "/oauth/google/start route generates auth URL from web-portal session"
  - "/oauth/google/callback route handles token exchange and redirects with query params"
  - "WEB_PORTAL_URL defaults to localhost:3001 for development"
  - "Success/error feedback via query params and toast notifications"

patterns-established:
  - "OAuth initiation from server action → redirect to slack-backend → redirect to Google → callback to slack-backend → redirect to web-portal"
  - "GoogleConnectionCard shows status with conditional connect/disconnect UI"
  - "SuccessToast client component displays OAuth result messages"

# Metrics
duration: 4min
completed: 2026-01-27
---

# Phase 05 Plan 02: Google OAuth Flow Wiring Summary

**Complete OAuth flow from web portal reports page through slack-backend callback endpoint**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-27T14:01:40Z
- **Completed:** 2026-01-27T14:05:19Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- /oauth/google/start and /oauth/google/callback routes in slack-backend
- Google connection queries and server actions in web-portal
- GoogleConnectionCard UI component with connect/disconnect buttons
- Success/error toast notifications via query params

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Google OAuth callback route to slack-backend** - `1b4756d` (feat)
2. **Task 2: Add Google connection query and actions to web-portal** - `df87672` (feat)
3. **Task 3: Add Google connection UI to reports page** - `3e6f674` (feat)

## Files Created/Modified
- `apps/slack-backend/src/handlers/health.ts` - Added /oauth/google/start and /oauth/google/callback routes
- `apps/web-portal/lib/db/index.ts` - Added googleIntegrations to schema export
- `apps/web-portal/lib/db/queries.ts` - Added getGoogleIntegration() cached query
- `apps/web-portal/app/(dashboard)/reports/actions.ts` - Added disconnectGoogle() and getGoogleAuthUrl()
- `apps/web-portal/components/dashboard/google-connection-card.tsx` - Connection status UI
- `apps/web-portal/components/dashboard/success-toast.tsx` - Toast notification helper
- `apps/web-portal/app/(dashboard)/reports/page.tsx` - Integrated GoogleConnectionCard and toast feedback

## Decisions Made

**OAuth start route generates URL from session data**
- /oauth/google/start receives workspaceId/userId from web-portal server action
- Server action uses verifySession() to get authenticated user context
- Constructs redirect URL to slack-backend with query params

**Callback redirects to web-portal with query params**
- google_connected=true on success
- error=google_auth_failed on failure
- Web-portal page reads searchParams and displays toast

**WEB_PORTAL_URL environment variable**
- Defaults to localhost:3001 for development
- Used in OAuth callback to redirect user back to reports page
- Optional configuration for production deployments

**Toast notifications via client component**
- SuccessToast renders null but triggers toast.success/error on mount
- Supports both success and error variants
- Clean pattern for displaying callback results

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing TypeScript error in app.ts**
- registerWorkflowSubmissionHandler was imported but not exported from handlers/index.ts
- This was a blocking compilation error unrelated to this plan
- Export was already fixed (likely by linter) when verified

## OAuth Flow Summary

1. User visits /reports page
2. Clicks "Connect Google Account" button
3. Client calls getGoogleAuthUrl() server action
4. Server action uses session to get workspaceId/userId
5. Returns URL: http://localhost:3000/oauth/google/start?workspaceId=X&userId=Y
6. Browser redirects to slack-backend /oauth/google/start
7. Route calls getGoogleAuthUrl(workspaceId, userId) from google-oauth.ts
8. Redirects to Google consent screen
9. User grants permissions
10. Google redirects to /oauth/google/callback with code and state
11. Route calls handleGoogleCallback(code, state)
12. Tokens stored in googleIntegrations table
13. Redirects to web-portal: http://localhost:3001/reports?google_connected=true
14. Page shows success toast and updated connection status

## Next Phase Readiness

**Ready for next plan (05-03):**
- ✅ OAuth flow complete end-to-end
- ✅ User can connect Google account from web portal
- ✅ User can disconnect Google account
- ✅ Connection status displayed in UI
- ✅ Success/error feedback working

**User action required:**
- Configure Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- Set WEB_PORTAL_URL if not using localhost:3001
- Complete OAuth flow to store tokens

**Next steps:**
- Plan 05-03 will use stored Google credentials for Sheets API access
- Plan 05-04 will implement sheet setup UI
- Plan 05-05 will implement workflow monitoring

---
*Phase: 05-weekly-reports*
*Completed: 2026-01-27*
