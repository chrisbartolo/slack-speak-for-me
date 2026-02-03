# Phase 13: Team/Org Dashboard - Research

**Researched:** 2026-02-03
**Domain:** Multi-tenant admin dashboard with analytics, compliance, and team management
**Confidence:** HIGH

## Summary

Phase 13 builds an organization-level admin dashboard for team analytics, org-wide controls, and compliance features. The domain is well-established with mature patterns: shadcn/ui data tables with TanStack Table for tabular data, Tremor (built on Recharts) for trend charts, server-side aggregation with Drizzle ORM, CSV/PDF export with papaparse and PDFKit, and content filtering with category + keyword blocklists.

The existing codebase already provides strong foundations: Next.js 16 with React 19, Drizzle ORM with PostgreSQL, multi-tenant architecture with organizations/workspaces, auditLogs table, suggestionFeedback table, and usageEvents tracking. The dashboard extends existing patterns from the billing/usage dashboard to team-wide analytics.

Key challenges are team-level data aggregation (solved with PostgreSQL window functions and Drizzle raw SQL), plan-gated feature access (similar to Slack's tier model), and data retention enforcement (pg_cron or BullMQ scheduled jobs dropping old partitions).

**Primary recommendation:** Use Tremor for analytics charts (beautiful defaults, minimal config), shadcn/ui + TanStack Table for data tables with server-side sorting/filtering, and Drizzle aggregation queries with PostgreSQL date_trunc for time-series analytics.

## Standard Stack

The established libraries/tools for admin dashboards in Next.js (2026):

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tremor | Latest | Dashboard charts & analytics visualization | Built on Recharts + Radix, maintained by Vercel, beautiful defaults for SaaS dashboards |
| TanStack Table | v8+ | Data table sorting, filtering, pagination | Industry standard, works seamlessly with shadcn/ui Table component |
| shadcn/ui | Latest | UI components (tables, forms, dialogs) | Already in codebase, consistent with existing portal design |
| Drizzle ORM | 0.38.3+ | Database queries & aggregations | Already in codebase, excellent PostgreSQL support including raw SQL |
| papaparse | Latest | CSV export | Fast, zero dependencies, works in Node.js and browser |
| PDFKit | 0.17.2+ | Server-side PDF generation | Node.js native, ideal for compliance exports |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0+ | Date formatting & manipulation | Already in codebase, lightweight alternative to moment.js |
| zod | 3.25+ | Schema validation for admin forms | Already in codebase, type-safe validation |
| lucide-react | 0.563.0+ | Icon library | Already in codebase, consistent icon set |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tremor | Recharts directly | More flexibility but lose beautiful defaults and need custom styling |
| papaparse | json2csv | json2csv is lighter but lacks streaming support for large datasets |
| PDFKit | jsPDF | jsPDF is browser-focused, PDFKit better for Node.js server-side generation |

**Installation:**
```bash
npm install @tremor/react papaparse pdfkit
npm install --save-dev @types/papaparse @types/pdfkit
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web-portal/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── analytics/route.ts      # Team metrics aggregation
│   │   │   ├── audit-trail/route.ts    # Compliance log queries
│   │   │   ├── templates/route.ts      # Template CRUD + approval
│   │   │   ├── guardrails/route.ts     # Content filter config
│   │   │   └── export/route.ts         # CSV/PDF generation
│   ├── admin/
│   │   ├── layout.tsx                  # Admin-only layout with role check
│   │   ├── analytics/page.tsx          # Team analytics dashboard
│   │   ├── audit-trail/page.tsx        # Compliance audit view
│   │   ├── templates/page.tsx          # Template management
│   │   ├── guardrails/page.tsx         # Content guardrails config
│   │   └── settings/page.tsx           # Org-wide settings
├── components/
│   ├── admin/
│   │   ├── analytics-charts.tsx        # Tremor charts
│   │   ├── audit-trail-table.tsx       # TanStack + shadcn Table
│   │   ├── template-approval-flow.tsx  # Review/approve workflow
│   │   └── export-button.tsx           # CSV/PDF export trigger
├── lib/
│   ├── admin/
│   │   ├── analytics.ts                # Aggregation queries
│   │   ├── audit-trail.ts              # Audit log queries
│   │   ├── guardrails.ts               # Content filter logic
│   │   └── export.ts                   # CSV/PDF generation
packages/database/src/
├── schema.ts                           # New tables for templates, guardrails
```

### Pattern 1: Team Metrics Aggregation (Time-Series)
**What:** Aggregate user-level events to team-level metrics over time periods (daily, weekly, monthly)
**When to use:** Analytics dashboard showing adoption rate, acceptance ratio, response time impact over 6 months

**Example:**
```typescript
// Source: Drizzle ORM docs - Time-based aggregations
// https://github.com/drizzle-team/drizzle-orm/discussions/2893

import { sql } from 'drizzle-orm';
import { suggestionFeedback, usageEvents } from '@slack-speak/database';

// Monthly adoption rate: % of team members who used AI suggestions
const monthlyAdoption = await db.execute(sql`
  SELECT
    date_trunc('month', created_at) as month,
    COUNT(DISTINCT user_id) as active_users,
    (COUNT(DISTINCT user_id)::float /
     (SELECT COUNT(*) FROM users WHERE workspace_id = ${workspaceId})) * 100 as adoption_rate
  FROM ${suggestionFeedback}
  WHERE workspace_id = ${workspaceId}
    AND created_at >= NOW() - INTERVAL '6 months'
  GROUP BY date_trunc('month', created_at)
  ORDER BY month DESC
`);

// Acceptance vs refinement ratio (AI accuracy metric)
const accuracyMetrics = await db
  .select({
    action: suggestionFeedback.action,
    count: sql<number>`cast(count(*) as integer)`,
  })
  .from(suggestionFeedback)
  .where(eq(suggestionFeedback.workspaceId, workspaceId))
  .groupBy(suggestionFeedback.action);
```

### Pattern 2: Plan-Gated Feature Access
**What:** Show/hide features and data based on organization's subscription plan
**When to use:** Audit trail text visibility (metadata only vs full text), data retention periods

**Example:**
```typescript
// Source: Multi-tenant RBAC patterns
// https://medium.com/@my_journey_to_be_an_architect/building-role-based-access-control-for-a-multi-tenant-saas-startup-26b89d603fdb

interface PlanFeatures {
  auditTrailTextVisible: boolean;
  dataRetentionDays: number;
  maxTemplates: number;
}

const PLAN_FEATURES: Record<string, PlanFeatures> = {
  starter: {
    auditTrailTextVisible: false, // metadata only
    dataRetentionDays: 30,
    maxTemplates: 5,
  },
  pro: {
    auditTrailTextVisible: false, // metadata only
    dataRetentionDays: 90,
    maxTemplates: 25,
  },
  business: {
    auditTrailTextVisible: true, // full text access
    dataRetentionDays: 90,
    maxTemplates: 100,
  },
};

// In API route - check plan before returning data
export async function GET(request: Request) {
  const org = await getOrganization(request);
  const features = PLAN_FEATURES[org.planId || 'starter'];

  const auditLogs = await db.select({
    // Always include metadata
    id: auditLogs.id,
    userId: auditLogs.userId,
    action: auditLogs.action,
    createdAt: auditLogs.createdAt,
    // Conditionally include text based on plan
    ...(features.auditTrailTextVisible ? {
      details: auditLogs.details,
      previousValue: auditLogs.previousValue,
      newValue: auditLogs.newValue,
    } : {}),
  })
  .from(auditLogs)
  .where(eq(auditLogs.workspaceId, org.id));

  return Response.json({ logs: auditLogs, features });
}
```

### Pattern 3: Template Submission & Approval Workflow
**What:** Any team member submits template, admin reviews and approves/rejects
**When to use:** Shared response templates that require admin oversight before team-wide availability

**Example:**
```typescript
// Database schema for templates with approval workflow
export const responseTemplates = pgTable('response_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Template content
  name: text('name').notNull(),
  description: text('description'),
  templateType: text('template_type').notNull(), // 'canned' | 'starter' | 'playbook'
  content: text('content').notNull(),

  // Submission & approval
  submittedBy: text('submitted_by').notNull(), // Slack user ID
  status: text('status').default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedBy: text('reviewed_by'), // Admin Slack user ID
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('response_templates_org_idx').on(table.organizationId),
  statusIdx: index('response_templates_status_idx').on(table.status),
}));

// Approval action
async function approveTemplate(templateId: string, adminUserId: string) {
  return db.update(responseTemplates)
    .set({
      status: 'approved',
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(responseTemplates.id, templateId));
}
```

### Pattern 4: Content Guardrails (Category + Keyword)
**What:** Dual filtering system with predefined categories (toggle on/off) + custom keyword blocklist
**When to use:** Preventing AI from generating suggestions containing prohibited topics or terms

**Example:**
```typescript
// Guardrail configuration schema
export const guardrailConfig = pgTable('guardrail_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),

  // Predefined categories (JSON toggles)
  enabledCategories: jsonb('enabled_categories').$type<string[]>().default([
    'legal_advice',
    'pricing_commitments',
    'competitor_mentions',
  ]),

  // Custom blocklist
  blockedKeywords: jsonb('blocked_keywords').$type<string[]>().default([]),

  // Trigger behavior
  triggerMode: text('trigger_mode').default('hard_block'), // 'hard_block' | 'regenerate' | 'soft_warning'

  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: uniqueIndex('guardrail_config_org_idx').on(table.organizationId),
}));

// Guardrail violations log
export const guardrailViolations = pgTable('guardrail_violations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: text('user_id').notNull(),

  violationType: text('violation_type').notNull(), // 'category' | 'keyword'
  violatedRule: text('violated_rule').notNull(), // Which category/keyword triggered
  suggestionText: text('suggestion_text'), // What was blocked (plan-gated)
  action: text('action').notNull(), // 'blocked' | 'regenerated' | 'warned'

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgIdx: index('guardrail_violations_org_idx').on(table.organizationId),
  createdAtIdx: index('guardrail_violations_created_at_idx').on(table.createdAt),
}));

// Filtering logic
function checkGuardrails(text: string, config: GuardrailConfig): {
  violated: boolean;
  violationType?: 'category' | 'keyword';
  violatedRule?: string;
} {
  // Check custom keywords (case-insensitive)
  const lowerText = text.toLowerCase();
  for (const keyword of config.blockedKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return {
        violated: true,
        violationType: 'keyword',
        violatedRule: keyword,
      };
    }
  }

  // Check category patterns (implement category detection with Claude)
  // This would use AI to classify if text contains category topics

  return { violated: false };
}
```

### Pattern 5: Data Retention with Automatic Cleanup
**What:** Automatically delete old audit logs and suggestion feedback based on plan retention period
**When to use:** Compliance with data retention policies, storage cost management

**Example:**
```typescript
// Source: PostgreSQL data retention with pg_partman and pg_cron
// https://www.crunchydata.com/blog/auto-archiving-and-data-retention-management-in-postgres-with-pg_partman

// Option 1: BullMQ scheduled job (existing infrastructure)
import { Queue } from 'bullmq';

const dataRetentionQueue = new Queue('data-retention', {
  connection: redis,
});

// Schedule daily cleanup job
await dataRetentionQueue.add(
  'cleanup-expired-data',
  {},
  {
    repeat: { pattern: '0 2 * * *' }, // 2 AM daily
  }
);

// Job processor
async function cleanupExpiredData() {
  const orgs = await db.select().from(organizations);

  for (const org of orgs) {
    const retentionDays = PLAN_FEATURES[org.planId || 'starter'].dataRetentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete old audit logs
    await db.delete(auditLogs)
      .where(
        and(
          eq(auditLogs.workspaceId, org.id),
          lt(auditLogs.createdAt, cutoffDate)
        )
      );

    // Delete old suggestion feedback
    await db.delete(suggestionFeedback)
      .where(
        and(
          eq(suggestionFeedback.workspaceId, org.id),
          lt(suggestionFeedback.createdAt, cutoffDate)
        )
      );
  }
}

// Option 2: PostgreSQL pg_cron extension (if available)
// More efficient, runs in database without application code
/*
SELECT cron.schedule(
  'cleanup-expired-audit-logs',
  '0 2 * * *',
  $$
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
  $$
);
*/
```

### Pattern 6: CSV/PDF Export for Compliance
**What:** Export audit trail or analytics to CSV/PDF for compliance reviews and reporting
**When to use:** Quarterly compliance audits, executive reports

**Example:**
```typescript
// Source: PapaParse for CSV, PDFKit for PDF
// https://betterstack.com/community/guides/scaling-nodejs/parsing-csv-files-with-papa-parse/
// https://pdfkit.org/

import Papa from 'papaparse';
import PDFDocument from 'pdfkit';

// CSV export (browser or server)
async function exportToCSV(data: AuditLog[]) {
  const csv = Papa.unparse(data, {
    columns: ['id', 'userId', 'action', 'resource', 'createdAt'],
    header: true,
  });

  // Browser: trigger download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-trail-${new Date().toISOString()}.csv`;
  a.click();
}

// PDF export (server-side with PDFKit)
async function exportToPDF(data: AuditLog[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('Audit Trail Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(2);

    // Table headers
    doc.fontSize(10).text('Action\t\tUser\t\tDate', { continued: false });
    doc.moveDown();

    // Data rows
    data.forEach((log) => {
      doc.text(`${log.action}\t\t${log.userId}\t\t${log.createdAt.toISOString()}`);
    });

    doc.end();
  });
}

// API route for server-side export
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format'); // 'csv' or 'pdf'

  const logs = await fetchAuditLogs();

  if (format === 'pdf') {
    const pdfBuffer = await exportToPDF(logs);
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="audit-trail-${Date.now()}.pdf"`,
      },
    });
  } else {
    const csv = Papa.unparse(logs);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-trail-${Date.now()}.csv"`,
      },
    });
  }
}
```

### Anti-Patterns to Avoid
- **Client-side aggregation of large datasets:** Always aggregate on server/database, not in browser
- **Missing tenant_id predicates:** Every query must filter by organizationId/workspaceId to prevent data leaks
- **Blocking UI during export:** Generate exports server-side async, notify when ready via WebSocket or polling
- **Hardcoded plan features:** Use configuration objects so plan changes don't require code changes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | String concatenation with comma separators | papaparse (unparse) | Handles escaping, quotes, edge cases (commas in values, newlines) |
| PDF table layouts | Manual positioning calculations | PDFKit with helper functions or react-pdf | Complex layout math, pagination, text wrapping |
| Time-series aggregation | Loop through events and bucket by date | PostgreSQL date_trunc + GROUP BY | Database is faster, handles time zones, avoids loading all data into memory |
| Content filtering | Simple string.includes() checks | Category detection + regex patterns + normalization | Handles leet speak (l33t), plurals, word boundaries, substring false positives |
| Data table state | Manual sort/filter/pagination state | TanStack Table | Handles complex state, URL sync, server-side mode, column visibility |
| Chart customization | D3.js from scratch | Tremor (or Recharts) | Responsive, accessible, beautiful defaults, less code |

**Key insight:** Admin dashboards have mature ecosystems. Use battle-tested libraries that handle edge cases you won't anticipate until production.

## Common Pitfalls

### Pitfall 1: N+1 Queries in Team Analytics
**What goes wrong:** Fetching user list, then looping to fetch each user's metrics individually results in hundreds of database queries
**Why it happens:** Natural pattern when displaying per-user breakdowns, but kills performance with team size
**How to avoid:** Use JOIN or aggregation queries to fetch all data in single query with GROUP BY
**Warning signs:** Dashboard loads slowly with large teams, database connection pool exhaustion

**Example:**
```typescript
// BAD: N+1 pattern
const users = await db.select().from(users).where(eq(users.workspaceId, workspaceId));
const metrics = await Promise.all(
  users.map(async (user) => {
    const count = await db.select({ count: sql`count(*)` })
      .from(suggestionFeedback)
      .where(eq(suggestionFeedback.userId, user.slackUserId));
    return { user, count };
  })
);

// GOOD: Single aggregation query
const metrics = await db.select({
  userId: suggestionFeedback.userId,
  userName: users.email,
  suggestionCount: sql<number>`cast(count(*) as integer)`,
  acceptedCount: sql<number>`cast(sum(case when action = 'accepted' then 1 else 0 end) as integer)`,
})
.from(suggestionFeedback)
.leftJoin(users, eq(users.slackUserId, suggestionFeedback.userId))
.where(eq(suggestionFeedback.workspaceId, workspaceId))
.groupBy(suggestionFeedback.userId, users.email);
```

### Pitfall 2: Forgetting to Filter by Organization in Admin Queries
**What goes wrong:** Admin sees data from other organizations, critical security vulnerability
**Why it happens:** Copy-paste from user-facing queries that filter by userId but forget organizationId
**How to avoid:** ALWAYS include organizationId/workspaceId filter in every admin query, create helper function that enforces it
**Warning signs:** Manual security testing catches cross-tenant data leaks

**Example:**
```typescript
// Create helper that enforces org filtering
async function getOrgAuditLogs(organizationId: string) {
  // organizationId is required parameter, can't forget
  return db.select()
    .from(auditLogs)
    .where(eq(auditLogs.workspaceId, organizationId));
}

// Middleware to verify admin role + org access
export async function requireOrgAdmin(request: Request): Promise<Organization> {
  const session = await getSession(request);
  const orgId = request.headers.get('x-organization-id');

  if (!orgId) throw new Error('Organization ID required');

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) throw new Error('Organization not found');

  // Check user is admin of this org
  const user = await db.query.users.findFirst({
    where: and(
      eq(users.slackUserId, session.userId),
      eq(users.workspaceId, org.id),
      eq(users.role, 'admin')
    ),
  });

  if (!user) throw new Error('Admin access required');

  return org;
}
```

### Pitfall 3: Blocking UI During Large Exports
**What goes wrong:** User clicks "Export CSV" for 100k audit logs, browser hangs or times out waiting for response
**Why it happens:** Trying to generate and download large exports synchronously
**How to avoid:** Generate exports in background job, notify user when ready, provide download link
**Warning signs:** Export button freezes browser, users complain about timeouts

**Example:**
```typescript
// Instead of synchronous export, queue job
async function requestExport(organizationId: string, format: 'csv' | 'pdf') {
  const jobId = await exportQueue.add('generate-export', {
    organizationId,
    format,
    requestedBy: session.userId,
  });

  return { jobId, status: 'processing' };
}

// Background job generates file, stores in S3/filesystem
async function generateExport(job: Job) {
  const { organizationId, format } = job.data;
  const logs = await fetchAllAuditLogs(organizationId);

  const fileUrl = format === 'csv'
    ? await generateCSVAndUpload(logs)
    : await generatePDFAndUpload(logs);

  // Notify user via email or WebSocket
  await notifyUser(job.data.requestedBy, { fileUrl });
}
```

### Pitfall 4: Not Handling Plan Downgrades for Data Retention
**What goes wrong:** Org downgrades from 90-day to 30-day retention, but old data isn't cleaned up until next scheduled job runs
**Why it happens:** Retention cleanup runs on schedule, doesn't react to plan changes
**How to avoid:** Trigger immediate cleanup when plan changes, or show warning that data will be deleted
**Warning signs:** Users surprised their data disappeared, compliance violations from unexpected deletions

**Example:**
```typescript
// Webhook handler for Stripe subscription changes
async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const org = await getOrgByStripeSubscriptionId(subscription.id);

  const oldPlanId = org.planId;
  const newPlanId = subscription.items.data[0].price.lookup_key;

  await db.update(organizations)
    .set({ planId: newPlanId })
    .where(eq(organizations.id, org.id));

  // If retention period decreased, trigger immediate cleanup
  const oldRetention = PLAN_FEATURES[oldPlanId].dataRetentionDays;
  const newRetention = PLAN_FEATURES[newPlanId].dataRetentionDays;

  if (newRetention < oldRetention) {
    // Option 1: Immediate cleanup (aggressive)
    await dataRetentionQueue.add('cleanup-org', { organizationId: org.id });

    // Option 2: Grace period + warning email (user-friendly)
    await sendEmail({
      to: org.billingEmail,
      subject: 'Data Retention Period Changed',
      body: `Your plan change reduced data retention to ${newRetention} days.
             Data older than ${newRetention} days will be deleted in 7 days.`,
    });

    await dataRetentionQueue.add(
      'cleanup-org',
      { organizationId: org.id },
      { delay: 7 * 24 * 60 * 60 * 1000 } // 7 days
    );
  }
}
```

### Pitfall 5: Chart Performance with Large Datasets
**What goes wrong:** Tremor/Recharts slows down when rendering thousands of data points, especially on mobile
**Why it happens:** Client-side rendering of every point, even if screen resolution can't show them all
**How to avoid:** Aggregate data to screen resolution (max 100-200 points per chart), use server-side downsampling
**Warning signs:** Slow chart renders, laggy interactions, mobile crashes

**Example:**
```typescript
// Server-side downsampling for charts
function downsampleTimeSeries(
  data: { date: Date; value: number }[],
  maxPoints: number = 100
): typeof data {
  if (data.length <= maxPoints) return data;

  const interval = Math.ceil(data.length / maxPoints);
  const downsampled = [];

  for (let i = 0; i < data.length; i += interval) {
    const chunk = data.slice(i, i + interval);
    // Aggregate interval (average, sum, etc.)
    const value = chunk.reduce((sum, d) => sum + d.value, 0) / chunk.length;
    downsampled.push({
      date: chunk[0].date,
      value,
    });
  }

  return downsampled;
}

// Use in API route
const dailyMetrics = await fetchDailyMetrics(orgId, startDate, endDate);
const chartData = downsampleTimeSeries(dailyMetrics, 100);
return Response.json(chartData);
```

## Code Examples

Verified patterns from official sources:

### TanStack Table with shadcn/ui (Server-Side Sorting/Filtering)
```typescript
// Source: shadcn/ui Data Table documentation
// https://ui.shadcn.com/docs/components/data-table

'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

interface AuditLogTableProps {
  columns: ColumnDef<AuditLog>[];
  data: AuditLog[];
}

export function AuditLogTable({ columns, data }: AuditLogTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div>
      {/* Filter input */}
      <Input
        placeholder="Filter by action..."
        value={(table.getColumn('action')?.getFilterValue() as string) ?? ''}
        onChange={(e) => table.getColumn('action')?.setFilterValue(e.target.value)}
        className="max-w-sm mb-4"
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

### Tremor Analytics Charts
```typescript
// Source: Tremor documentation
// https://www.tremor.so/

import { Card, Title, LineChart, BarChart, DonutChart } from '@tremor/react';

interface AnalyticsChartsProps {
  adoptionData: { month: string; rate: number }[];
  actionData: { action: string; count: number }[];
}

export function AnalyticsCharts({ adoptionData, actionData }: AnalyticsChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Adoption rate over time */}
      <Card>
        <Title>Team Adoption Rate</Title>
        <LineChart
          data={adoptionData}
          index="month"
          categories={["rate"]}
          colors={["blue"]}
          valueFormatter={(value) => `${value.toFixed(1)}%`}
          yAxisWidth={48}
          showAnimation
        />
      </Card>

      {/* Acceptance vs refinement breakdown */}
      <Card>
        <Title>AI Accuracy Metrics</Title>
        <DonutChart
          data={actionData}
          category="count"
          index="action"
          colors={["green", "yellow", "red"]}
          showAnimation
        />
      </Card>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D3.js for all charts | Tremor (high-level) or Recharts (mid-level) | 2024-2025 | Faster development, beautiful defaults, less custom code |
| Client-side CSV generation with loops | papaparse.unparse() | Established | Handles edge cases, faster, more reliable |
| Manual table sorting/filtering | TanStack Table v8+ | 2023-2024 | Handles complex state, server-side mode, type-safe |
| Moment.js for dates | date-fns or native Temporal API | 2022+ | Smaller bundle, tree-shakeable, modern |
| Bootstrap/Material UI | shadcn/ui + Tailwind | 2023-2024 | Component-level customization, no runtime overhead |
| Sequelize/TypeORM | Drizzle ORM | 2024-2025 | Type-safe, better DX, SQL-first approach |

**Deprecated/outdated:**
- **Moment.js:** Use date-fns (this project already uses it) or native Date methods
- **Chart.js with react-chartjs-2:** Tremor or Recharts provide better React integration and modern APIs
- **Manual CSV string building:** Use papaparse to avoid escaping bugs
- **Redux for table state:** TanStack Table handles state internally or via URL params

## Open Questions

Things that couldn't be fully resolved:

1. **Guardrail category detection with AI**
   - What we know: Can use Claude to classify text into predefined categories (legal advice, pricing, etc.)
   - What's unclear: Prompt engineering for high precision/recall, how to handle edge cases
   - Recommendation: Start with keyword matching for MVP, add AI classification in iteration. Test with sample messages to tune prompts.

2. **Real-time dashboard updates**
   - What we know: Analytics could update in real-time as team members use AI
   - What's unclear: WebSocket infrastructure vs polling trade-offs, performance impact
   - Recommendation: Start with manual refresh + polling (30-60 second intervals), add WebSockets if users request real-time

3. **Response time impact estimation**
   - What we know: Need to estimate time saved per suggestion (Context decision: how to calculate this)
   - What's unclear: Accurate heuristic (average typing speed? message length? user survey?)
   - Recommendation: Simple heuristic based on character count and average typing speed (40 WPM = ~200 chars/min), allow manual adjustment per org

4. **Template variable substitution**
   - What we know: Templates might need placeholders like `{client_name}`, `{user_name}`
   - What's unclear: Syntax for variables, how AI fills them in, validation
   - Recommendation: Start with static templates (no variables) for MVP, add variable support if users request it

## Sources

### Primary (HIGH confidence)
- [Tremor Official Docs](https://www.tremor.so/) - Chart library built on Recharts + Radix, maintained by Vercel
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table) - TanStack Table integration patterns
- [Drizzle ORM Select Queries](https://orm.drizzle.team/docs/select) - PostgreSQL aggregation with Drizzle
- [Drizzle ORM Time-Based Aggregations Discussion](https://github.com/drizzle-team/drizzle-orm/discussions/2893) - date_trunc patterns
- [PapaParse Documentation](https://www.papaparse.com/) - CSV parsing and generation
- [PDFKit Official Site](https://pdfkit.org/) - PDF generation for Node.js

### Secondary (MEDIUM confidence)
- [Building RBAC for Multi-Tenant SaaS (Medium)](https://medium.com/@my_journey_to_be_an_architect/building-role-based-access-control-for-a-multi-tenant-saas-startup-26b89d603fdb) - RBAC patterns verified with WorkOS guide
- [Best Practices for Multi-Tenant Authorization (Permit.io)](https://www.permit.io/blog/best-practices-for-multi-tenant-authorization) - Security patterns
- [Product Adoption Dashboard Metrics (Userpilot)](https://userpilot.com/blog/product-adoption-dashboard/) - SaaS KPIs and metrics
- [Auto-archiving with pg_partman (Crunchy Data)](https://www.crunchydata.com/blog/auto-archiving-and-data-retention-management-in-postgres-with-pg_partman) - PostgreSQL retention
- [Keyword Lists for Content Moderation (Sightengine)](https://sightengine.com/keyword-lists-for-text-moderation-the-guide) - Filtering patterns

### Tertiary (LOW confidence)
- [Next.js Admin Dashboard Best Practices (various)](https://nextjstemplates.com/blog/admin-dashboard-templates) - General patterns, verify specifics
- [React Chart Libraries Comparison 2026 (Aglowid)](https://aglowiditsolutions.com/blog/react-chart-libraries/) - Landscape overview, verify versions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are established (Tremor/Vercel, TanStack Table, existing codebase tools)
- Architecture: HIGH - Patterns verified with official docs (Drizzle, shadcn/ui, multi-tenant security)
- Pitfalls: HIGH - Based on production experience and documented anti-patterns (N+1, tenant isolation)
- Guardrails: MEDIUM - Content filtering patterns established, but AI classification for categories needs testing
- Real-time updates: MEDIUM - WebSocket vs polling trade-off is implementation-specific

**Research date:** 2026-02-03
**Valid until:** 60 days (stable domain, mature libraries)
