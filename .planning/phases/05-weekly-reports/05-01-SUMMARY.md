---
phase: 05-weekly-reports
plan: 01
subsystem: database, auth
tags: [google-oauth, googleapis, google-sheets, encryption, postgresql, oauth2]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Database schema patterns, AES-256-GCM encryption for OAuth tokens
provides:
  - Google OAuth integration with token encryption and auto-refresh
  - googleIntegrations table for storing encrypted Google tokens
  - Environment validation for Google OAuth credentials
affects: [05-02-weekly-report-sheet-setup, 05-03-weekly-report-monitoring]

# Tech tracking
tech-stack:
  added: [googleapis]
  patterns: [OAuth token encryption, OAuth callback state CSRF protection, auto-refresh token handlers]

key-files:
  created:
    - apps/slack-backend/src/oauth/google-oauth.ts
  modified:
    - packages/database/src/schema.ts
    - apps/slack-backend/src/env.ts
    - .env.example

key-decisions:
  - "googleapis library for Google Sheets API access"
  - "State parameter for OAuth CSRF protection with workspaceId/userId"
  - "Offline access with consent prompt to ensure refresh token"
  - "Auto-refresh handler updates stored tokens on expiry"
  - "Unique constraint on (workspaceId, userId) for one integration per user"

patterns-established:
  - "Google OAuth service pattern: getAuthUrl → handleCallback → getClient → auto-refresh"
  - "Token encryption before database storage using AES-256-GCM from installation-store.ts"
  - "State parameter encoding with base64 JSON for CSRF protection"

# Metrics
duration: 3min
completed: 2026-01-27
---

# Phase 05 Plan 01: Google OAuth Foundation Summary

**Google OAuth integration with encrypted token storage, auto-refresh handlers, and Sheets API access**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-27T13:56:04Z
- **Completed:** 2026-01-27T13:59:22Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- googleIntegrations table with encrypted OAuth token storage
- Google OAuth service with full token lifecycle management
- Environment validation for Google OAuth credentials
- Foundation for Google Sheets read/write access

## Task Commits

Each task was committed atomically:

1. **Task 1: Add googleIntegrations table to database schema** - `9935048` (feat)
2. **Task 2: Add Google OAuth environment variables** - `4d9effe` (feat)
3. **Task 3: Create Google OAuth service** - `869e8b7` (feat)

## Files Created/Modified
- `packages/database/src/schema.ts` - Added googleIntegrations table with encrypted token columns
- `apps/slack-backend/src/env.ts` - Added Google OAuth environment validation and getters
- `.env.example` - Added Google OAuth placeholders
- `apps/slack-backend/src/oauth/google-oauth.ts` - Full OAuth service with 5 exported functions

## Decisions Made

**googleapis library for Google Sheets API**
- Official Google client library with OAuth2 support and auto-refresh
- Alternative considered: Direct REST API calls, but googleapis handles complexity

**State parameter for CSRF protection**
- Encode workspaceId and userId as base64 JSON in OAuth state param
- Prevents authorization code interception attacks

**Offline access with consent prompt**
- `access_type: 'offline'` requests refresh token
- `prompt: 'consent'` forces consent screen to ensure refresh token returned

**Auto-refresh handler pattern**
- OAuth2Client emits 'tokens' event on auto-refresh
- Handler updates encrypted tokens in database automatically

**Unique constraint on (workspaceId, userId)**
- One Google integration per user per workspace
- Upsert pattern on OAuth callback handles re-authorization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed existing patterns from installation-store.ts.

## User Setup Required

**External services require manual configuration.** See [05-USER-SETUP.md](./05-USER-SETUP.md) for:
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud Console
- OAuth 2.0 Client ID creation (Web application type)
- Authorized redirect URI configuration
- Google Sheets API enablement
- Verification commands

## Next Phase Readiness

**Ready for next plan (05-02):**
- ✅ Google OAuth token storage infrastructure complete
- ✅ Token encryption/decryption working
- ✅ Auto-refresh handling implemented
- ✅ getGoogleClient() ready for Sheets API calls

**User action required:**
- Set up Google Cloud Console OAuth credentials
- Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env
- Complete OAuth flow to store tokens

**Next steps:**
- Plan 05-02 will implement OAuth callback route and token storage UI
- Plan 05-03 will use getGoogleClient() for Sheets read/write operations

---
*Phase: 05-weekly-reports*
*Completed: 2026-01-27*
