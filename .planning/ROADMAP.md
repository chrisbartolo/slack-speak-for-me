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
- [ ] **Phase 4: Web Portal** - Dashboard for settings, history, and management
- [ ] **Phase 5: Weekly Reports** - Automated team report aggregation and formatting

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
- [ ] 01-01-PLAN.md — Project scaffolding with monorepo, TypeScript, database schema with RLS
- [ ] 01-02-PLAN.md — OAuth installation store with AES-256-GCM token encryption
- [ ] 01-03-PLAN.md — BullMQ background job queue with rate limiting
- [ ] 01-04-PLAN.md — Input validation, prompt injection defense, error handling
- [ ] 01-05-PLAN.md — Integration wiring and OAuth flow verification

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
- [ ] 02-01-PLAN.md — Database schema for watched conversations and thread participation tracking
- [ ] 02-02-PLAN.md — AI suggestion service with Claude integration
- [ ] 02-03-PLAN.md — Context retrieval service with rate limiting
- [ ] 02-04-PLAN.md — Event handlers for app mentions and message replies
- [ ] 02-05-PLAN.md — /watch and /unwatch slash commands
- [ ] 02-06-PLAN.md — Ephemeral message delivery with Block Kit buttons
- [ ] 02-07-PLAN.md — "Help me respond" message shortcut and action handlers
- [ ] 02-08-PLAN.md — Refinement modal with multi-turn AI conversation
- [ ] 02-09-PLAN.md — End-to-end verification of all success criteria

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
**Plans**: TBD

Plans:
- [ ] To be created during plan-phase

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
**Plans**: TBD

Plans:
- [ ] To be created during plan-phase

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 2.1 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 5/5 | Complete | 2026-01-26 |
| 2. Core Slack Response Suggestions | 9/9 | Complete | 2026-01-26 |
| 2.1. Testing Infrastructure | 10/10 | Complete | 2026-01-26 |
| 3. AI Personalization | 7/7 | Complete | 2026-01-26 |
| 4. Web Portal | 0/TBD | Not started | - |
| 5. Weekly Reports | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-26*
*Last updated: 2026-01-26*
