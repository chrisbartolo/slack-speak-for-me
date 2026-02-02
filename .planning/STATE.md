# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** When a challenging message arrives, the user gets an intelligent suggested response that sounds like them, considers full context, and helps them respond professionally without emotional reactivity.
**Current focus:** Feature Complete - Ready for Go-to-Market

## Current Position

Phase: 11 of 11 (Individual Billing)
Plan: 5 of 6 in phase
Deployment: **LIVE** on DigitalOcean App Platform
Status: In progress
Last activity: 2026-02-02 - Completed 11-05-PLAN.md (Individual Billing Settings Page)

Progress: [██████████████████████████████░░] 99% (63/64 plans complete)

## Production Deployment

**URL:** https://slack-speak-for-me-z3w85.ondigitalocean.app
**App ID:** 5c38593d-ecac-43f7-9c82-bbbf39dc13bb
**Region:** NYC

**Services:**
- slack-backend: Handles /slack, /oauth, /health routes
- web-portal: Handles /, /api, /login, /dashboard, /callback, /install routes
- db-migrate: Pre-deploy job runs `drizzle-kit push`

**Infrastructure:**
- PostgreSQL: DigitalOcean Managed Database (doadmin user)
- Redis/Valkey: DigitalOcean Managed Database (TLS enabled)

## Performance Metrics

**Velocity:**
- Total plans completed: 46
- Average duration: 3.2 min
- Total execution time: ~2.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 - Foundation | 5 | 13 min | 2.6 min |
| 02 - Core Slack | 8 | 25 min | 3.1 min |
| 02.1 - Testing | 7 | 30 min | 4.3 min |
| 03 - AI Personalization | 7 | 22 min | 3.1 min |
| 04 - Web Portal | 5 | 29 min | 5.8 min |
| 05 - Weekly Reports | 9 | 30 min | 3.3 min |
| 06 - Production Polish | 8 | 25 min | 3.1 min |
| 07 - Monetization & Pricing | 7 | 25 min | 3.6 min |
| 08 - Production Security | 7/7 | 33 min | 4.7 min |

*Phase 8 complete*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 5 Plan 01: googleapis library for Google Sheets API - Official client with OAuth2 and auto-refresh support
- Phase 5 Plan 01: OAuth state CSRF protection - workspaceId/userId encoded as base64 JSON in state parameter
- Phase 5 Plan 01: Offline access with consent prompt - Ensures refresh token is returned for auto-refresh
- Phase 5 Plan 01: Auto-refresh token handler - OAuth2Client 'tokens' event updates encrypted tokens in database
- Phase 5 Plan 02: OAuth start route with session data - /oauth/google/start receives workspaceId/userId from web-portal
- Phase 5 Plan 02: OAuth callback redirects with query params - Success and error states communicated via URL parameters
- Phase 5 Plan 02: WEB_PORTAL_URL defaults to localhost:3001 - Environment variable for OAuth callback redirects
- Phase 5 Plan 03: Heuristic parser for workflow fields - Handles varied Workflow Builder formats with flexible field matching
- Phase 5 Plan 03: Auto-learning workflowBotId - First submission teaches system which bot posts workflows
- Phase 5 Plan 03: Rate limiting at 30 writes/min - Safety margin under Google Sheets 60/min API limit
- Phase 5 Plan 04: Claude Sonnet 4 for report generation - Same model as suggestions, 2048 max tokens for longer reports
- Phase 5 Plan 04: Monday-based weeks for reports - date-fns startOfWeek with weekStartsOn: 1 aligns with business convention
- Phase 5 Plan 05: Store spreadsheetId in googleIntegrations - Single source of truth for user's configured spreadsheet
- Phase 5 Plan 05: Response URL for slash command feedback - Async job completion posts success/error to command response_url
- Phase 5 Plan 06: BullMQ Job Schedulers for automated reports - Cron-based scheduling with timezone support, survives restarts via startup sync
- Phase 5 Plan 07: report_copy opens modal with copyable text in code block
- Phase 5 Plan 07: report_refine opens refinement modal with feedback input
- Phase 5 Plan 08: Prerequisite gating - Disable workflow and report forms until spreadsheet configured
- Phase 5 Plan 09: Scheduler sync on startup - Schedulers persist across restarts via syncAllReportSchedulers()
- Phase 6 Plan 01: User ID check moved before isWatching call - Enables TypeScript type narrowing
- Phase 6 Plan 01: isWatching check before context retrieval - Avoids unnecessary Slack API calls
- Phase 6 Plan 07: Two-layer auth pattern - Middleware for session, page-level requireAdmin() for role check
- Phase 6 Plan 07: Organization-workspace hierarchy - Organizations group workspaces for billing
- Phase 6 Plan 02: Channel type detection via channel_type field or channel ID prefix (D for DMs)
- Phase 6 Plan 02: onConflictDoNothing fallback for backward compatibility when channel info unavailable
- Phase 6 Plan 02: DM handling returns early to avoid thread processing
- Phase 6 Plan 03: Unique index on suggestionId + action combo prevents duplicates per action type
- Phase 6 Plan 03: Non-throwing trackFeedback function - analytics should not break user flows
- Phase 6 Plan 03: finalText stored even for accepted suggestions for consistent data model
- Phase 6 Plan 05: 4-column stat grid for balanced layout with new counters
- Phase 6 Plan 05: Expandable cards only for refined items (accepted/dismissed have no diff to show)
- Phase 6 Plan 05: Backward compatible FeedbackItem interface supporting both old and new data formats
- Phase 6 Plan 04: Track refinement at AI generation time rather than modal close
- Phase 6 Plan 04: Original text extracted from history[0] for multi-round refinements
- Phase 6 Plan 06: Use channelName/channelType from database props instead of API fetch
- Phase 6 Plan 06: DMs don't have # prefix in display name
- Phase 6 Plan 06: Refresh parameter enables one-time backfill for legacy data
- Phase 6 Plan 08: Organization-scoped queries - admin sees only their own organization
- Phase 6 Plan 08: Sidebar receives isAdmin as prop from async layout for conditional rendering
- Phase 6 Plan 08: Settings icon for admin navigation in sidebar
- Phase 7 Plan 03: 14-day default trial period via TRIAL_DAYS environment variable
- Phase 7 Plan 03: missing_payment_method: pause keeps subscription recoverable
- Phase 7 Plan 03: Backward compatible with legacy STRIPE_PRICE_ID env var
- Phase 7 Plan 03: startTrial defaults to true if no existing subscription
- Phase 7 Plan 01: schema-dts for TypeScript JSON-LD types
- Phase 7 Plan 01: XSS protection via Unicode escaping in JsonLd component
- Phase 7 Plan 01: Speakable schema for voice assistant headline markup
- Phase 7 Plan 02: Interactive FAQ accordion for better UX
- Phase 7 Plan 02: Next.js Script component for JSON-LD in client component
- Phase 7 Plan 02: Static sitemap generation with change frequencies
- Phase 7 Plan 04: trial_will_end logs only - email reminders can be added later
- Phase 7 Plan 04: invoice.payment_failed logs only - Stripe handles retry logic
- Phase 7 Plan 04: trialEndsAt converted from Unix timestamp (seconds) to JS Date
- Phase 7 Plan 05: past_due status allows access while Stripe handles retries
- Phase 7 Plan 05: Trial warning threshold at 3 days (shows warning instead of info)
- Phase 7 Plan 05: Organization fetched via workspace for subscription status
- Phase 7 Plan 07: Lazy Resend client initialization to support builds without API key
- Phase 7 Plan 07: Graceful skip of email sending when RESEND_API_KEY not configured
- Phase 7 Plan 07: Query organization for billingEmail before sending each notification
- Phase 7 Plan 07: Calculate days remaining from subscription.trial_end for trial ending email
- Phase 7 Plan 06: Server component wrapper pattern for JSON-LD SEO on client pages
- Phase 7 Plan 06: Root layout metadata includes title template, openGraph, twitter cards, keywords
- Phase 8 Plan 01: CSP allows unsafe-inline and unsafe-eval for Stripe compatibility
- Phase 8 Plan 01: 365-day cookie consent expiry for compliance
- Phase 8 Plan 01: react-cookie-consent library for GDPR banner implementation
- Phase 8 Plan 03: withRateLimit() adapter pattern - Express middleware adapted for Bolt Node HTTP handlers
- Phase 8 Plan 03: Memory store fallback - graceful degradation when Redis unavailable
- Phase 8 Plan 03: Standard rate limit headers - RateLimit-* headers (not legacy X-RateLimit-*)
- Phase 8 Plan 04: Server-rendered legal pages for SEO (Privacy Policy and Terms)
- Phase 8 Plan 02: Fire-and-forget pattern for audit logging - Async writes that never throw
- Phase 8 Plan 02: Dual audit services - Separate implementations for slack-backend (pino) and web-portal (console)
- Phase 8 Plan 05: Parallel Promise.all queries for data export - Efficient aggregation from 12+ tables
- Phase 8 Plan 05: OAuth tokens redacted in export - Show connected status only, never export tokens
- Phase 8 Plan 05: Client-side download trigger - Fetch JSON then create Blob for download
- Phase 8 Plan 06: Consent records preserved with revokedAt timestamp for compliance audit trail
- Phase 8 Plan 06: FK-safe deletion order - Leaf tables (embeddings, participants) before parent tables (users)
- Phase 8 Plan 06: Confirmation text 'DELETE MY ACCOUNT' required for API and UI
- Phase 8 Plan 06: Session destroyed after deletion to force logout
- Phase 9 Plan 02: NavGroup uses Radix Collapsible primitives for accessible expand/collapse
- Phase 9 Plan 02: NavItem compact prop reduces padding for nested submenu items
- Phase 9 Plan 02: ChevronDown icon rotates 180 degrees when admin section expanded
- Phase 9 Plan 02: Sidebar bg changed from hardcoded #FFFDF7 to bg-background CSS variable
- Phase 9 Plan 03: Drawer direction left for side navigation pattern
- Phase 9 Plan 03: Mobile header with hamburger menu icon (fixed, z-40)
- Phase 9 Plan 03: pt-16 md:pt-0 offset for fixed mobile header
- Phase 9 Plan 03: bg-background CSS variable instead of hardcoded bg-gray-50
- Phase 11 Plan 01: Email unique index (not primary key) for flexibility in user_subscriptions
- Phase 11 Plan 01: Email normalized to lowercase at fetch time in fetchUserEmail
- Phase 11 Plan 01: OpenID Connect userinfo endpoint for Slack email retrieval
- Phase 11 Plan 01: User email persisted to users table on login for reference
- Phase 11 Plan 02: Individual checkout uses customer_email instead of pre-created customer
- Phase 11 Plan 02: metadata.type='individual' distinguishes individual from org subscriptions
- Phase 11 Plan 02: Webhook uses upsert (onConflictDoUpdate) for individual subscription records
- Phase 11 Plan 02: Invoice events fall back to customer lookup since invoices lack subscription metadata
- Phase 11 Plan 03: Individual subscription checked before organization fallback
- Phase 11 Plan 03: past_due status grants access (Stripe is actively retrying)
- Phase 11 Plan 03: AccessResult type distinguishes source (individual vs organization)
- Phase 11 Plan 03: User portal endpoint uses verifySession (any user, not admin-only)
- Phase 11 Plan 04: BillingModeToggle uses "For Myself" / "For My Team" labels
- Phase 11 Plan 04: Individual mode shows /month, Team mode shows /seat/month
- Phase 11 Plan 04: Plan IDs: starter, pro, team-starter, team-pro
- Phase 11 Plan 04: Mode passed to login via query parameter (?plan=X&mode=Y)
- Phase 11 Plan 05: Billing link shown to all users in sidebar (not admin-only)
- Phase 11 Plan 05: Overlap warning when user has both individual and org subscription
- Phase 11 Plan 05: Access source banner indicates individual vs organization
- Phase 11 Plan 05: Upgrade link routes to individual billing for non-admins

### Pending Todos

- ✅ Deploy to DigitalOcean App Platform - DONE
- Configure Slack App settings with production redirect URLs:
  - OAuth Redirect: `https://slack-speak-for-me-z3w85.ondigitalocean.app/slack/oauth_redirect`
  - Web Portal Login: `https://slack-speak-for-me-z3w85.ondigitalocean.app/callback`
- Update Google Cloud Console redirect URI to production URL
- Generate logo and marketing imagery
- Test production deployment end-to-end with actual Slack workspace

### Roadmap Evolution

- Phase 6 added: Production Polish & Admin - Bug fixes, UX improvements, admin management

### Blockers/Concerns

**Research-identified risks to address:**
- Phase 1: HTTP webhooks required for production (Socket Mode hits 10 workspace limit) ✅ Using HTTP mode
- Phase 3: pgvector extension required in production PostgreSQL - Enable manually after DB creation

**Production deployment notes:**
- All CRITICAL and HIGH security issues fixed ✅
- Dockerfiles created for both services ✅
- app.yaml ready and deployed ✅
- Landing page with Add to Slack button created ✅
- Post-install onboarding wizard created ✅
- Page scrolling fixed (removed overflow-hidden from layout) ✅

## Session Continuity

Last session: 2026-02-02
Stopped at: Completed 11-05-PLAN.md (Individual Billing Settings Page)
Resume file: None

**Phase 7 Completion (2026-02-01):**
- All 7 plans in Phase 7 executed and verified
- Monetization flow end-to-end tested with human approval
- JSON-LD SEO fixed for server-side rendering

**Deployment Issues Resolved (2026-01-31):**
1. TypeScript .d.ts files not generating in Docker → Added explicit `composite: false`, `declaration: true` to package tsconfigs
2. npm workspaces not found in Docker → Changed to direct `npx drizzle-kit push` command
3. Self-signed certificate errors → Different fixes for pg vs postgres.js libraries:
   - Migration (pg): `?sslmode=require&uselibpqcompat=true`
   - Runtime (postgres.js): `ssl: { rejectUnauthorized: false }`
4. Validation package loading TypeScript at runtime → Fixed package.json to point to dist/
5. Routing conflicts → Reorganized routes: slack-backend handles /slack, /oauth, /health; web-portal handles everything else
6. Page not scrolling → Removed `overflow-hidden` from layout.tsx body

**Next action:** Configure Slack App redirect URLs in Slack App settings, then test full OAuth flow

## Files Changed This Session

**Production Deployment (2026-01-31):**

TypeScript/Build fixes:
- `packages/database/tsconfig.json` - Added explicit `composite: false`, `declaration: true` for Docker builds
- `packages/validation/tsconfig.json` - Same fix as database package
- `packages/validation/package.json` - Changed to point to compiled JS (`./dist/index.js`)
- `apps/slack-backend/Dockerfile` - Changed to sequential builds in dependency order

Database/Redis SSL:
- `packages/database/src/client.ts` - Added SSL support for DigitalOcean managed PostgreSQL
- `apps/slack-backend/src/env.ts` - Added REDIS_URL and REDIS_TLS environment variables
- `apps/slack-backend/src/jobs/connection.ts` - Support both REDIS_URL and REDIS_HOST/PORT configs

Routing/UI fixes:
- `app.yaml` - Reorganized routes, added actual secret values (gitignored)
- `apps/web-portal/app/layout.tsx` - Removed `overflow-hidden` to fix scrolling
- `.gitignore` - Added `app.yaml` to protect secrets

**Production Deployment Preparation (2026-01-30):**

Security fixes:
- `packages/database/src/client.ts` - UUID validation for RLS context (SQL injection fix)
- `apps/slack-backend/src/oauth/google-oauth.ts` - HMAC-signed OAuth state with expiration
- `packages/database/src/migrations/0004_complete_rls_policies.sql` - RLS on remaining tables

Production Dockerfiles:
- `apps/slack-backend/Dockerfile` - Multi-stage build, non-root user, health check
- `apps/web-portal/Dockerfile` - Next.js standalone output, non-root user

Deployment configuration:
- `app.yaml` - DigitalOcean App Platform specification

Landing page & onboarding:
- `apps/web-portal/app/page.tsx` - Landing page with Add to Slack button
- `apps/web-portal/app/install/success/page.tsx` - Post-install onboarding wizard
- `apps/web-portal/app/api/health/route.ts` - Health endpoint for web-portal
- `apps/web-portal/middleware.ts` - Updated public routes
- `apps/slack-backend/src/app.ts` - OAuth callback redirects to success page

Documentation:
- `.planning/PRODUCTION-READINESS.md` - Updated with security fix status
- `.planning/STATE.md` - Updated current state

**Phase 6 Plan 01 (2026-02-01):**
- `apps/slack-backend/src/handlers/events/app-mention.ts` - Added isWatching check before AI trigger
- `apps/slack-backend/src/handlers/events/app-mention.test.ts` - Added watch filtering tests
- `apps/slack-backend/test/e2e/app-mention.e2e.test.ts` - Added isWatching mock for E2E compatibility

**Phase 6 Plan 07 (2026-02-01):**
- `packages/database/src/schema.ts` - Added organizations table and user role column
- `apps/web-portal/lib/auth/admin.ts` - Created admin auth middleware (requireAdmin, isAdmin, getOrganization)
- `apps/web-portal/lib/db/index.ts` - Added organizations to schema exports
- `apps/web-portal/middleware.ts` - Added /admin to protectedRoutes

**Phase 6 Plan 02 (2026-02-01):**
- `packages/database/src/schema.ts` - Added channelName and channelType columns to watchedConversations
- `apps/slack-backend/src/services/watch.ts` - Added getWatchersForChannel(), updated watchConversation() signature
- `apps/slack-backend/src/handlers/commands/watch.ts` - Fetch channel info via conversations.info API
- `apps/slack-backend/src/handlers/events/message-reply.ts` - DM detection and handling, own-message filtering
- `apps/slack-backend/src/jobs/types.ts` - Added 'dm' to triggeredBy union type
- `apps/slack-backend/src/services/ai.ts` - Added 'dm' to SuggestionContext.triggeredBy
- `apps/slack-backend/src/services/suggestion-delivery.ts` - Added 'dm' label for trigger context
- `apps/slack-backend/test/helpers/db.ts` - Updated test schema with new columns and organizations table

**Phase 6 Plan 03 (2026-02-01):**
- `packages/database/src/schema.ts` - Added suggestionFeedback table
- `apps/slack-backend/src/services/feedback-tracker.ts` - Created feedback tracking service
- `apps/slack-backend/src/services/index.ts` - Exported feedback-tracker functions
- `apps/web-portal/lib/db/index.ts` - Added suggestionFeedback to schema exports
- `apps/web-portal/lib/db/queries.ts` - Added getSuggestionFeedback and getSuggestionFeedbackStats queries

**Phase 6 Plan 05 (2026-02-01):**
- `apps/web-portal/app/dashboard/feedback/page.tsx` - Added suggestion stats queries, 4-column grid, updated Recent Suggestions section
- `apps/web-portal/components/dashboard/feedback-list.tsx` - ActionBadge component, FeedbackItemCard with expandable details

**Phase 6 Plan 04 (2026-02-01):**
- `apps/slack-backend/src/handlers/actions/copy-suggestion.ts` - Added trackAcceptance call before responding
- `apps/slack-backend/src/handlers/actions/dismiss-suggestion.ts` - Added trackDismissal call before message deletion
- `apps/slack-backend/src/handlers/views/refinement-modal.ts` - Added trackRefinement call after AI generates refined suggestion

**Phase 6 Plan 06 (2026-02-01):**
- `apps/web-portal/lib/db/queries.ts` - Explicit select for channelName, channelType fields
- `apps/web-portal/components/dashboard/conversation-list.tsx` - Removed API fetch, added channel type icons and action buttons
- `apps/web-portal/app/api/slack/channels/route.ts` - Added refresh parameter for legacy data backfill

**Phase 6 Plan 08 (2026-02-01):**
- `apps/web-portal/lib/db/admin-queries.ts` - Cached queries for organizations, workspaces, users
- `apps/web-portal/app/admin/layout.tsx` - Admin layout with requireAdmin protection
- `apps/web-portal/app/admin/page.tsx` - Admin dashboard with navigation cards
- `apps/web-portal/app/admin/organizations/page.tsx` - Organization list with plan details
- `apps/web-portal/app/admin/users/page.tsx` - Workspace users with role badges
- `apps/web-portal/components/dashboard/sidebar.tsx` - Added isAdmin prop and conditional admin link
- `apps/web-portal/app/dashboard/layout.tsx` - Added isAdmin check and prop passing

**Phase 7 Plan 03 (2026-02-01):**
- `packages/database/src/schema.ts` - Added trialEndsAt column to organizations table
- `apps/web-portal/lib/stripe.ts` - Added createTrialCheckout function with trial settings
- `apps/web-portal/app/api/stripe/checkout/route.ts` - Added planId/startTrial support, plan-based pricing

**Phase 7 Plan 01 (2026-02-01):**
- `apps/web-portal/lib/seo/schemas.ts` - JSON-LD schema definitions (SoftwareApplication, Organization, Speakable)
- `apps/web-portal/components/seo/json-ld.tsx` - XSS-safe JSON-LD script injection component
- `apps/web-portal/components/pricing/pricing-table.tsx` - Pricing cards with Starter/Pro plans
- `apps/web-portal/app/pricing/page.tsx` - Public pricing page with JSON-LD schemas

**Phase 7 Plan 02 (2026-02-01):**
- `apps/web-portal/app/page.tsx` - Added FAQSection component and JSON-LD script
- `apps/web-portal/lib/seo/schemas.ts` - Added faqItems array and populated faqSchema
- `apps/web-portal/app/sitemap.ts` - Dynamic sitemap generation
- `apps/web-portal/app/robots.ts` - Dynamic robots.txt with allow/disallow rules

**Phase 7 Plan 04 (2026-02-01):**
- `apps/web-portal/lib/billing/trial.ts` - Trial state helper functions (getTrialStatus, isTrialExpired, formatTrialDaysRemaining)
- `apps/web-portal/app/api/stripe/webhook/route.ts` - Extended with trial_will_end, paused, resumed, invoice handlers and trialEndsAt tracking

**Phase 7 Plan 05 (2026-02-01):**
- `apps/web-portal/lib/billing/seat-enforcement.ts` - Seat limit and subscription access checking service
- `apps/web-portal/app/dashboard/layout.tsx` - Dashboard layout with subscription status banner

**Phase 7 Plan 07 (2026-02-01):**
- `apps/web-portal/lib/email/resend.ts` - Resend email client with lazy initialization
- `apps/web-portal/lib/email/templates.ts` - Email templates for billing events
- `apps/web-portal/app/api/stripe/webhook/route.ts` - Webhook handlers with email sending integration

**Phase 7 Plan 06 (2026-02-01):**
- `apps/web-portal/app/layout.tsx` - Enhanced metadata with title template, openGraph, twitter cards, keywords
- `apps/web-portal/app/page.tsx` - Refactored to server component for JSON-LD SEO
- `apps/web-portal/components/landing/landing-page-content.tsx` - Client component extracted from landing page

**Phase 8 Plan 01 (2026-02-01):**
- `apps/web-portal/next.config.ts` - Security headers configuration (CSP, HSTS, X-Frame-Options, etc.)
- `apps/web-portal/components/cookie-consent.tsx` - GDPR cookie consent banner component
- `apps/web-portal/app/layout.tsx` - Added CookieConsentBanner to root layout

**Phase 8 Plan 03 (2026-02-01):**
- `apps/slack-backend/src/middleware/rate-limiter.ts` - Rate limiting middleware with Redis store, withRateLimit() adapter
- `apps/slack-backend/src/handlers/health.ts` - Applied rate limiters to health and OAuth routes
- `apps/slack-backend/package.json` - Added express-rate-limit and rate-limit-redis dependencies

**Phase 8 Plan 04 (2026-02-01):**
- `apps/web-portal/app/privacy/page.tsx` - GDPR-compliant Privacy Policy page
- `apps/web-portal/app/terms/page.tsx` - Terms of Service page
- `apps/web-portal/components/footer.tsx` - Reusable Footer component with legal links
- `apps/web-portal/components/landing/landing-page-content.tsx` - Updated to use Footer component

**Phase 8 Plan 02 (2026-02-01):**
- `packages/database/src/schema.ts` - Added auditLogs table with indexes and AuditAction type
- `apps/slack-backend/src/services/audit-logger.ts` - Fire-and-forget audit logging service
- `apps/slack-backend/src/services/index.ts` - Exported audit logging functions
- `apps/web-portal/lib/db/index.ts` - Added auditLogs to schema exports
- `apps/web-portal/lib/audit.ts` - Audit logging service for web-portal

**Phase 8 Plan 05 (2026-02-01):**
- `apps/web-portal/lib/gdpr/data-export.ts` - Data export service aggregating 12+ tables
- `apps/web-portal/app/api/gdpr/export/route.ts` - GDPR export API endpoint with audit logging
- `apps/web-portal/app/dashboard/settings/page.tsx` - Settings page with Data & Privacy section
- `apps/web-portal/components/dashboard/sidebar.tsx` - Added Settings link to navigation

**Phase 8 Plan 06 (2026-02-01):**
- `apps/web-portal/lib/gdpr/data-deletion.ts` - Transactional deletion from 12+ user tables
- `apps/web-portal/app/api/gdpr/delete/route.ts` - GDPR deletion API with confirmation and audit logging
- `apps/web-portal/app/dashboard/settings/page.tsx` - Added Danger Zone with delete account dialog

**Phase 9 Plan 04 (2026-02-02):**
- `apps/web-portal/components/ui/skeleton.tsx` - Skeleton loading component with animate-pulse
- `apps/web-portal/app/dashboard/loading.tsx` - Dashboard loading skeleton matching 4-col grid
- `apps/web-portal/app/dashboard/error.tsx` - Dashboard error boundary with retry button
- `apps/web-portal/app/admin/loading.tsx` - Admin loading skeleton matching nav cards and table
- `apps/web-portal/app/admin/error.tsx` - Admin error boundary with retry and dashboard fallback

**Phase 9 Plan 02 (2026-02-02):**
- `apps/web-portal/components/dashboard/nav-group.tsx` - Collapsible navigation group with Radix UI
- `apps/web-portal/components/dashboard/nav-item.tsx` - Added compact and optional icon props
- `apps/web-portal/components/dashboard/sidebar.tsx` - Uses NavGroup for expandable admin section

**Phase 9 Plan 01 (2026-02-02):**
- `apps/web-portal/app/globals.css` - Added warm cream background and blue-indigo gradient CSS variables
- `apps/web-portal/components/ui/button.tsx` - Added gradient button variant with hover lift effect
- `apps/web-portal/components/ui/card.tsx` - Added hover shadow and translate-y lift effect

**Phase 9 Plan 03 (2026-02-02):**
- `apps/web-portal/components/ui/drawer.tsx` - shadcn/ui Drawer component with vaul
- `apps/web-portal/hooks/use-media-query.ts` - useMediaQuery hook for responsive breakpoints
- `apps/web-portal/components/dashboard/responsive-sidebar.tsx` - Mobile drawer wrapper for sidebar
- `apps/web-portal/app/dashboard/layout.tsx` - Responsive layout with conditional sidebar/drawer

**Phase 11 Plan 01 (2026-02-02):**
- `packages/database/src/schema.ts` - Added userSubscriptions table with email unique index
- `apps/web-portal/lib/db/index.ts` - Exported userSubscriptions to schema object
- `apps/web-portal/lib/auth/session.ts` - Added email field to SessionPayload type
- `apps/web-portal/lib/auth/dal.ts` - Updated verifySession and getOptionalSession to return email
- `apps/web-portal/lib/auth/slack-oauth.ts` - Added email scope, created fetchUserEmail function
- `apps/web-portal/app/(auth)/callback/route.ts` - Fetch and pass email to createSession

**Phase 11 Plan 02 (2026-02-02):**
- `apps/web-portal/lib/stripe.ts` - Added createIndividualCheckout function with email and trial support
- `apps/web-portal/app/api/stripe/checkout/route.ts` - Dual-mode checkout with handleIndividualCheckout and handleOrganizationCheckout
- `apps/web-portal/app/api/stripe/webhook/route.ts` - Extended with individual subscription handlers and type-based routing

**Phase 11 Plan 03 (2026-02-02):**
- `apps/web-portal/lib/billing/access-check.ts` - Dual-path access checking with individual-first priority
- `apps/web-portal/app/api/stripe/user-portal/route.ts` - Individual user portal endpoint

**Phase 11 Plan 04 (2026-02-02):**
- `apps/web-portal/components/pricing/pricing-table.tsx` - BillingModeToggle, INDIVIDUAL_PLANS, TEAM_PLANS arrays, mode-aware pricing
- `apps/web-portal/app/pricing/page.tsx` - Updated metadata for dual billing modes

**Phase 11 Plan 05 (2026-02-02):**
- `apps/web-portal/app/settings/billing/page.tsx` - Individual billing settings page with subscription management
- `apps/web-portal/components/dashboard/sidebar.tsx` - Added Billing nav item visible to all users
- `apps/web-portal/app/dashboard/layout.tsx` - Integrated checkUserAccess for unified subscription status

---
*Last updated: 2026-02-02*
