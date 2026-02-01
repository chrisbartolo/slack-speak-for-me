# Roadmap: Slack Speak for Me

## Overview

This roadmap delivers an AI-powered Slack integration that helps professionals craft contextually-aware responses to challenging workplace messages. The journey starts with secure infrastructure and OAuth foundation, builds core Slack response suggestion features, adds AI personalization through style learning, provides a web portal for configuration and management, and completes with team report automation. Each phase delivers independently verifiable user value while avoiding critical security and compliance pitfalls identified during research.

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
- [ ] **Phase 6: Production Polish & Admin** - Bug fixes, UX improvements, and admin management

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
- [ ] 06-01-PLAN.md — Fix app_mention to check /watch status before triggering
- [ ] 06-02-PLAN.md — Fix own-message filtering and DM watch support
- [ ] 06-03-PLAN.md — Suggestion feedback schema and tracking service
- [ ] 06-04-PLAN.md — Wire feedback tracking into action handlers
- [ ] 06-05-PLAN.md — AI Learning tab with accepted vs refined stats
- [ ] 06-06-PLAN.md — Conversations page with cached names and actions
- [ ] 06-07-PLAN.md — Admin foundation with org schema and auth middleware
- [ ] 06-08-PLAN.md — Admin organization and user management pages
- [ ] 06-09-PLAN.md — Stripe billing integration with Customer Portal

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 2.1 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 5/5 | Complete | 2026-01-26 |
| 2. Core Slack Response Suggestions | 9/9 | Complete | 2026-01-26 |
| 2.1. Testing Infrastructure | 10/10 | Complete | 2026-01-26 |
| 3. AI Personalization | 7/7 | Complete | 2026-01-26 |
| 4. Web Portal | 9/10 | In progress | - |
| 5. Weekly Reports | 8/9 | Human verification | - |
| 6. Production Polish & Admin | 0/9 | Not started | - |

---
*Roadmap created: 2026-01-26*
*Last updated: 2026-02-01*
