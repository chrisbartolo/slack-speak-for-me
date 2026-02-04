# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** When a challenging message arrives, the user gets an intelligent suggested response that sounds like them, considers full context, and helps them respond professionally without emotional reactivity.
**Current focus:** Production Deployment - LIVE

## Current Position

Phase: 19 of 20 (Satisfaction Measurement) - COMPLETE
Plan: 05 of 05 - COMPLETE (Admin Satisfaction Dashboard + Sidebar Navigation)
Status: Phase complete
Last activity: 2026-02-04 - Completed 19-05-PLAN.md (Admin Satisfaction Dashboard + Sidebar Navigation)

Progress: [████████████████████████] 95% (Phase 19 complete, all plans finished)

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
- Total plans completed: 55
- Average duration: 3.5 min
- Total execution time: ~3.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 - Foundation | 5 | 13 min | 2.6 min |
| 02 - Core Slack | 8 | 25 min | 3.1 min |
| 02.1 - Testing | 7 | 30 min | 4.3 min |
| 03 - AI Personalization | 7 | 22 min | 3.1 min |
| 04 - Web Portal | 5 | 29 min | 5.8 min |
| 05 - Weekly Reports | 9 | 30 min | 3.3 min |
| 17 - Communication Insights | 5 | 18 min | 3.6 min |
| 18 - Auto-Learning KB | 5 | 20 min | 4.0 min |
| 19 - Satisfaction Measurement | 5 | 42 min | 8.4 min |

*Updated after each plan completion*

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
- Phase 16 Plan 01: Denormalized organizationId in metrics - Not a foreign key, filled at record time for fast org-wide queries
- Phase 16 Plan 01: Nullable pipeline timestamps - All stage timestamps nullable, filled incrementally as suggestion progresses
- Phase 16 Plan 01: Pre-computed duration columns - Stored in milliseconds to avoid recalculating in every query
- Phase 16 Plan 01: Unique constraint on suggestionId - Enables onConflictDoUpdate upsert pattern
- Phase 16 Plan 02: Fire-and-forget pattern - All recording functions wrapped in try/catch with logger.warn, never throw
- Phase 16 Plan 02: Upsert pattern - onConflictDoUpdate on suggestionId allows stages to be recorded independently
- Phase 16 Plan 02: organizationId caching - 5-minute TTL cache reduces database lookups for workspace→org resolution
- Phase 16 Plan 02: Placeholder UUID pattern - Insert operations use placeholder UUID since suggestionId is the real unique key
- Phase 16 Plan 03: suggestionId in AIResponseJobData - Flow through job data ensures worker access without regeneration
- Phase 16 Plan 03: Fire-and-forget with .catch(() => {}) - All 8 integration points use non-blocking pattern for zero latency impact
- Phase 16 Plan 03: Multiple delivery path recording - YOLO, response_url, and ephemeral paths each record delivery independently
- Phase 16 Plan 04: PERCENTILE_CONT for accurate percentiles - PostgreSQL function for exact p50/p95 instead of approximations
- Phase 16 Plan 04: Default SLA threshold of 10 seconds - Configurable threshold for suggestion delivery compliance tracking
- Phase 16 Plan 04: Time saved assumes 5 minutes manual response time - Conservative estimate vs instant AI draft
- Phase 16 Plan 04: Top 20 channels and users by volume - Focused analysis without overwhelming UI
- Phase 16 Plan 04: CSV export limited to 10,000 rows - Performance safeguard while covering 90+ days typical data
- Phase 16 Plan 04: Stage breakdown shows queue/AI/delivery separately - Three-stage isolation for targeted performance optimization
- Phase 17 Plan 01: suggestionId as unique key (not foreign key) - Follows suggestionMetrics pattern for flexible suggestion tracking
- Phase 17 Plan 01: Confidence stored as integer 0-100 - Matches actionableItems pattern, multiply float by 100 before insert
- Phase 17 Plan 01: JSONB for sentiment and aggregates - Flexible schema for SentimentAnalysis objects and trend distributions
- Phase 17 Plan 01: Unique constraint on trend records - (organizationId, trendDate, trendPeriod) ensures one daily record per org
- Phase 17 Plan 02: 7 topic categories - scheduling, complaint, technical, status_update, request, escalation, general
- Phase 17 Plan 02: 2-second timeout for topic classification - Shorter than sentiment's 3s, simpler classification task
- Phase 17 Plan 02: Fire-and-forget with nested sentiment - Topic insert first, then sentiment UPDATE on same row
- Phase 17 Plan 02: Reuse organizationId resolution pattern - Same caching approach as suggestion-metrics for consistency
- Phase 17 Plan 03: Daily 3 AM UTC schedule - Same time as data retention, runs after usage reporting (2 AM), aggregates yesterday's data
- Phase 17 Plan 03: Error isolation per org - One org failure doesn't block aggregation for others, incremental progress tracking
- Phase 17 Plan 03: SQL aggregation queries - GROUP BY with JSONB access more readable in raw SQL, better performance
- Phase 17 Plan 03: Channel hotspot threshold - Min 10 messages and 30% complaint/escalation ratio filters noise
- Phase 17 Plan 04: 7 cached query functions - Follows response-time-analytics pattern, one function per chart/table
- Phase 17 Plan 04: Pivot transformation for trends - Convert topic/sentiment rows into date-keyed objects with all fields present
- Phase 17 Plan 04: Default 0 for missing topics - Ensures all 7 topics present in TopicTrendPoint even if no data
- Phase 17 Plan 04: Risk score formula - (complaintRate * 0.7) + (escalationCount * 3) balances percentage and severity
- Phase 17 Plan 04: Week-over-week Monday-based - Aligns with business convention from Phase 5 report generation
- Phase 17 Plan 04: Client insights profile count check - Returns empty array if org has no clients, avoids expensive JOIN
- Phase 18 Plan 01: kbCandidates status workflow - pending/approved/rejected/merged states for admin review lifecycle
- Phase 18 Plan 01: Quality scoring with multiple metrics - acceptance_count, unique_users_count, avg_similarity for admin prioritization
- Phase 18 Plan 01: Non-FK suggestionId pattern in kbEffectiveness - Same pattern as suggestionMetrics, survives suggestion cleanup
- Phase 18 Plan 01: Denormalized organizationId in kbEffectiveness - Fast org-wide effectiveness queries without JOIN
- Phase 18 Plan 02: Claude Sonnet 4 for pattern evaluation - Same model as topic classification, 500 token limit for structured JSON
- Phase 18 Plan 02: Vector similarity threshold 0.9 for duplicates - Conservative to avoid false positives, uses pgvector cosine distance
- Phase 18 Plan 02: Quality score weights - Acceptance 40%, similarity 30%, diversity 20%, recency 10% (acceptance is primary signal)
- Phase 18 Plan 02: Opt-in KB learning via organizationId - trackAcceptance only queues job when organizationId provided by caller
- Phase 18 Plan 02: Fire-and-forget with double safety - Both queueKBLearning and worker wrapped in try/catch, never throw
- Phase 18 Plan 03: Fire-and-forget KB usage tracking - Zero latency impact on suggestion generation, tracking failures don't block UX
- Phase 18 Plan 03: Track ALL KB results - Even low-similarity matches provide data on why documents weren't helpful
- Phase 18 Plan 03: Batch insert for KB usage - Single query for multiple documents per suggestion, reduces database round trips
- Phase 18 Plan 03: 30% acceptance threshold - Low-performing docs below 30% with min 5 uses suggests document frequently unhelpful
- Phase 18 Plan 04: Raw SQL for effectiveness queries - Complex JOINs with aggregations more readable in raw SQL vs ORM builder
- Phase 18 Plan 04: Quality score sorting as default - Admins review highest-quality candidates first for maximum impact
- Phase 18 Plan 04: 12-week growth trend window - Quarter-view shows seasonal patterns without overwhelming chart UI
- Phase 18 Plan 04: Null coalescing on acceptanceCount merge - Defensive programming prevents NaN from nullable integer fields
- Phase 19 Plan 01: Survey unique constraint prevents duplicates - (workspaceId, userId, surveyType, deliveredAt) prevents duplicate survey deliveries
- Phase 19 Plan 01: Health scores support team and individual tracking - Nullable userId field enables both aggregate and per-user scores
- Phase 19 Plan 01: NPS rating nullable until response - Allows tracking survey delivery independently from completion
- Phase 19 Plan 01: 7-day survey expiration window - expiredAt timestamp set after 7 days if no user response
- Phase 19 Plan 01: Baseline tracking with isBaseline flag - Identifies first 30-day scores for before/after comparisons
- Phase 19 Plan 01: Component metrics nullable for data sparsity - All health score components nullable to handle insufficient data scenarios
- Phase 19 Plan 03: Health score weights 25/20/20/20/15 - Acceptance rate most important, then response time/sentiment/satisfaction equally, engagement least critical
- Phase 19 Plan 03: MIN_SUGGESTIONS_FOR_SCORE = 5 - Below 5 suggestions, score is unreliable and misleading - return null for insufficient data
- Phase 19 Plan 03: Null metric fallback to 50 - Missing component metrics default to neutral score to avoid penalizing new users
- Phase 19 Plan 03: Response time inverted scoring - Lower is better: ((60000 - clamp(ms, 0, 60000)) / 60000) * 100
- Phase 19 Plan 03: Baseline period = first 5 weeks - 5 weekly scores approximate 30-day baseline for before/after comparison
- Phase 19 Plan 03: Sunday 2 AM UTC weekly schedule - Runs before satisfaction surveys (Monday 9 AM) and after usage reporting (daily 2 AM)
- Phase 19 Plan 03: Team aggregate with userId null - Separate team-wide health score alongside individual scores for org-level insights
- Phase 19 Plan 03: Raw SQL for multi-source queries - Complex aggregations across 5 tables more readable in SQL, follows trend-aggregator pattern
- Phase 19 Plan 02: Block Kit radio_buttons for 0-10 NPS rating - 11 options with block_id including surveyId for state extraction
- Phase 19 Plan 02: 30-day frequency cap prevents survey fatigue - canSurveyUser checks 30+ days elapsed since last survey
- Phase 19 Plan 02: Weekly Monday 9 AM UTC delivery schedule - BullMQ cron pattern '0 9 * * 1' for automated survey delivery
- Phase 19 Plan 02: Fire-and-forget survey delivery pattern - Errors logged but don't throw, job completes successfully
- Phase 19 Plan 02: NPS categorization formula - 9-10 promoter, 7-8 passive, 0-6 detractor
- Phase 19 Plan 02: Survey expiration cleanup in delivery job - expireOldSurveys() called at end of weekly job
- Phase 19 Plan 04: React cache() wrapping - All 7 query functions wrapped with cache() for automatic deduplication and memoization
- Phase 19 Plan 04: DISTINCT ON pattern - getUserHealthScores uses DISTINCT ON (userId) ORDER BY scoreDate DESC to get latest score per user
- Phase 19 Plan 04: Parallel CSV exports - API route supports 3 types (health-scores, users, surveys) via ?type= query param
- Phase 19 Plan 04: 52-week default for CSV - Health score trend CSV defaults to 52 weeks (1 year) for comprehensive export
- Phase 19 Plan 04: NPS calculation - (promoters% - detractors%) following industry standard NPS formula
- Phase 19 Plan 04: Baseline vs post-baseline - getBeforeAfterComparison separates scores by isBaseline flag for improvement tracking
- Phase 19 Plan 04: Thumbs ratio from feedback - getThumbsRatioTrend counts 'accepted'/'sent' as thumbs up, 'dismissed' as thumbs down
- Phase 19 Plan 04: User ranking by health score - getUserHealthScores sorts DESC with null scores last for best-first display
- Phase 19 Plan 05: Plain HTML with Tailwind instead of Tremor Text/Metric/Flex - Tremor doesn't export these, follow existing chart patterns
- Phase 19 Plan 05: Color tier thresholds - Excellent (80-100) green, Good (60-79) blue, Fair (40-59) yellow, Needs Attention (0-39) red
- Phase 19 Plan 05: 3-column overview layout - Health gauge, NPS score, survey stats as first row of dashboard
- Phase 19 Plan 05: Sidebar placement after Learning Loop - Satisfaction in Organization section for quality monitoring grouping

### Pending Todos

- ✅ Deploy to DigitalOcean App Platform - DONE
- Configure Slack App settings with production redirect URLs:
  - OAuth Redirect: `https://slack-speak-for-me-z3w85.ondigitalocean.app/slack/oauth_redirect`
  - Web Portal Login: `https://slack-speak-for-me-z3w85.ondigitalocean.app/callback`
- Update Google Cloud Console redirect URI to production URL
- Generate logo and marketing imagery
- Test production deployment end-to-end with actual Slack workspace

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

Last session: 2026-02-04
Stopped at: Completed 19-05-PLAN.md (Admin Satisfaction Dashboard + Sidebar Navigation)
Resume file: None

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

**Phase 17 Plan 01 (2026-02-04):**

Database schema:
- `packages/database/src/schema.ts` - Added topicClassifications and communicationTrends tables

Planning artifacts:
- `.planning/phases/17-communication-pattern-insights/17-01-SUMMARY.md` - Plan summary
- `.planning/STATE.md` - Updated current position and decisions

**Phase 17 Plan 03 (2026-02-04):**

Trend aggregator service:
- `apps/slack-backend/src/services/trend-aggregator.ts` - Daily trend aggregation logic
- `apps/slack-backend/src/services/index.ts` - Export aggregateDailyTrends

BullMQ job system:
- `apps/slack-backend/src/jobs/types.ts` - TrendAggregationJobData/Result types
- `apps/slack-backend/src/jobs/queues.ts` - trendAggregationQueue
- `apps/slack-backend/src/jobs/workers.ts` - Trend aggregation worker
- `apps/slack-backend/src/jobs/schedulers.ts` - setupTrendAggregationScheduler
- `apps/slack-backend/src/jobs/index.ts` - Export scheduler setup
- `apps/slack-backend/src/index.ts` - Call scheduler on startup

Planning artifacts:
- `.planning/phases/17-communication-pattern-insights/17-03-SUMMARY.md` - Plan summary
- `.planning/STATE.md` - Updated current position and decisions

**Phase 17 Plan 05 (2026-02-04):**

Dashboard components:
- `apps/web-portal/components/admin/communication-insights-charts.tsx` - 7 chart components (TopicTrendChart, SentimentTrendChart, ChannelHotspotTable, WeekOverWeekCards, EscalationSummaryCard, ClientInsightsTable)
- `apps/web-portal/app/admin/communication-insights/page.tsx` - Admin dashboard with parallel data fetching

Planning artifacts:
- `.planning/phases/17-communication-pattern-insights/17-05-SUMMARY.md` - Plan summary
- `.planning/STATE.md` - Updated current position and decisions

**Phase 18 Plan 01 (2026-02-04):**

Database schema:
- `packages/database/src/schema.ts` - Added kbCandidates and kbEffectiveness tables

Planning artifacts:
- `.planning/phases/18-auto-learning-knowledge-base/18-01-SUMMARY.md` - Plan summary
- `.planning/STATE.md` - Updated current position and decisions

---
*Last updated: 2026-02-04*
