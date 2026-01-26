# Slack Speak for Me

## What This Is

An AI-powered Slack integration that helps professionals communicate more effectively in workplace conversations. The app monitors designated channels and conversations, learns the user's communication style, and suggests contextually-aware responses — particularly valuable when navigating difficult colleagues or politically sensitive situations. Also automates weekly team report generation for board updates.

## Core Value

When a challenging message arrives, the user gets an intelligent suggested response that sounds like them, considers full context, and helps them respond professionally without emotional reactivity.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Slack app that monitors channels/conversations user adds it to
- [ ] Proactive response suggestions via ephemeral messages when user is mentioned, replied to, or in active thread
- [ ] Message action ("Help me respond") for manual triggering in DMs
- [ ] Modal-based refinement flow for back-and-forth with AI to adjust suggestions
- [ ] Copy-to-clipboard for final response (user sends as themselves)
- [ ] Context gathering from monitored channels to inform suggestions
- [ ] Personality/tonality learning from user's message history
- [ ] Explicit personality guidance configuration
- [ ] Learning from refinement feedback over time
- [ ] Toggle controls to watch/unwatch specific conversations
- [ ] Weekly report automation — aggregate team workflow submissions
- [ ] Report triggers: manual, all reports in, or scheduled
- [ ] Report summarization into board-ready format
- [ ] Web portal: context history and summaries
- [ ] Web portal: AI training and feedback interface
- [ ] Web portal: personality/tonality settings
- [ ] Web portal: channel and people management
- [ ] Web portal: billing (individual and org accounts)
- [ ] Subscription-based pricing per seat
- [ ] Usage-based pricing for AI token costs
- [ ] Slack App Store distribution

### Out of Scope

- Auto-sending messages as user — Slack ToS prohibits impersonation
- Browser automation / Selenium — violates Slack ToS, disqualifies from App Store
- Browser extension for Slack automation — same ToS issues
- Real-time voice/video integration — text-based only

## Context

**Origin:** The founder frequently deals with abrasive colleagues (e.g., CMO who bypasses roadmap processes). Current workflow involves copying messages to ChatGPT, iterating on responses, then pasting back. This app eliminates that friction.

**Example scenario:** CMO sends challenging message reframing a request to bypass established processes. App suggests response that considers: (1) the message content, (2) previous CEO guidance to push back, (3) user's typical communication style. User refines if needed, copies, sends.

**Weekly reports workflow:** Direct reports submit weekly updates via Slack workflow form (achievements, focus, blockers, shoutouts). Currently exported to CSV, pasted to AI, formatted, reviewed, then shared. App automates aggregation and formatting.

**Slack API constraints:**
- Apps cannot post as users (no impersonation)
- DM monitoring requires explicit user action (message action trigger)
- Channel monitoring requires app to be added to channel
- Ephemeral messages only visible to target user

## Constraints

- **Platform**: Must comply with Slack API terms and App Store requirements
- **Privacy**: Conversation data stored must align with Slack's data policies
- **AI costs**: Token usage passed to customer, not absorbed by platform
- **User agency**: User always sends final message themselves (copy/paste)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Copy/paste for sending | Slack prohibits apps posting as users | — Pending |
| Message action for DMs | Can't passively monitor 1:1 DMs without visibility | — Pending |
| Hybrid pricing model | AI token costs must be customer-borne | — Pending |
| Three-source personality learning | History + explicit + feedback covers cold start and evolution | — Pending |

---
*Last updated: 2025-01-26 after initialization*
