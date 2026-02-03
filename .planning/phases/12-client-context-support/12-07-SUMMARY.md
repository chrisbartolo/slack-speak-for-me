---
phase: 12-client-context-support
plan: 07
subsystem: client-success
tags: [escalation, monitoring, alerting, sentiment-analysis, admin]
status: complete

# Dependency Graph
requires:
  - 12-06  # Sentiment analysis integration in AI service
provides:
  - Escalation alert creation on critical sentiment
  - Admin notification system via Slack DM
  - Background scanner for missed escalations
  - Admin dashboard for alert management
affects:
  - Future phases requiring escalation workflow (e.g., SLA tracking, account management integration)

# Tech Stack
tech-stack:
  added:
    - BullMQ repeatable jobs (15-minute scheduler)
  patterns:
    - Fire-and-forget escalation alerts (never block suggestion generation)
    - 4-hour cooldown per channel to prevent alert fatigue
    - Admin DM notifications via Slack WebClient

# File Tracking
key-files:
  created:
    - apps/slack-backend/src/services/escalation-monitor.ts
    - apps/slack-backend/src/jobs/escalation-scanner.ts
    - apps/web-portal/app/api/admin/escalations/route.ts
    - apps/web-portal/app/api/admin/escalations/[id]/route.ts
    - apps/web-portal/app/admin/escalations/page.tsx
  modified:
    - apps/slack-backend/src/services/index.ts
    - apps/slack-backend/src/services/ai.ts
    - apps/slack-backend/src/jobs/types.ts
    - apps/slack-backend/src/jobs/queues.ts
    - apps/slack-backend/src/jobs/workers.ts
    - apps/slack-backend/src/jobs/schedulers.ts
    - apps/slack-backend/src/jobs/index.ts
    - apps/slack-backend/src/index.ts

# Decisions Made
decisions:
  - Fire-and-forget pattern: Escalation alerts never block AI suggestion generation (catch errors, log warnings)
  - 4-hour cooldown: Prevents duplicate alerts on same channel within 4 hours
  - Critical-only real-time triggers: Only critical sentiment triggers immediate alerts in AI flow; high/medium caught by scanner
  - 15-minute scanner frequency: Balances detection speed with resource usage
  - Admin-only visibility: Only org admins receive alerts and can manage them
  - Slack DMs for notifications: Alerts sent as DMs to all org admins, not posted in channels
  - Three alert statuses: open -> acknowledged -> resolved (with optional resolution notes) + false_positive
  - Severity mapping: critical->critical, high->high, medium->medium (direct from sentiment risk level)

# Metrics
duration: 6 min
completed: 2026-02-03
---

# Phase 12 Plan 07: Escalation Monitoring & Alerting Summary

**One-liner:** Real-time escalation alerts on critical client sentiment with Slack DM notifications, background scanning, and admin dashboard for alert management.

## What We Built

### Escalation Monitor Service
**File:** `apps/slack-backend/src/services/escalation-monitor.ts`

Core functions:
- `triggerEscalationAlert()` - Creates alert record, sends Slack DMs to org admins, enforces 4-hour cooldown
- `acknowledgeAlert()` - Updates status to acknowledged with timestamp
- `resolveAlert()` - Marks resolved with optional notes
- `markFalsePositive()` - Flags incorrect detections
- `getEscalationAlerts()` - Fetches alerts with filtering (status, severity, limit)
- `getAlertStats()` - Returns counts for dashboard (open, acknowledged, resolved, false positive)

**Key behaviors:**
- 4-hour cooldown per channel prevents alert fatigue
- Checks for existing open alert before creating new one
- Sends Slack DM to every admin in organization
- Never throws errors (fire-and-forget pattern)

### AI Service Integration
**File:** `apps/slack-backend/src/services/ai.ts`

When sentiment analysis returns critical risk:
```typescript
if (sentimentResult?.riskLevel === 'critical' && organizationId) {
  triggerEscalationAlert({...}).catch(err => {
    logger.warn({ error: err }, 'Failed to trigger escalation alert');
  });
}
```

Fire-and-forget: Alert failures are logged but never block suggestion generation.

### Background Scanner Job
**File:** `apps/slack-backend/src/jobs/escalation-scanner.ts`

Runs every 15 minutes via BullMQ repeatable job.

**Scan process:**
1. Query orgs with active subscriptions
2. For each org, get client contacts
3. For each contact, fetch recent DM history (last 4 hours)
4. Analyze sentiment on latest client message
5. Trigger alert if high/critical risk

**Why needed:** Catches escalations that happen when:
- User doesn't have app watching that conversation
- Message sent outside suggestion flow
- Real-time trigger failed or was missed

### Admin Escalation Dashboard
**File:** `apps/web-portal/app/admin/escalations/page.tsx`

**Features:**
- Stats cards: Open, Acknowledged, Resolved, False Positive Rate
- Filter bar: Status (all/open/acknowledged/resolved/false_positive), Severity (all/critical/high/medium)
- Alert cards showing:
  - Severity badge (critical=red, high=yellow, medium=blue)
  - Status badge with color coding
  - Time since created (relative: "2 hours ago")
  - Summary text
  - Slack channel deep link
  - Sentiment indicators as tags
  - Suggested action (blue callout box)
- Action buttons based on status:
  - Open: Acknowledge, Resolve, False Positive
  - Acknowledged: Resolve (with notes textarea), False Positive
  - Resolved: Read-only, shows resolution notes
  - False Positive: Read-only label

### API Routes
**Files:**
- `apps/web-portal/app/api/admin/escalations/route.ts` - GET with filters, returns alerts + stats
- `apps/web-portal/app/api/admin/escalations/[id]/route.ts` - PUT to update status

Both validate org ownership and require admin role.

## Technical Decisions

### Fire-and-Forget Pattern
Escalation alerts are important but not critical path. If alert creation fails, suggestion generation continues. Alerts are logged as warnings but never thrown.

### 4-Hour Cooldown
Prevents alert fatigue when client sends multiple tense messages in quick succession. Cooldown resets when alert is resolved or marked false positive.

### Real-Time vs Background
- **Real-time (AI service):** Only triggers on critical sentiment during suggestion generation
- **Background scanner:** Catches high/medium risk and missed critical messages every 15 minutes

### Admin-Only Visibility
Only org admins see alerts and receive notifications. Regular users don't see escalation system (avoids panic, focuses on response).

### Severity Mapping
Direct mapping from sentiment risk level:
- critical -> critical (requires immediate escalation)
- high -> high (respond within 1 hour)
- medium -> medium (monitor closely)

## Deviations from Plan

None - plan executed exactly as written.

## Testing Checklist

- [x] TypeScript compiles in both workspaces
- [x] Escalation monitor service exports all functions
- [x] 4-hour cooldown SQL query correctly checks `createdAt > NOW() - INTERVAL '4 hours'`
- [x] AI service imports and calls triggerEscalationAlert on critical sentiment
- [x] Fire-and-forget pattern: .catch() prevents errors from propagating
- [x] Background scanner worker created and registered
- [x] Escalation scanner scheduler runs every 15 minutes (cron: `*/15 * * * *`)
- [x] Scheduler initialized in index.ts startup
- [x] Admin API routes validate organization ownership
- [x] Admin page filters work (status, severity)
- [x] Admin page action buttons update alert status

## Next Phase Readiness

**Ready for Phase 13+:** Escalation monitoring is complete and ready for:
- SLA breach detection (could extend escalation system)
- Account management integrations (feed escalations to CRM)
- Analytics/reporting on escalation patterns
- Escalation workflow automations (e.g., auto-assign to account manager)

**No blockers or concerns.**

## Integration Points

**Consumed:**
- Sentiment analysis (from Plan 06) - triggers alerts on critical/high risk
- Client profiles - links alerts to client records
- Users table - finds org admins for notifications
- Installations - retrieves bot tokens for Slack DMs

**Provides:**
- Escalation alerts table - queryable by other features
- Alert stats API - can be used in org-level dashboards
- Admin notification system - reusable pattern for other admin alerts

## Metrics

**Commits:**
- 7067ce8: Create escalation monitor service and wire into AI
- 7dfa810: Add escalation scanner job and admin page

**Duration:** 6 minutes (from 1770112915 to 1770113276)

**Files changed:** 13 files
- 5 created
- 8 modified

**Code quality:**
- All TypeScript compiles cleanly
- Fire-and-forget error handling prevents crashes
- 4-hour cooldown prevents alert fatigue
- Admin-only access enforced via requireAdmin()
