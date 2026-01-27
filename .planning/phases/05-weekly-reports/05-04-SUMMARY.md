---
phase: 05-weekly-reports
plan: 04
subsystem: services, ai
tags: [anthropic, report-generation, google-sheets, ai-summarization, claude-sonnet-4]

# Dependency graph
requires:
  - phase: 05-03
    provides: Google Sheets getSubmissions() and WorkflowSubmission interface
provides:
  - AI-powered report generation from Google Sheets submissions
  - Missing submitter identification
  - Report settings retrieval with format and section customization
affects: [05-05-weekly-report-scheduling, 05-06-report-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [AI report summarization, Configurable report formatting]

key-files:
  created:
    - apps/slack-backend/src/services/report-generator.ts
    - apps/slack-backend/src/services/report-generator.test.ts
  modified:
    - apps/slack-backend/src/services/index.ts

key-decisions:
  - "Claude Sonnet 4 for report generation (same model used for suggestions)"
  - "Monday-based weeks via date-fns startOfWeek with weekStartsOn: 1"
  - "Format setting (concise/detailed) controls prompt instructions for AI"
  - "Sections setting filters which fields appear in report and prompt"
  - "2048 max tokens for reports (longer than suggestions due to aggregation)"

patterns-established:
  - "Report generation pattern: fetch submissions → build prompt with settings → AI summarize → return formatted text"
  - "Missing submitter identification: Set-based diff between team list and submitted IDs"
  - "Settings retrieval with defaults: database query with fallback to sensible defaults"

# Metrics
duration: 2min
completed: 2026-01-27
---

# Phase 05 Plan 04: AI Report Generation Summary

**AI-powered report generation service that aggregates Google Sheets submissions into board-ready format with customizable sections and style**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-27T14:08:24Z
- **Completed:** 2026-01-27T14:10:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Report generator service with 3 exported functions: generateWeeklyReport, getMissingSubmitters, getReportSettings
- AI summarization using Claude Sonnet 4 with configurable format (concise/detailed)
- Section filtering supports achievements, focus, blockers, shoutouts
- Monday-based week calculation with date-fns
- Comprehensive unit tests with 10 test cases covering all scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Create report generator service** - `5948d3f` (feat)
2. **Task 2: Add unit tests for report generator** - `3ba8e32` (test)

## Files Created/Modified

- `apps/slack-backend/src/services/report-generator.ts` - Report generator service with AI summarization
- `apps/slack-backend/src/services/report-generator.test.ts` - Unit tests with mocked Google Sheets and Anthropic API
- `apps/slack-backend/src/services/index.ts` - Added exports for report generator functions

## Decisions Made

**Claude Sonnet 4 for report generation**
- Uses same model as suggestion generation for consistency
- 2048 max tokens (vs 1024 for suggestions) to handle longer aggregated reports
- Single-turn generation sufficient for board reports (no refinement needed)

**Monday-based weeks**
- Uses date-fns startOfWeek with weekStartsOn: 1
- Aligns with business convention of Monday as week start
- Consistent with typical workflow submission patterns

**Format setting controls prompt instructions**
- 'concise': "Keep each section brief - use bullet points with 1-2 sentence summaries per major theme"
- 'detailed': "Provide comprehensive summaries with full context and details for each section"
- Setting retrieved from reportSettings table with default to 'detailed'

**Sections setting filters content**
- Controls which fields appear in both prompt and final report
- Default includes all four sections: achievements, focus, blockers, shoutouts
- Users can customize to show only relevant sections for their board
- Empty fields in submissions are gracefully skipped

**Missing submitter identification**
- Takes team member list as parameter (source TBD in future plans)
- Uses Set-based diff for O(n) performance
- Returns Slack user IDs for easy notification/reminder integration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Initial import path error**
- Used `../db.js` import instead of `@slack-speak/database`
- Fixed immediately by checking existing service patterns
- Build passed after correction

## Technical Implementation

**Report generation flow:**
1. Fetch submissions from Google Sheets via getSubmissions()
2. Return early if no submissions found this week
3. Retrieve user's report settings (format and sections)
4. Build AI prompt with format instructions and section filtering
5. Format submissions with submitter names and filtered fields
6. Call Claude Sonnet 4 with system and user prompts
7. Return formatted report with processing time

**Key implementation details:**
- Non-fatal settings retrieval: defaults used if database returns empty
- Week start defaults to current week Monday if not provided
- AI prompt includes week start date for context
- Prompt emphasizes "board-ready" and "executive presentation"
- Aggregation instruction: "Group by theme rather than by person"

**Test coverage:**
- Settings retrieval with defaults
- Missing submitter identification with partial submissions
- Report generation with multiple submissions
- Empty submissions early return
- Custom week start date handling
- Format and section settings affecting prompt construction
- Section filtering in submission data

## Next Phase Readiness

**Ready for next plan (05-05):**
- Report generator service operational and tested
- Format and section customization working
- Missing submitter identification available
- AI prompt properly structured for board presentation

**Next steps:**
- Plan 05-05 will add scheduled report generation via BullMQ cron
- Plan 05-06 will add UI for configuring report settings
- Future: Source of team member list needs determination (Google Sheets header? Slack user group? Manual config?)

**Outstanding questions:**
- Where should team member list come from for missing submitter tracking?
  - Option A: Parse from spreadsheet header row
  - Option B: Fetch from Slack user group
  - Option C: Manual configuration in UI
- Should reports include time range metadata in output?
- Should we support custom section names beyond the four defaults?

---
*Phase: 05-weekly-reports*
*Completed: 2026-01-27*
