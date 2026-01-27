---
phase: 05-weekly-reports
plan: 05
subsystem: slack-integration
tags: [slash-commands, job-queue, async-processing, dm-delivery, block-kit]
requires: [05-04]
provides:
  - "Manual report generation via /generate-report"
  - "Report generation job queue and worker"
  - "Async report delivery via DM"
tech-stack:
  added: []
  patterns:
    - "Response URL pattern for slash command feedback"
    - "Job queue with response URL propagation"
key-files:
  created:
    - apps/slack-backend/src/handlers/commands/generate-report.ts
  modified:
    - apps/slack-backend/src/jobs/types.ts
    - apps/slack-backend/src/jobs/queues.ts
    - apps/slack-backend/src/jobs/workers.ts
    - apps/slack-backend/src/handlers/commands/index.ts
    - apps/slack-backend/src/handlers/index.ts
    - apps/slack-backend/src/app.ts
decisions:
  - what: "Store spreadsheetId in googleIntegrations table"
    why: "Single source of truth for user's configured spreadsheet"
    impact: "Command checks googleIntegrations.spreadsheetId field"
  - what: "Rate limit at 5 reports per minute"
    why: "Prevents API abuse while allowing reasonable burst usage"
    impact: "Worker limiter configuration"
  - what: "Response URL for slash command feedback"
    why: "Provides user feedback after async job completes"
    impact: "Job data includes responseUrl field, worker POSTs success/error"
metrics:
  duration: "3.5 min"
  completed: 2026-01-27
---

# Phase 05 Plan 05: Manual Report Generation Summary

**One-liner:** /generate-report slash command queues async job to generate and DM weekly report with Block Kit formatting

## What Was Built

Implemented manual weekly report generation triggered via slash command with async job processing and DM delivery.

### Key Components

1. **Report Generation Job Queue**
   - ReportGenerationJobData and ReportGenerationJobResult types
   - reportQueue with retry logic (3 attempts, exponential backoff)
   - queueReportGeneration helper function

2. **Report Generation Worker**
   - Processes report generation jobs asynchronously
   - Calls generateWeeklyReport service function
   - Formats report with Block Kit (header, sections, missing submitters warning)
   - Delivers via DM to user
   - Posts feedback to response URL if provided
   - Rate limited to 5 reports per minute

3. **/generate-report Slash Command**
   - Acknowledges immediately (meets 3-second requirement)
   - Validates Google integration exists
   - Validates spreadsheet is configured
   - Queues report generation job with response URL
   - Provides helpful error messages for missing configuration

## Deviations from Plan

None - plan executed exactly as written.

## Testing Evidence

**Build verification:**
```bash
npm run build --workspace=slack-backend
✓ TypeScript compilation successful
```

**Commit verification:**
- 5876c0f: feat(05-05): add report generation job types and queue
- c52f86d: feat(05-05): create report generation worker
- e93c270: feat(05-05): create /generate-report slash command

## Implementation Notes

### Slash Command Flow

1. User runs `/generate-report` in Slack
2. Command handler:
   - Immediately acknowledges (ack())
   - Queries googleIntegrations for user's config
   - Returns helpful error if no integration or spreadsheet
   - Queues job with workspaceId, userId, spreadsheetId, responseUrl
   - Responds with "generating..." message

3. Worker processes job:
   - Calls generateWeeklyReport service
   - Fetches installation token (for bot permissions)
   - Formats report with Block Kit
   - Sends DM to user
   - POSTs success message to responseUrl

### Block Kit Format

```
┌─────────────────────────────┐
│ 📊 Weekly Report            │  (header)
├─────────────────────────────┤
│ [AI-generated report text]  │  (section)
│                              │
│ ⚠️ Missing submissions: ... │  (section, conditional)
│                              │
│ Generated in Xms | Use...   │  (context)
└─────────────────────────────┘
```

### Error Handling

- **No Google integration:** "Please connect your Google account first via the web portal"
- **No spreadsheet configured:** "Please set up your report spreadsheet in the web portal first"
- **Generation failure:** Worker catches error, posts failure message to responseUrl
- **Delivery failure:** Logged but doesn't fail the job

### Rate Limiting

Worker configured with:
- Concurrency: 2 (process 2 jobs in parallel)
- Limiter: 5 reports per 60000ms (per minute)

Prevents API abuse while allowing reasonable burst usage for teams.

## Architecture Decisions

### Response URL Pattern

Used Slack's response_url feature to provide feedback after async job completes:

1. Slash command receives response_url in payload
2. Pass response_url through job data
3. Worker POSTs success/error message after completion

**Benefit:** User sees "generating..." immediately, then receives "sent to DMs!" when ready.

### Single Spreadsheet Source

Store spreadsheetId in `googleIntegrations.spreadsheetId` instead of separate table:

**Why:**
- Single source of truth
- Simpler schema (one less table)
- Spreadsheet is tied to Google integration lifecycle

**Alternative considered:** Separate `reportSheetConfigs` table for multi-sheet support.
**Decision:** Keep simple for v1, can add later if needed.

## Next Phase Readiness

**Unblocks:**
- 05-07: Scheduled Report Generation (uses same worker, just triggered by cron)

**Requires from next phase:**
- None - manual generation is complete and standalone

**Potential issues:**
- None anticipated

## Success Metrics

✅ All verification criteria met:
- /generate-report slash command registered
- Command acknowledges within 3 seconds
- Validates Google connection before proceeding
- Report generation queued asynchronously
- Worker generates report using configured format/sections
- Report delivered via DM with Block Kit formatting
- Response URL used for slash command feedback

✅ All tasks completed:
1. Report generation job types and queue
2. Report generation worker with DM delivery
3. /generate-report slash command

**Build:** ✅ Compiles successfully
**Commits:** ✅ 3 atomic commits (types/queue, worker, command)
**Integration:** ✅ Command registered in app.ts
