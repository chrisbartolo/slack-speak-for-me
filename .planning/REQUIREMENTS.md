# Requirements: Slack Speak for Me

**Defined:** 2025-01-26
**Core Value:** When a challenging message arrives, the user gets an intelligent suggested response that sounds like them, considers full context, and helps them respond professionally without emotional reactivity.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Slack Integration

- [ ] **SLACK-01**: App can be added to channels and group conversations for monitoring
- [ ] **SLACK-02**: App sends ephemeral suggestion when user is mentioned in monitored conversation
- [ ] **SLACK-03**: App sends ephemeral suggestion when someone replies to user's message
- [ ] **SLACK-04**: App sends ephemeral suggestion when new message appears in thread user participates in
- [ ] **SLACK-05**: User can trigger suggestion via message action (right-click → "Help me respond")
- [ ] **SLACK-06**: Ephemeral message includes suggested response text
- [ ] **SLACK-07**: Ephemeral message includes "Refine" button to open modal
- [ ] **SLACK-08**: Ephemeral message includes "Copy" button to copy response to clipboard
- [ ] **SLACK-09**: Modal allows back-and-forth conversation with AI to adjust suggestion
- [ ] **SLACK-10**: Modal shows updated suggestion after each refinement exchange
- [ ] **SLACK-11**: Modal includes "Copy final" button when user is satisfied
- [ ] **SLACK-12**: User can toggle "watch" on specific conversations via slash command or message action
- [ ] **SLACK-13**: User can toggle "unwatch" on specific conversations
- [ ] **SLACK-14**: OAuth flow for Slack workspace installation

### AI & Personalization

- [ ] **AI-01**: AI considers messages from monitored channels when generating suggestions
- [ ] **AI-02**: AI maintains context window of recent relevant messages per conversation
- [ ] **AI-03**: User can provide explicit style guidance (tone, formality, patterns to use/avoid)
- [ ] **AI-04**: AI applies explicit style guidance when generating suggestions
- [ ] **AI-05**: App analyzes user's historical messages to learn their communication patterns
- [ ] **AI-06**: AI generates suggestions that match user's typical vocabulary and phrasing
- [ ] **AI-07**: App tracks how user modifies suggestions during refinement
- [ ] **AI-08**: AI improves future suggestions based on refinement feedback patterns

### Weekly Reports

- [ ] **REPORT-01**: App monitors Slack workflow form submissions from designated channel
- [ ] **REPORT-02**: App writes each submission to connected Google Sheet
- [ ] **REPORT-03**: App tracks which direct reports have submitted weekly updates (via Google Sheet)
- [ ] **REPORT-04**: App reads and aggregates submissions from Google Sheet
- [ ] **REPORT-05**: AI summarizes submissions into board-ready format (achievements, focus, blockers, shoutouts)
- [ ] **REPORT-06**: User can manually trigger report generation via slash command
- [ ] **REPORT-07**: User can configure scheduled report generation (day and time)
- [ ] **REPORT-08**: App sends draft report to user via DM or ephemeral message
- [ ] **REPORT-09**: User can refine report draft before copying
- [ ] **REPORT-10**: Google OAuth flow for Sheets access

### Web Portal

- [ ] **PORTAL-01**: User can sign in via Slack OAuth
- [ ] **PORTAL-02**: Dashboard shows context history (what AI has learned from conversations)
- [ ] **PORTAL-03**: Dashboard shows conversation summaries per monitored channel/person
- [ ] **PORTAL-04**: User can provide AI training feedback (why a suggestion didn't work)
- [ ] **PORTAL-05**: User can add context or background information for specific people
- [ ] **PORTAL-06**: User can configure personality/tone settings
- [ ] **PORTAL-07**: User can set default response style preferences
- [ ] **PORTAL-08**: User can view and manage monitored channels from web
- [ ] **PORTAL-09**: User can view and manage watched/unwatched conversations from web
- [ ] **PORTAL-10**: User can configure weekly report settings (schedule, format, recipients)

### Infrastructure

- [ ] **INFRA-01**: Secure token storage for Slack OAuth tokens
- [ ] **INFRA-02**: Multi-tenant data isolation (workspace-level separation)
- [ ] **INFRA-03**: Background job processing for AI requests (Slack 3-second timeout)
- [ ] **INFRA-04**: Input sanitization to prevent prompt injection
- [ ] **INFRA-05**: Rate limiting per workspace
- [ ] **INFRA-06**: Error handling with graceful degradation

### Testing

- [ ] **TEST-01**: Unit tests for all services with 90%+ code coverage
- [ ] **TEST-02**: Unit tests mock external dependencies (Slack API, Anthropic API, database)
- [ ] **TEST-03**: Integration tests for database operations and job queue
- [ ] **TEST-04**: E2E tests for complete flows from event to suggestion delivery
- [ ] **TEST-05**: Testing page at `/test` for manual testing without Slack

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Billing

- **BILL-01**: Individual user account signup and payment
- **BILL-02**: Organization account with seat management
- **BILL-03**: Subscription billing per seat (monthly/annual)
- **BILL-04**: Usage-based billing for AI token consumption
- **BILL-05**: Usage dashboard showing token consumption
- **BILL-06**: Billing management portal (invoices, payment methods)

### Advanced Features

- **ADV-01**: Team-wide style guides (organization-level tone settings)
- **ADV-02**: Admin dashboard for organization accounts
- **ADV-03**: Analytics on response acceptance rates
- **ADV-04**: Multiple AI model options (quality vs speed tradeoff)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auto-send messages as user | Slack ToS prohibits impersonation |
| Browser automation / Selenium | Violates Slack ToS, disqualifies from App Store |
| Browser extension for Slack | Same ToS issues |
| Real-time voice/video | Text-based only for v1 |
| Training LLM on customer data | Slack prohibition + privacy compliance |
| General-purpose chatbot | Scope creep, different product |
| Sentiment analysis dashboard | Nice-to-have, not core value |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Pending |
| SLACK-14 | Phase 1 | Pending |
| SLACK-01 | Phase 2 | Pending |
| SLACK-02 | Phase 2 | Pending |
| SLACK-03 | Phase 2 | Pending |
| SLACK-04 | Phase 2 | Pending |
| SLACK-05 | Phase 2 | Pending |
| SLACK-06 | Phase 2 | Pending |
| SLACK-07 | Phase 2 | Pending |
| SLACK-08 | Phase 2 | Pending |
| SLACK-09 | Phase 2 | Pending |
| SLACK-10 | Phase 2 | Pending |
| SLACK-11 | Phase 2 | Pending |
| SLACK-12 | Phase 2 | Pending |
| SLACK-13 | Phase 2 | Pending |
| AI-01 | Phase 2 | Pending |
| AI-02 | Phase 2 | Pending |
| AI-03 | Phase 3 | Pending |
| AI-04 | Phase 3 | Pending |
| AI-05 | Phase 3 | Pending |
| AI-06 | Phase 3 | Pending |
| AI-07 | Phase 3 | Pending |
| AI-08 | Phase 3 | Pending |
| PORTAL-01 | Phase 4 | Pending |
| PORTAL-02 | Phase 4 | Pending |
| PORTAL-03 | Phase 4 | Pending |
| PORTAL-04 | Phase 4 | Pending |
| PORTAL-05 | Phase 4 | Pending |
| PORTAL-06 | Phase 4 | Pending |
| PORTAL-07 | Phase 4 | Pending |
| PORTAL-08 | Phase 4 | Pending |
| PORTAL-09 | Phase 4 | Pending |
| PORTAL-10 | Phase 4 | Pending |
| REPORT-01 | Phase 5 | Pending |
| REPORT-02 | Phase 5 | Pending |
| REPORT-03 | Phase 5 | Pending |
| REPORT-04 | Phase 5 | Pending |
| REPORT-05 | Phase 5 | Pending |
| REPORT-06 | Phase 5 | Pending |
| REPORT-07 | Phase 5 | Pending |
| REPORT-08 | Phase 5 | Pending |
| REPORT-09 | Phase 5 | Pending |
| REPORT-10 | Phase 5 | Pending |
| TEST-01 | Phase 2.1 | Pending |
| TEST-02 | Phase 2.1 | Pending |
| TEST-03 | Phase 2.1 | Pending |
| TEST-04 | Phase 2.1 | Pending |
| TEST-05 | Phase 2.1 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0

---
*Requirements defined: 2025-01-26*
*Last updated: 2026-01-26 after roadmap creation*
