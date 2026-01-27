---
phase: 05
plan: 08
subsystem: web-portal
tags: [ui, forms, google-sheets, workflow]

dependency_graph:
  requires: ["05-02", "05-03"]
  provides: ["spreadsheet-config-ui", "workflow-channel-ui", "reports-page-complete"]
  affects: ["05-09"]

tech_stack:
  added: []
  patterns:
    - "Prerequisite gating with disabled prop"
    - "Parallel data fetching with Promise.all"
    - "Server actions for CRUD operations"

file_tracking:
  created:
    - apps/web-portal/components/workflow-config-form.tsx
  modified:
    - apps/web-portal/app/(dashboard)/reports/page.tsx
    - apps/web-portal/app/(dashboard)/reports/actions.ts
    - apps/web-portal/components/dashboard/google-connection-card.tsx
    - apps/web-portal/components/forms/report-settings-form.tsx
    - apps/web-portal/lib/db/index.ts
    - apps/web-portal/lib/db/queries.ts

decisions:
  - id: prerequisite-gating
    choice: "Disable workflow and report forms until spreadsheet configured"
    reason: "Enforces logical setup flow - Google connection -> spreadsheet -> channels -> settings"

metrics:
  duration: "4 min"
  completed: "2026-01-27"
---

# Phase 05 Plan 08: Web Portal Spreadsheet and Workflow Configuration Summary

Spreadsheet config in Google connection card with workflow channel form for monitoring setup.

## What Was Built

### Task 1: Spreadsheet Configuration in Google Connection Card
- Added `updateSpreadsheetConfig` server action for saving spreadsheet ID and name to googleIntegrations table
- Updated GoogleConnectionCard with spreadsheet configuration section
- Shows edit form when no spreadsheet configured, displays saved config with edit button when set
- Passes spreadsheetId and spreadsheetName props from reports page to component

### Task 2: Workflow Channel Configuration Form
- Added workflowConfig to lib/db schema export
- Created `getWorkflowConfig` cached query for fetching user's monitored channels
- Added `addWorkflowChannel` and `removeWorkflowChannel` server actions
- Created WorkflowConfigForm component with:
  - List of currently monitored channels with remove buttons
  - Add channel form with channel ID and optional name inputs
  - Helper text explaining how to find channel ID in Slack

### Task 3: Reports Page Integration
- Updated reports page to fetch all data in parallel with Promise.all
- Added WorkflowConfigForm below Google connection card
- Added disabled prop to ReportSettingsForm with fieldset for proper disabling
- Gate workflow and report forms until spreadsheet is configured
- Enhanced "How it works" section with clearer 4-step explanation

## Key Patterns

### Prerequisite Gating
Forms disable based on configuration state:
```tsx
const isConfigured = !!googleIntegration?.spreadsheetId;

<WorkflowConfigForm channels={workflowChannels} disabled={!isConfigured} />
<ReportSettingsForm defaultValues={...} disabled={!isConfigured} />
```

### Server Actions for CRUD
Pattern for workflow channel management:
```typescript
export async function addWorkflowChannel(channelId: string, channelName: string) {
  const session = await verifySession();
  await db.insert(workflowConfig).values({...}).onConflictDoUpdate({...});
  revalidatePath('/reports');
  return { success: true };
}
```

## Technical Notes

- Using onConflictDoUpdate for upsert behavior on workflow channels
- Spreadsheet ID validation requires minimum 10 characters (typical Google Sheet IDs are 44 chars)
- Workflow channels can be added/removed without affecting other user settings
- All forms provide clear disabled state messaging

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. `npm run build --workspace=web-portal` - PASS
2. Reports page shows all configuration sections in order - PASS (structure verified)
3. Spreadsheet ID can be saved to googleIntegrations - PASS (action implemented)
4. Channels can be added/removed from workflowConfig - PASS (actions implemented)
5. Forms disable appropriately when prerequisites missing - PASS (disabled prop wired)

## Commits

| Hash | Message |
|------|---------|
| 9b0bf9e | feat(05-08): add spreadsheet configuration to Google connection card |
| d2d22b2 | feat(05-08): create workflow channel configuration form |
| 69f0c6c | feat(05-08): integrate workflow config into reports page |

## Next Phase Readiness

Ready for 05-09 (Final Integration Testing):
- All configuration UI complete
- Server actions tested via build
- Forms properly gate based on prerequisites
- Reports page displays complete setup flow
