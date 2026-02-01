---
phase: 06-production-polish-and-admin
plan: 07
completed: 2026-02-01
duration: 3.5min
status: complete

subsystem: admin-foundation
tags: [database, auth, middleware, organizations, billing]

dependency_graph:
  requires: []
  provides:
    - organizations_table
    - user_roles
    - admin_middleware
  affects:
    - 06-08 (admin UI will use requireAdmin)
    - 06-09 (billing pages will use getOrganization)

tech_stack:
  added: []
  patterns:
    - Two-layer auth (middleware for session, page for role)
    - Organization-workspace hierarchy for billing

key_files:
  created:
    - apps/web-portal/lib/auth/admin.ts
  modified:
    - packages/database/src/schema.ts
    - apps/web-portal/lib/db/index.ts
    - apps/web-portal/middleware.ts

decisions:
  - decision: Two-layer auth pattern
    rationale: Middleware handles session validation, page-level requireAdmin() handles role check - standard Next.js pattern
    alternatives: Could check role in middleware but loses flexibility
---

# Phase 06 Plan 07: Admin Foundation with Organization Schema Summary

Organizations table and user roles added to database, plus admin auth middleware for protected routes.

## What Was Built

### Database Schema (packages/database/src/schema.ts)

**Organizations table** - Groups workspaces for billing:
- `id`, `name`, `slug` (URL-friendly identifier)
- Stripe fields: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`
- Plan fields: `planId` (free/pro/enterprise), `seatCount`, `billingEmail`
- Indexes on `slug` and `stripeCustomerId`

**Workspaces table update:**
- Added `organizationId` foreign key referencing organizations

**Users table update:**
- Added `role` column with default 'member' (values: admin/member/viewer)
- Added index on `role` for efficient admin queries

### Admin Auth Middleware (apps/web-portal/lib/auth/admin.ts)

**requireAdmin()** - Blocking redirect for admin pages:
- Verifies session via existing verifySession()
- Queries user role with organization info
- Redirects to /dashboard if not admin
- Returns AdminSession with userId, workspaceId, organizationId, role

**isAdmin()** - Non-blocking check for conditional UI:
- Returns boolean, catches errors gracefully
- Use for showing/hiding admin links in nav

**getOrganization()** - Fetch billing info:
- Takes organizationId, returns full org record
- Used for billing/subscription pages

### Middleware Update (apps/web-portal/middleware.ts)

Added `/admin` to protectedRoutes:
- Unauthenticated users redirected to login
- Authenticated non-admins reach pages but are redirected by requireAdmin()

## Commits

| Hash | Description |
|------|-------------|
| 4c39694 | feat(06-07): add organizations table and user role column |
| 1f6db99 | feat(06-07): add admin auth middleware |
| 0959228 | feat(06-07): protect /admin routes in middleware |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- Database migration applied: PASS (via drizzle-kit push)
- Database package builds: PASS
- Web-portal builds: PASS
- requireAdmin function exists: PASS
- isAdmin function exists: PASS
- /admin in protectedRoutes: PASS
- /admin NOT in publicRoutes: PASS

## Usage Examples

### Protecting an admin page:

```typescript
// app/admin/users/page.tsx
import { requireAdmin } from '@/lib/auth/admin';

export default async function AdminUsersPage() {
  const admin = await requireAdmin(); // Redirects if not admin

  return (
    <div>
      <h1>User Management</h1>
      {/* Admin UI here */}
    </div>
  );
}
```

### Conditional admin link in nav:

```typescript
import { isAdmin } from '@/lib/auth/admin';

export default async function Nav() {
  const showAdmin = await isAdmin();

  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      {showAdmin && <Link href="/admin">Admin</Link>}
    </nav>
  );
}
```

## Next Phase Readiness

Ready for:
- 06-08: Admin UI pages (user management, workspace management)
- 06-09: Billing integration with Stripe
- Organizations can be created/linked to workspaces
- Users can be promoted to admin role

No blockers identified.
