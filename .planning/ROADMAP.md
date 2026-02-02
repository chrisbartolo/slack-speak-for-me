# Roadmap: Slack Speak for Me

## Overview

This roadmap delivers an AI-powered Slack integration that helps professionals craft contextually-aware responses to challenging workplace messages. The product serves two primary audiences:

1. **Individuals** - Professionals wanting to improve their communication with AI-powered suggestions
2. **Organizations** - Teams providing client support via Slack who need brand consistency and dispute avoidance

The journey starts with secure infrastructure and OAuth foundation, builds core Slack response suggestion features, adds AI personalization through style learning, provides a web portal for configuration and management, and expands with individual billing, client support features, and team management capabilities. Each phase delivers independently verifiable user value while avoiding critical security and compliance pitfalls identified during research.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Infrastructure** - Secure multi-tenant backend with OAuth and job processing
- [x] **Phase 2: Core Slack Response Suggestions** - AI-powered ephemeral suggestions in monitored conversations
- [x] **Phase 2.1: Testing Infrastructure** - Unit tests, E2E tests, and testing page (INSERTED)
- [x] **Phase 3: AI Personalization** - Style learning and iterative refinement
- [x] **Phase 4: Web Portal** - Dashboard for settings, history, and management
- [ ] **Phase 5: Weekly Reports** - Automated team report aggregation and formatting
- [x] **Phase 6: Production Polish & Admin** - Bug fixes, UX improvements, and admin management
- [x] **Phase 7: Monetization & Pricing** - Pricing page, trials, subscription lifecycle
- [x] **Phase 8: Production Security & Compliance** - GDPR, security hardening, audit logging
- [x] **Phase 9: Portal/Admin UX Polish** - Brand styling, expandable nav, mobile responsive
- [ ] **Phase 10: Calendar Integration** - Google Calendar OAuth, availability checking, meeting suggestions (DEFERRED - add when customers request)
- [ ] **Phase 11: Individual Billing** - Personal subscriptions independent of org, individual payment option
- [ ] **Phase 12: Client Support Features** - De-escalation mode, brand voice templates, sentiment tracking
- [ ] **Phase 13: Team/Org Dashboard** - Admin controls, analytics, compliance features

## Phase Details

### Phase 1: Foundation & Infrastructure
**Goal**: Secure, scalable backend infrastructure ready for AI workloads
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, SLACK-14
**Success Criteria** (what must be TRUE):
  1. User can install app to Slack workspace via OAuth and tokens are securely stored
  2. System processes background jobs asynchronously without hitting Slack 3-second timeout
  3. Database enforces workspace-level isolation (multi-tenant data cannot leak between workspaces)
  4. System sanitizes inputs and prevents prompt injection attacks
  5. System handles errors gracefully with user-friendly messages instead of crashes
**Plans**: 5 plans in 3 waves

Plans:
- [x] 01-01-PLAN.md — Project scaffolding with monorepo, TypeScript, database schema with RLS
- [x] 01-02-PLAN.md — OAuth installation store with AES-256-GCM token encryption
- [x] 01-03-PLAN.md — BullMQ background job queue with rate limiting
- [x] 01-04-PLAN.md — Input validation, prompt injection defense, error handling
- [x] 01-05-PLAN.md — Integration wiring and OAuth flow verification

### Phase 2: Core Slack Response Suggestions
**Goal**: Users receive AI-generated response suggestions via ephemeral messages
**Depends on**: Phase 1
**Requirements**: SLACK-01, SLACK-02, SLACK-03, SLACK-04, SLACK-05, SLACK-06, SLACK-07, SLACK-08, SLACK-09, SLACK-10, SLACK-11, SLACK-12, SLACK-13, AI-01, AI-02
**Success Criteria** (what must be TRUE):
  1. User receives ephemeral suggestion when mentioned in a channel they've added the app to
  2. User receives ephemeral suggestion when someone replies to their message in monitored conversation
  3. User receives ephemeral suggestion when new message appears in active thread they participate in
  4. User can right-click any message and select "Help me respond" to trigger suggestion in DM
  5. User can click "Refine" button to open modal and adjust suggestion through back-and-forth with AI
  6. User can click "Copy" button and suggestion text is copied to clipboard for pasting
  7. User can toggle watch/unwatch on specific conversations via slash command
  8. AI suggestions reflect context from recent messages in the conversation
**Plans**: 9 plans in 4 waves

Plans:
- [x] 02-01-PLAN.md — Database schema for watched conversations and thread participation tracking
- [x] 02-02-PLAN.md — AI suggestion service with Claude integration
- [x] 02-03-PLAN.md — Context retrieval service with rate limiting
- [x] 02-04-PLAN.md — Event handlers for app mentions and message replies
- [x] 02-05-PLAN.md — /watch and /unwatch slash commands
- [x] 02-06-PLAN.md — Ephemeral message delivery with Block Kit buttons
- [x] 02-07-PLAN.md — "Help me respond" message shortcut and action handlers
- [x] 02-08-PLAN.md — Refinement modal with multi-turn AI conversation
- [x] 02-09-PLAN.md — End-to-end verification of all success criteria

### Phase 2.1: Testing Infrastructure (INSERTED)
**Goal**: Comprehensive test coverage ensuring all code works correctly with automated and manual testing
**Depends on**: Phase 2
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. Unit tests exist for all services with 90%+ code coverage
  2. Unit tests mock external dependencies (Slack API, Anthropic API, database)
  3. Integration tests verify database operations and job queue processing
  4. E2E tests validate complete flows from event trigger to suggestion delivery
  5. Testing page at `/test` allows manual testing of all handlers without Slack
  6. Testing page can simulate app_mention, message events, and shortcut triggers
  7. Testing page can test AI generation directly with custom prompts
  8. All tests pass in CI/CD pipeline
**Plans**: 10 plans in 4 waves

Plans:
- [x] 02.1-01-PLAN.md — Vitest infrastructure with MSW and PGlite helpers
- [x] 02.1-02-PLAN.md — Unit tests for AI service and watch service
- [x] 02.1-03-PLAN.md — Unit tests for context and suggestion delivery services
- [x] 02.1-04-PLAN.md — Unit tests for OAuth installation store
- [x] 02.1-05-PLAN.md — Unit tests for event handlers and commands
- [x] 02.1-06-PLAN.md — Unit tests for actions, views, and shortcuts
- [x] 02.1-07-PLAN.md — Integration tests for database and job queue
- [x] 02.1-08-PLAN.md — E2E tests for complete flows
- [x] 02.1-09-PLAN.md — Manual testing page at /test
- [x] 02.1-10-PLAN.md — GitHub Actions CI/CD workflow

### Phase 3: AI Personalization
**Goal**: AI matches user's personal communication style through learning and explicit guidance
**Depends on**: Phase 2.1
**Requirements**: AI-03, AI-04, AI-05, AI-06, AI-07, AI-08
**Success Criteria** (what must be TRUE):
  1. User can provide explicit style guidance (tone, formality, phrases to use/avoid) via web portal
  2. AI applies explicit style guidance when generating suggestions
  3. AI analyzes user's historical Slack messages and generates suggestions matching their vocabulary and phrasing patterns
  4. System tracks how user modifies suggestions during refinement and improves future suggestions based on feedback patterns
**Plans**: 7 plans in 3 waves

Plans:
- [x] 03-01-PLAN.md — Database schema migration for personalization tables and pgvector
- [x] 03-02-PLAN.md — Style preferences service with Zod validation
- [x] 03-03-PLAN.md — Refinement feedback tracking service
- [x] 03-04-PLAN.md — GDPR consent service for message history access
- [x] 03-05-PLAN.md — Historical message embedding and semantic search
- [x] 03-06-PLAN.md — Style context builder combining three learning sources
- [x] 03-07-PLAN.md — AI service integration with prompt caching

### Phase 4: Web Portal
**Goal**: User can configure app, view context history, and manage settings via web dashboard
**Depends on**: Phase 1
**Requirements**: PORTAL-01, PORTAL-02, PORTAL-03, PORTAL-04, PORTAL-05, PORTAL-06, PORTAL-07, PORTAL-08, PORTAL-09, PORTAL-10
**Success Criteria** (what must be TRUE):
  1. User can sign in to web portal using Slack OAuth
  2. User can view dashboard showing what AI has learned from their conversations
  3. User can see conversation summaries for each monitored channel and person
  4. User can provide AI training feedback explaining why a suggestion didn't work
  5. User can add context or background information for specific people they communicate with
  6. User can configure personality and tone settings that persist across sessions
  7. User can view and manage all monitored channels and watched conversations from web
  8. User can configure weekly report settings including schedule, format, and recipients
**Plans**: 10 plans in 5 waves

Plans:
- [x] 04-01-PLAN.md — Next.js app scaffolding with shadcn/ui and monorepo integration
- [x] 04-02-PLAN.md — Database schema update for personContext table
- [x] 04-03-PLAN.md — Slack OAuth authentication with JWT sessions
- [x] 04-04-PLAN.md — Dashboard layout with sidebar and home page
- [x] 04-05-PLAN.md — Style settings page with form validation
- [x] 04-06-PLAN.md — Conversations management page
- [x] 04-07-PLAN.md — People context management page
- [x] 04-08-PLAN.md — AI learning feedback history page
- [x] 04-09-PLAN.md — Weekly reports settings page
- [ ] 04-10-PLAN.md — Human verification checkpoint

### Phase 5: Weekly Reports
**Goal**: User receives automated weekly team reports aggregated from workflow submissions via Google Sheets
**Depends on**: Phase 2, Phase 4
**Requirements**: REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, REPORT-07, REPORT-08, REPORT-09, REPORT-10
**Success Criteria** (what must be TRUE):
  1. User can connect Google account via OAuth for Sheets access
  2. App monitors designated channel for Slack workflow form submissions from direct reports
  3. App writes each submission to connected Google Sheet automatically
  4. App tracks which team members have submitted weekly updates (via Google Sheet)
  5. App reads and aggregates submissions from Google Sheet
  6. AI summarizes submissions into board-ready format with achievements, focus, blockers, and shoutouts
  7. User can manually trigger report generation via slash command
  8. User can configure scheduled automatic report generation (day and time)
  9. App sends draft report to user via DM for review before copying
  10. User can refine report draft before copying
**Plans**: 9 plans in 6 waves

Plans:
- [x] 05-01-PLAN.md — Database schema and Google OAuth service
- [x] 05-02-PLAN.md — Google OAuth web route integration
- [x] 05-03-PLAN.md — Workflow submission detection and Sheets write service
- [x] 05-04-PLAN.md — Report generator service with AI summarization
- [x] 05-05-PLAN.md — /generate-report slash command
- [x] 05-06-PLAN.md — Scheduled report generation (BullMQ Job Schedulers)
- [x] 05-07-PLAN.md — Report delivery and refinement modal
- [x] 05-08-PLAN.md — Web portal spreadsheet and workflow configuration
- [ ] 05-09-PLAN.md — Final integration and human verification

### Phase 6: Production Polish & Admin
**Goal**: Fix production bugs, improve UX, and add admin management capabilities
**Depends on**: Phase 5
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07
**Success Criteria** (what must be TRUE):
  1. Bot only responds to messages in channels where /watch is active (not on app_mention alone)
  2. Bot does not respond to user's own messages
  3. /watch works correctly in DM conversations
  4. Web portal shows channel names instead of channel IDs
  5. Conversations page allows inline context, suggest, refine, and training actions
  6. AI Learning tab shows accurate feedback types (accepted vs refined) with timestamps
  7. Admin can view and manage organizations, users, and billing
**Plans**: 9 plans in 6 waves

Plans:
- [x] 06-01-PLAN.md — Fix app_mention to check /watch status before triggering
- [x] 06-02-PLAN.md — Fix own-message filtering and DM watch support
- [x] 06-03-PLAN.md — Suggestion feedback schema and tracking service
- [x] 06-04-PLAN.md — Wire feedback tracking into action handlers
- [x] 06-05-PLAN.md — AI Learning tab with accepted vs refined stats
- [x] 06-06-PLAN.md — Conversations page with cached names and actions
- [x] 06-07-PLAN.md — Admin foundation with org schema and auth middleware
- [x] 06-08-PLAN.md — Admin organization and user management pages
- [x] 06-09-PLAN.md — Stripe billing integration with Customer Portal

### Phase 7: Monetization & Pricing
**Goal**: Complete monetization flow with SEO-driven public pages, pricing, trial management, and subscription lifecycle
**Depends on**: Phase 6
**Requirements**: BILLING-01, BILLING-02, BILLING-03, BILLING-04, BILLING-05, BILLING-06, BILLING-07, SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, SEO-06
**Success Criteria** (what must be TRUE):
  1. Public pricing page shows plans with features and SEO-optimized content
  2. Landing page has FAQ section with FAQPage schema markup
  3. Speakable and SoftwareApplication JSON-LD schemas implemented
  4. Users can start a free trial without payment (14 days)
  5. Trial expiration prompts upgrade or feature lockout
  6. Stripe Checkout creates subscription on upgrade
  7. Webhooks handle subscription lifecycle (upgrade, downgrade, cancel, failed payment)
  8. Usage tracking enforces seat limits
  9. Sitemap.xml and robots.txt configured for SEO
  10. Core Web Vitals optimized for SEO ranking
**Plans**: 7 plans in 4 waves

Plans:
- [x] 07-01-PLAN.md — Pricing page with SoftwareApplication, Organization, Speakable JSON-LD schemas
- [x] 07-02-PLAN.md — Landing page FAQ and SEO files (sitemap, robots)
- [x] 07-03-PLAN.md — Trial checkout without payment required
- [x] 07-04-PLAN.md — Full webhook subscription lifecycle handling
- [x] 07-05-PLAN.md — Seat enforcement and trial status display
- [x] 07-06-PLAN.md — Final verification and Core Web Vitals check
- [x] 07-07-PLAN.md — Email notifications for billing events (Resend)

### Phase 8: Production Security & Compliance
**Goal**: GDPR compliance, security hardening, and production-ready infrastructure
**Depends on**: Phase 7
**Requirements**: GDPR-01, GDPR-02, GDPR-03, SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Privacy Policy and Terms of Service pages exist and are linked from footer
  2. Users can export all their data via API endpoint
  3. Users can delete their account and all associated data ("right to be forgotten")
  4. Cookie consent banner appears for tracking cookies (if any)
  5. Security headers (CSP, HSTS, X-Frame-Options) configured on all responses
  6. Rate limiting protects all public endpoints from abuse
  7. Audit logging tracks security-relevant events (logins, data exports, deletions)
  8. Dependency vulnerability scanning runs in CI pipeline
**Plans**: 7 plans in 2 waves

Plans:
- [x] 08-01-PLAN.md — Security headers and cookie consent banner
- [x] 08-02-PLAN.md — Audit logs schema and logger service
- [x] 08-03-PLAN.md — Rate limiting middleware with Redis store
- [x] 08-04-PLAN.md — Privacy Policy and Terms of Service pages with footer
- [x] 08-05-PLAN.md — GDPR data export endpoint
- [x] 08-06-PLAN.md — GDPR data deletion endpoint
- [x] 08-07-PLAN.md — CI vulnerability scanning workflow

### Phase 9: Portal/Admin UX Polish
**Goal**: Apply brand styling throughout dashboard and improve admin navigation
**Depends on**: Phase 8
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Dashboard uses warm cream background (#FFFDF7) and blue-indigo gradient accents
  2. Admin sidebar shows expandable subpages (Organizations, Users, Billing)
  3. Dashboard is fully responsive on mobile devices
  4. Loading states and error handling provide clear feedback to users
  5. Consistent button styles (gradient CTAs, ghost secondary) across all pages
  6. Cards use consistent shadow and hover effects
**Plans**: 5 plans in 3 waves

Plans:
- [x] 09-01-PLAN.md — Brand colors, gradient button, card hover effects
- [x] 09-02-PLAN.md — Expandable admin navigation with NavGroup
- [x] 09-03-PLAN.md — Mobile responsive layout with drawer navigation
- [x] 09-04-PLAN.md — Loading skeletons and error boundaries
- [x] 09-05-PLAN.md — Human verification checkpoint

### Phase 10: Calendar Integration
**Goal**: AI can check calendar availability and suggest meeting times in responses
**Depends on**: Phase 9
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05
**Success Criteria** (what must be TRUE):
  1. User can connect Google Calendar via OAuth from web portal
  2. AI detects meeting requests in conversation context
  3. AI checks user's calendar availability for suggested time slots
  4. AI includes 2-3 available time slots in response suggestions when relevant
  5. User can configure calendar preferences (working hours, timezone, buffer time)
  6. Meeting creation action available after copying suggestion
**Plans**: TBD (run /gsd:plan-phase 10 to break down)

Plans:
- [ ] TBD

### Phase 11: Individual Billing
**Goal**: Users can pay for personal subscriptions independent of organization billing
**Depends on**: Phase 9
**Requirements**: IND-01, IND-02, IND-03, IND-04, IND-05
**Success Criteria** (what must be TRUE):
  1. User can subscribe personally without requiring org admin approval
  2. Individual subscription works across any Slack workspace user is part of
  3. Stripe checkout flow supports individual vs org billing modes
  4. User can manage their personal subscription (upgrade, cancel) from portal
  5. System correctly identifies if user has individual sub OR org-provided access
  6. Pricing page clearly shows individual vs team/org pricing options
  7. Individual users see simplified dashboard (no admin features)
**Plans**: TBD (run /gsd:plan-phase 11 to break down)

Plans:
- [ ] TBD

### Phase 12: Client Support Features
**Goal**: Features specifically for teams providing client support via Slack
**Depends on**: Phase 11
**Requirements**: SUPPORT-01, SUPPORT-02, SUPPORT-03, SUPPORT-04, SUPPORT-05, SUPPORT-06
**Success Criteria** (what must be TRUE):
  1. AI detects tension/frustration in client messages and suggests de-escalation responses
  2. Org admin can create brand voice templates with approved response patterns
  3. AI applies org brand voice guidelines when generating suggestions
  4. System tracks sentiment trends in client conversations over time
  5. Escalation alerts flag messages that may lead to disputes
  6. Audit log tracks AI-assisted responses for compliance review
  7. Knowledge base integration allows AI to reference product/service info
**Plans**: TBD (run /gsd:plan-phase 12 to break down)

Plans:
- [ ] TBD

### Phase 13: Team/Org Dashboard
**Goal**: Admin dashboard with team analytics, controls, and compliance features
**Depends on**: Phase 12
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06
**Success Criteria** (what must be TRUE):
  1. Org admin can view communication analytics across team members
  2. Admin can set org-wide style guidelines that apply to all users
  3. Admin can manage YOLO mode permissions (enable/disable per user or globally)
  4. Admin can view compliance audit trail of AI-assisted responses
  5. Admin can create and manage shared response templates
  6. Dashboard shows team adoption metrics and usage statistics
  7. Admin can configure content guardrails and prohibited topics
**Plans**: TBD (run /gsd:plan-phase 13 to break down)

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 2.1 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 5/5 | Complete | 2026-01-26 |
| 2. Core Slack Response Suggestions | 9/9 | Complete | 2026-01-26 |
| 2.1. Testing Infrastructure | 10/10 | Complete | 2026-01-26 |
| 3. AI Personalization | 7/7 | Complete | 2026-01-26 |
| 4. Web Portal | 9/10 | In progress | - |
| 5. Weekly Reports | 8/9 | Human verification | - |
| 6. Production Polish & Admin | 9/9 | Complete | 2026-02-01 |
| 7. Monetization & Pricing | 7/7 | Complete | 2026-02-01 |
| 8. Production Security & Compliance | 7/7 | Complete | 2026-02-01 |
| 9. Portal/Admin UX Polish | 5/5 | Complete | 2026-02-02 |
| 10. Calendar Integration | 0/? | Deferred | - |
| 11. Individual Billing | 0/? | Not started | - |
| 12. Client Support Features | 0/? | Not started | - |
| 13. Team/Org Dashboard | 0/? | Not started | - |

---
*Roadmap created: 2026-01-26*
*Last updated: 2026-02-02*
