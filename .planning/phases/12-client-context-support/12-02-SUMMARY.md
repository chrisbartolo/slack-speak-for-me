---
phase: 12-client-context-support
plan: "02"
subsystem: client-management
status: complete
tags: [client-profiles, CRUD, admin-ui, contacts, relationship-management]

# Dependency graph
requires:
  - "12-01" # Database schema for client profiles and contacts
provides:
  - client-profiles-service # CRUD operations for backend
  - client-profiles-api # REST API endpoints
  - admin-clients-ui # Admin management interface
affects:
  - "12-06" # AI integration will use getClientContactBySlackUserId

# Tech tracking
tech-stack:
  added: []
  patterns:
    - service-layer # Backend service pattern with logger integration
    - api-routes # Next.js App Router API routes with Zod validation
    - client-components # React client component with dialog forms

# Files
key-files:
  created:
    - apps/slack-backend/src/services/client-profiles.ts
    - apps/web-portal/app/api/admin/clients/route.ts
    - apps/web-portal/app/api/admin/clients/[id]/route.ts
    - apps/web-portal/app/api/admin/clients/[id]/contacts/route.ts
    - apps/web-portal/app/admin/clients/page.tsx
  modified:
    - apps/slack-backend/src/services/index.ts

# Decisions
decisions:
  - id: client-lookup-critical
    summary: "getClientContactBySlackUserId is critical for AI integration"
    rationale: "AI needs to quickly identify if a Slack user is a client contact to adjust tone and include context"
    alternatives: []

  - id: contract-details-limit
    summary: "Contract details limited to 2000 characters"
    rationale: "Balance between sufficient detail and database performance, validated at both service and API layers"
    alternatives: ["unlimited text", "separate document storage"]

  - id: cascade-delete-contacts
    summary: "Deleting client profile cascades to contacts"
    rationale: "Contacts only make sense in context of their profile, prevents orphaned records"
    alternatives: ["soft delete", "archive instead of delete"]

# Metrics
duration: "4.8 min"
completed: "2026-02-03"
---

# Phase 12 Plan 02: Client Profile CRUD Service and Admin UI Summary

**One-liner:** Backend CRUD service with 9 functions and admin web interface for managing client profiles and contacts with relationship status tracking.

## Completed Work

### Backend Service Layer (Task 1)
Created `apps/slack-backend/src/services/client-profiles.ts` with comprehensive CRUD operations:

**Profile Management:**
- `getClientProfiles(organizationId)` - List all profiles for org, ordered by updatedAt
- `getClientProfileById(id, organizationId)` - Single profile with org scope check
- `createClientProfile(data)` - Insert with validation (contract details max 2000 chars)
- `updateClientProfile(id, organizationId, data)` - Update with org scope, set updatedAt
- `deleteClientProfile(id, organizationId)` - Delete profile and cascade to contacts

**Contact Management:**
- `getClientContactBySlackUserId(workspaceId, slackUserId)` - **Critical for AI integration** - Look up if Slack user is a client contact
- `getClientContactsByProfile(clientProfileId)` - List all contacts for a profile
- `addClientContact(data)` - Upsert contact (handles duplicates gracefully)
- `removeClientContact(id)` - Delete contact by ID

**Key Features:**
- All operations scoped by organizationId for multi-tenant isolation
- Logger integration with pino structured logging
- Contract details validation at service layer (max 2000 chars)
- Cascade delete from profiles to contacts
- Exported from `services/index.ts` for easy imports

### API Routes (Task 2)
Created three API route files with full CRUD support:

**`/api/admin/clients`** (route.ts):
- GET - List all client profiles for admin's organization
- POST - Create new client profile with Zod validation

**`/api/admin/clients/[id]`** (route.ts):
- PUT - Update client profile with org ownership check
- DELETE - Delete client profile and cascade contacts

**`/api/admin/clients/[id]/contacts`** (route.ts):
- GET - List contacts for a client profile
- POST - Add contact with Slack user mapping
- DELETE - Remove contact by contactId

**Key Features:**
- `requireAdmin()` ensures org ownership on all endpoints
- Zod validation for request bodies
- Proper HTTP status codes (201 for created, 404 for not found)
- ISO date string parsing for startDate/renewalDate
- Workspace ID lookup for contact mapping

### Admin UI (Task 3)
Created `apps/web-portal/app/admin/clients/page.tsx` with full client management:

**Interface Features:**
- Card-based list view with status badges (active/at_risk/churned)
- Company name, domain, services, renewal date displayed
- Color-coded status badges: green (active), yellow (at risk), red (churned)
- Expandable sections for contract details and contacts
- Modal dialog for create/edit with comprehensive form
- Delete confirmation dialog
- Empty state with CTA

**Form Fields:**
- Company name (required)
- Domain (optional)
- Services provided (comma-separated input)
- Contract details (textarea, max 2000 chars with counter)
- Account manager (Slack user ID)
- Relationship status (select: active, at_risk, churned)
- Start date and renewal date (date pickers)

**UX Patterns:**
- Optimistic updates with immediate re-fetch
- Expandable contacts section loads on demand
- shadcn/ui components for consistent styling
- Responsive layout with proper spacing

## Technical Implementation

### Service Layer Patterns
```typescript
// Example: getClientContactBySlackUserId (critical for AI)
export async function getClientContactBySlackUserId(
  workspaceId: string,
  slackUserId: string
) {
  const [result] = await db
    .select()
    .from(clientContacts)
    .where(
      and(
        eq(clientContacts.workspaceId, workspaceId),
        eq(clientContacts.slackUserId, slackUserId)
      )
    )
    .limit(1);

  return result ?? null;
}
```

### API Route Pattern
```typescript
// Organization scoping on all endpoints
const admin = await requireAdmin();
if (!admin.organizationId) {
  return NextResponse.json({ error: 'No organization found' }, { status: 400 });
}
```

### Validation
- Service layer: TypeScript types + runtime checks
- API layer: Zod schemas for request validation
- UI layer: Form field validation + maxLength constraints

## Data Flow

```
Admin UI → API Route → Service Layer → Database
  ↓           ↓            ↓
Client     Zod        Drizzle ORM
Component  Validation  + Logger
```

**Critical Path for AI Integration:**
```
Slack Event → getClientContactBySlackUserId → Returns client profile ID
  ↓
AI Service uses profile ID to fetch context
  ↓
Generate contextualized response
```

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Phase 12-06 (AI Integration) is now unblocked:**
- ✅ `getClientContactBySlackUserId` available for AI service
- ✅ Client profiles can be created via admin UI
- ✅ Contact mapping enables Slack user → client profile lookup
- ✅ All CRUD operations available for future admin features

**What's ready:**
- Backend service with 9 functions for complete client management
- REST API with proper auth and validation
- Admin UI for data entry and management
- Multi-tenant isolation via organizationId

**What's next:**
- Integrate client context into AI suggestion generation (plan 12-06)
- Use relationship status to adjust AI tone
- Include contract details in AI prompts when messaging clients

## Notes

### Performance Considerations
- `getClientContactBySlackUserId` is optimized with workspace+user index
- Profiles ordered by `updatedAt DESC` shows most recently modified first
- Contacts loaded on-demand when profile expanded (not eagerly fetched)

### Security
- All operations require admin role via `requireAdmin()`
- Organization ID validated on every database operation
- No client data leakage across organizations

### Data Quality
- Contract details validated at 2000 chars at service and API layers
- Services provided stored as JSONB array for flexible querying
- Cascade delete ensures no orphaned contacts

### UX
- Status badge colors provide at-a-glance relationship health
- Expandable sections reduce visual clutter
- Modal forms prevent navigation away from list view
- Date formatting for renewal dates shows urgency
