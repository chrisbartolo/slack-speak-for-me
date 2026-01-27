# Phase 4: Web Portal - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Web dashboard where users sign in via Slack OAuth, configure personality/tone settings, view what AI has learned from their conversations, manage watched channels, add context about people they communicate with, and configure weekly report settings.

</domain>

<decisions>
## Implementation Decisions

### Tech Stack
- Next.js for frontend (React SSR, API routes, matches Node ecosystem)
- Slack OAuth for authentication (reuse existing OAuth flow, no separate credentials)
- Tailwind CSS for styling (utility-first, rapid development)
- Deployed alongside or integrated with existing slack-backend

### Dashboard Layout
- Sidebar navigation with clear sections: Dashboard, Style Settings, Conversations, People, Reports
- Dashboard home shows: personalization status, recent activity summary, quick actions
- Mobile-responsive but desktop-primary (users manage settings from computer)

### Style Settings UX
- Tone: dropdown with options (Professional, Friendly, Direct, Empathetic)
- Formality: slider or radio buttons (Casual → Formal)
- Phrases to use: tag input with autocomplete from detected patterns
- Phrases to avoid: same tag input pattern
- Custom guidance: textarea with character limit (500 chars, per existing schema)
- Save as draft vs publish changes pattern

### Learning Visibility
- Simple summary view by default: "You tend to be [tone] and [formality]. Common phrases: [top 3]"
- Expandable details for power users: message count analyzed, confidence level, example excerpts
- Learning phase indicator: "Early learning (15 messages)" → "Personalized (150+ messages)"
- No raw data dumps — always human-readable summaries

### Channel/Person Management
- List view for channels with toggle switches (watching/not watching)
- Search/filter for users with many channels
- "Add context" button per person opens modal/drawer
- Person context: free-text notes about relationship, communication preferences, background

### Conversation Summaries
- Per-channel: last activity, message count, watch status
- Per-person (from DM interactions): relationship context, communication history summary
- Suggestion history: recent suggestions generated, refinement counts

### Weekly Report Settings
- Day/time picker for scheduled generation
- Recipients list (Slack user IDs)
- Format preferences: sections to include, length (concise/detailed)
- Toggle: auto-send draft vs wait for approval

### Authentication Flow
- "Sign in with Slack" button using existing OAuth
- Session management with secure cookies
- Redirect to dashboard after successful auth
- Workspace context from OAuth token

### Claude's Discretion
- Exact color scheme and visual design details
- Animation and transition choices
- Error message wording
- Loading state implementations
- Exact component library choice within Tailwind ecosystem

</decisions>

<specifics>
## Specific Ideas

- Keep it simple and functional — this is a configuration tool, not a showpiece
- Prioritize clarity over cleverness in the UI
- Users should be able to configure everything in under 5 minutes
- Show immediate feedback when settings are saved

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-web-portal*
*Context gathered: 2026-01-27*
