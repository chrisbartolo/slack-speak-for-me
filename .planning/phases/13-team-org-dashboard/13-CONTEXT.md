# Phase 13: Team/Org Dashboard - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin dashboard for managing how AI assists team members. Covers team analytics, org-wide style controls, shared response templates, YOLO mode permissions, compliance audit trail, and content guardrails. Individual user features and client-facing features (Phase 12) are separate.

</domain>

<decisions>
## Implementation Decisions

### Analytics depth
- Team overview layout with summary cards + drill-down to individual users
- Key metrics: adoption rate (% of team actively using), acceptance vs refinement ratio (AI accuracy), response time impact (estimated time saved)
- 6-month historical data with trend charts
- CSV export button for reporting and presentations
- Drill-down from summary to per-user detail view

### Style & template controls
- Org-wide style guidelines interaction with user preferences is **configurable per org** — admin chooses the approach (override, layer, or fallback)
- Three configuration modes: "Org overrides user", "Org sets baseline, user customizes within bounds", "User preferences first, org fills gaps"
- Shared response templates support all three types:
  - Canned responses: Full pre-written responses for common situations
  - Response starters: Opening lines/frameworks that AI personalizes
  - Situation playbooks: Scenario-based guides with key points to hit
- Template creation: any team member can submit, admin reviews and approves before publishing
- YOLO mode (auto-send): available but admin-controlled — can enable/disable per user or globally, off by default

### Compliance & audit trail
- Comprehensive tracking: AI suggestions generated, user actions (accept/refine/dismiss with timestamps and final text), admin config changes
- Suggestion text visibility is **configurable AND plan-gated** — similar to Slack's tier-based access model:
  - Lower tiers: metadata only (who, when, channel, action)
  - Higher tiers: full text visibility (actual suggestion + refined version)
- Data retention is plan-based with 90-day cap:
  - Starter: 30 days
  - Pro: 90 days
  - Business/Enterprise: 90 days (cap — pay for extended if needed)
- CSV/PDF export for compliance reviews and reporting

### Content guardrails
- Dual approach: predefined topic categories + custom keyword blocklist
  - Predefined categories: legal advice, pricing commitments, competitor mentions, etc. — admin toggles on/off
  - Custom blocklist: admin adds org-specific words/phrases
- Guardrail trigger behavior is **configurable per org**:
  - Hard block: suppress suggestion, show warning
  - Warning + regenerate: AI regenerates without prohibited content, shows filter note
  - Soft warning: deliver suggestion with visible warning flag
- Violations logged in both the audit trail AND a dedicated guardrail violations report page with frequency stats and patterns
- Sensible defaults pre-configured for all new orgs (no legal advice, no pricing commitments, no competitor bashing) — admin can disable

### Claude's Discretion
- Chart/visualization library choice for trend analytics
- Exact template submission/approval workflow UI
- Guardrail category taxonomy (specific predefined categories)
- Audit trail pagination and filtering UX
- How "response time impact" is estimated from usage data

</decisions>

<specifics>
## Specific Ideas

- Audit trail access should mirror how Slack structures plan-based feature access — lower tiers get basic metadata, higher tiers get full content visibility
- Retention cap at 90 days to manage storage costs — extended retention as a paid add-on if customers request it
- YOLO mode is a real feature but needs admin guardrails — trust the admin to know their team

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-team-org-dashboard*
*Context gathered: 2026-02-03*
