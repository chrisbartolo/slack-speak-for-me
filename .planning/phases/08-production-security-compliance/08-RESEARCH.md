# Phase 8: Production Security & Compliance - Research

**Researched:** 2026-02-01
**Domain:** GDPR compliance, security hardening, audit logging, dependency scanning
**Confidence:** HIGH

## Summary

This phase implements GDPR compliance features (data export, deletion, privacy policy), security hardening (security headers, rate limiting), audit logging for security events, and dependency vulnerability scanning in CI. The research covers the standard stack for each requirement, architectural patterns for implementation in Next.js and Node.js/Express backends, and common pitfalls to avoid.

The project already has foundational security elements: AES-256-GCM encryption, RLS policies, rate limiting for Slack API calls (via `limiter` package), and secret redaction in logs. This phase extends these with user-facing compliance features, HTTP-level security headers, endpoint rate limiting, and a formal audit trail.

**Primary recommendation:** Use Next.js `next.config.js` headers for static security headers, `express-rate-limit` with Redis store for API rate limiting, `react-cookie-consent` for cookie banners, custom database tables for audit logging and GDPR data operations, and IBM's `audit-ci` for CI vulnerability scanning.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next.config.js headers | Built-in | Security headers (CSP, HSTS, X-Frame-Options) | Official Next.js pattern, no external deps |
| express-rate-limit | ^7.x | Rate limiting for Express/Node endpoints | 10M+ weekly downloads, battle-tested |
| rate-limit-redis | ^4.x | Redis store for distributed rate limiting | Works with existing Redis/BullMQ setup |
| react-cookie-consent | ^10.x | Cookie consent banner | Simple, customizable, GDPR-compliant patterns |
| audit-ci | ^7.x | Dependency vulnerability scanning in CI | IBM-maintained, supports npm/yarn/pnpm, configurable thresholds |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| limiter | ^3.x | In-memory rate limiting | Already in use for Slack API calls |
| pino | ^9.x | Structured logging for audit events | Already in use, extend for audit logging |
| Drizzle ORM | ^0.38.x | Audit log table schema | Already in use for database |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-cookie-consent | Custom implementation | More control but significantly more effort, easy to miss compliance details |
| express-rate-limit | Upstash ratelimit | Better for edge/Vercel, but project uses DigitalOcean App Platform |
| audit-ci | npm audit directly | audit-ci has better CI integration, allowlisting, and threshold configuration |
| Application-level headers | Nosecone library | Nosecone adds another dependency; next.config.js headers are sufficient |

**Installation:**
```bash
# Web portal (Next.js)
npm install react-cookie-consent --workspace=web-portal

# Slack backend (Node.js)
npm install express-rate-limit rate-limit-redis --workspace=slack-backend

# CI (dev dependency at root or in workflow)
npm install -D audit-ci
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web-portal/
├── app/
│   ├── privacy/page.tsx           # Privacy Policy page
│   ├── terms/page.tsx             # Terms of Service page
│   ├── api/
│   │   ├── gdpr/
│   │   │   ├── export/route.ts    # Data export endpoint
│   │   │   └── delete/route.ts    # Account deletion endpoint
│   │   └── audit/route.ts         # Audit log query (admin only)
│   └── components/
│       └── cookie-consent.tsx     # Cookie consent banner
├── lib/
│   └── gdpr/
│       ├── data-export.ts         # Data aggregation logic
│       └── data-deletion.ts       # Cascade deletion logic
└── next.config.ts                 # Security headers configuration

apps/slack-backend/
├── src/
│   ├── middleware/
│   │   └── rate-limiter.ts        # Rate limiting middleware
│   └── services/
│       └── audit-logger.ts        # Audit logging service

packages/database/
├── src/
│   └── schema.ts                  # Add audit_logs table
└── migrations/
    └── 000X_audit_logs.sql        # Audit log table migration

.github/workflows/
└── security.yml                   # Vulnerability scanning workflow
```

### Pattern 1: Security Headers in Next.js
**What:** Configure HTTP security headers via next.config.js for all routes
**When to use:** All Next.js applications in production
**Example:**
```typescript
// Source: https://nextjs.org/docs/pages/api-reference/config/next-config-js/headers
// apps/web-portal/next.config.ts
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com",
      "frame-ancestors 'self'",
    ].join('; ')
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@slack-speak/database'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

### Pattern 2: Rate Limiting with Redis Store
**What:** Distributed rate limiting for API endpoints using Redis
**When to use:** All public API endpoints to prevent abuse
**Example:**
```typescript
// Source: https://github.com/express-rate-limit/rate-limit-redis
// apps/slack-backend/src/middleware/rate-limiter.ts
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL);

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'rl:api:',
  }),
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour per IP
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'rl:auth:',
  }),
  message: { error: 'Too many authentication attempts.' },
});

// GDPR endpoints rate limiter (prevent abuse of expensive operations)
export const gdprRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // 5 requests per day per IP
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'rl:gdpr:',
  }),
  message: { error: 'Data export/deletion limit reached. Try again tomorrow.' },
});
```

### Pattern 3: Audit Logging Table Schema
**What:** Structured audit log table for security-relevant events
**When to use:** Track logins, data exports, deletions, permission changes
**Example:**
```typescript
// Source: https://www.bytebase.com/blog/postgres-audit-logging/
// packages/database/src/schema.ts - add to existing schema
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Who
  userId: text('user_id'), // Slack user ID (may be null for system events)
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // What
  action: text('action').notNull(), // 'login', 'logout', 'data_export', 'data_delete', 'settings_change', etc.
  resource: text('resource'), // 'user', 'workspace', 'subscription', etc.
  resourceId: text('resource_id'), // UUID or ID of affected resource

  // Details
  details: jsonb('details').$type<Record<string, unknown>>(), // Additional context
  previousValue: jsonb('previous_value'), // For tracking changes
  newValue: jsonb('new_value'),

  // When
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index('audit_logs_workspace_idx').on(table.workspaceId),
  userIdx: index('audit_logs_user_idx').on(table.userId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}));

// Audit action types for type safety
export type AuditAction =
  | 'login'
  | 'logout'
  | 'data_export_requested'
  | 'data_export_completed'
  | 'data_delete_requested'
  | 'data_delete_completed'
  | 'subscription_created'
  | 'subscription_cancelled'
  | 'settings_changed'
  | 'oauth_connected'
  | 'oauth_disconnected'
  | 'admin_action';
```

### Pattern 4: GDPR Data Export
**What:** Export all user data in JSON format within 30 days (GDPR Article 20)
**When to use:** User requests data portability
**Example:**
```typescript
// Source: https://auth0.com/docs/secure/data-privacy-and-compliance/gdpr/gdpr-data-portability
// apps/web-portal/lib/gdpr/data-export.ts
import { db } from '@/lib/db';
import {
  users, workspaces, watchedConversations, userStylePreferences,
  personContext, refinementFeedback, suggestionFeedback, gdprConsent,
  reportSettings, googleIntegrations
} from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';

export interface ExportedUserData {
  exportedAt: string;
  user: {
    id: string;
    slackUserId: string;
    email: string | null;
    role: string | null;
    createdAt: string;
  };
  workspace: {
    id: string;
    name: string | null;
    teamId: string;
  };
  preferences: {
    stylePreferences: object | null;
    reportSettings: object | null;
    personContexts: object[];
  };
  activity: {
    watchedConversations: object[];
    suggestionFeedback: object[];
    refinementFeedback: object[];
  };
  integrations: {
    googleConnected: boolean;
    spreadsheetName: string | null;
  };
  consent: {
    records: object[];
  };
}

export async function exportUserData(
  userId: string,
  workspaceId: string
): Promise<ExportedUserData> {
  // Fetch all user data from all tables
  const [user] = await db.select().from(users)
    .where(and(eq(users.id, userId), eq(users.workspaceId, workspaceId)));

  const [workspace] = await db.select().from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  const stylePrefs = await db.select().from(userStylePreferences)
    .where(and(
      eq(userStylePreferences.workspaceId, workspaceId),
      eq(userStylePreferences.userId, user.slackUserId)
    ));

  const reportSettingsData = await db.select().from(reportSettings)
    .where(and(
      eq(reportSettings.workspaceId, workspaceId),
      eq(reportSettings.userId, user.slackUserId)
    ));

  const personContexts = await db.select().from(personContext)
    .where(and(
      eq(personContext.workspaceId, workspaceId),
      eq(personContext.userId, user.slackUserId)
    ));

  const watchedConvs = await db.select().from(watchedConversations)
    .where(and(
      eq(watchedConversations.workspaceId, workspaceId),
      eq(watchedConversations.userId, user.slackUserId)
    ));

  const suggestionFb = await db.select().from(suggestionFeedback)
    .where(and(
      eq(suggestionFeedback.workspaceId, workspaceId),
      eq(suggestionFeedback.userId, user.slackUserId)
    ));

  const refinementFb = await db.select().from(refinementFeedback)
    .where(and(
      eq(refinementFeedback.workspaceId, workspaceId),
      eq(refinementFeedback.userId, user.slackUserId)
    ));

  const googleInteg = await db.select().from(googleIntegrations)
    .where(and(
      eq(googleIntegrations.workspaceId, workspaceId),
      eq(googleIntegrations.userId, user.slackUserId)
    ));

  const consentRecords = await db.select().from(gdprConsent)
    .where(and(
      eq(gdprConsent.workspaceId, workspaceId),
      eq(gdprConsent.userId, user.slackUserId)
    ));

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      slackUserId: user.slackUserId,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt?.toISOString() || '',
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      teamId: workspace.teamId,
    },
    preferences: {
      stylePreferences: stylePrefs[0] || null,
      reportSettings: reportSettingsData[0] || null,
      personContexts: personContexts.map(pc => ({
        targetUserName: pc.targetUserName,
        contextText: pc.contextText,
        createdAt: pc.createdAt?.toISOString(),
      })),
    },
    activity: {
      watchedConversations: watchedConvs.map(wc => ({
        channelName: wc.channelName,
        channelType: wc.channelType,
        watchedAt: wc.watchedAt?.toISOString(),
      })),
      suggestionFeedback: suggestionFb.map(sf => ({
        action: sf.action,
        createdAt: sf.createdAt?.toISOString(),
      })),
      refinementFeedback: refinementFb.map(rf => ({
        refinementType: rf.refinementType,
        createdAt: rf.createdAt?.toISOString(),
      })),
    },
    integrations: {
      googleConnected: googleInteg.length > 0,
      spreadsheetName: googleInteg[0]?.spreadsheetName || null,
    },
    consent: {
      records: consentRecords.map(c => ({
        type: c.consentType,
        consentedAt: c.consentedAt?.toISOString(),
        revokedAt: c.revokedAt?.toISOString(),
      })),
    },
  };
}
```

### Pattern 5: Cookie Consent Banner
**What:** GDPR-compliant cookie consent banner with accept/decline
**When to use:** All pages if using tracking cookies (analytics, etc.)
**Example:**
```typescript
// Source: https://github.com/Mastermindzh/react-cookie-consent
// apps/web-portal/components/cookie-consent.tsx
'use client';

import CookieConsent, { getCookieConsentValue } from 'react-cookie-consent';
import { useEffect, useState } from 'react';

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Only show if consent hasn't been given
    const consent = getCookieConsentValue('cookie-consent');
    if (consent === undefined) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  return (
    <CookieConsent
      location="bottom"
      cookieName="cookie-consent"
      expires={365}
      enableDeclineButton
      flipButtons
      buttonText="Accept All"
      declineButtonText="Decline Optional"
      onAccept={() => {
        // Enable analytics/tracking cookies
        // e.g., initialize Google Analytics
      }}
      onDecline={() => {
        // Only essential cookies
        // Disable analytics
      }}
      style={{
        background: '#1e293b',
        alignItems: 'center',
      }}
      buttonStyle={{
        background: '#3b82f6',
        color: '#fff',
        borderRadius: '6px',
        padding: '8px 16px',
      }}
      declineButtonStyle={{
        background: 'transparent',
        border: '1px solid #64748b',
        color: '#94a3b8',
        borderRadius: '6px',
        padding: '8px 16px',
      }}
    >
      We use cookies to enhance your experience. Some are essential for the site to function,
      while others help us improve your experience.{' '}
      <a href="/privacy" className="underline text-blue-400">
        Learn more in our Privacy Policy
      </a>
    </CookieConsent>
  );
}
```

### Pattern 6: CI Vulnerability Scanning
**What:** Automated dependency vulnerability scanning in GitHub Actions
**When to use:** Every PR and push to main
**Example:**
```yaml
# Source: https://github.com/IBM/audit-ci
# .github/workflows/security.yml
name: Security

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Run weekly on Monday at 9 AM UTC
    - cron: '0 9 * * 1'

jobs:
  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      # Run audit-ci IMMEDIATELY after checkout
      # Before npm ci to avoid running potentially malicious postinstall scripts
      - name: Audit dependencies
        run: npx audit-ci@^7 --config ./audit-ci.jsonc

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit for report
        run: npm audit --audit-level=moderate
        continue-on-error: true  # Don't fail here, audit-ci handles failure

  # Optional: Create issues for new vulnerabilities on scheduled runs
  create-vulnerability-issue:
    needs: dependency-audit
    if: failure() && github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - name: Create Issue
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Security: Dependency vulnerabilities detected',
              body: 'The weekly security scan found vulnerabilities. Please review and update dependencies.',
              labels: ['security', 'dependencies']
            })
```

```jsonc
// audit-ci.jsonc - place in repo root
{
  "$schema": "https://github.com/IBM/audit-ci/raw/main/docs/schema.json",
  // Fail on moderate or higher vulnerabilities
  "moderate": true,
  // Allowlist specific advisories if needed (with justification in comments)
  "allowlist": [
    // Example: "GHSA-xxxx-xxxx-xxxx" // Reason: No fix available, mitigated by X
  ]
}
```

### Anti-Patterns to Avoid
- **Using 'unsafe-inline' without nonces in CSP:** If you need inline scripts, use nonces generated per-request in middleware, not blanket unsafe-inline
- **Rate limiting by IP only:** Consider user ID for authenticated endpoints to prevent account-based abuse
- **Storing audit logs in same database:** For critical compliance, consider separate audit database or external service
- **Synchronous data export:** Large exports should be queued and delivered via email/download link
- **Hard-coded CSP in production:** CSP should be environment-aware (stricter in prod, relaxed in dev)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie consent UI | Custom banner | react-cookie-consent | GDPR compliance details, browser quirks, SameSite handling |
| Rate limiting | Simple counter in memory | express-rate-limit + Redis | Distributed systems, atomic operations, sliding windows |
| Security headers | Manual response manipulation | next.config.js headers | Built-in, tested, handles edge cases |
| Vulnerability scanning | grep package.json | audit-ci | Advisory database integration, false positive handling |
| GDPR data format | Custom JSON structure | Follow Auth0/GDPR Article 20 patterns | Interoperability requirement |

**Key insight:** Security and compliance features have subtle requirements that are easy to miss. Using established libraries and patterns reduces the risk of non-compliance and security gaps.

## Common Pitfalls

### Pitfall 1: CSP Breaking Inline Scripts
**What goes wrong:** Adding CSP blocks Stripe.js, Google Fonts, or inline event handlers
**Why it happens:** Default 'self' policy doesn't allow external scripts or inline handlers
**How to avoid:** Explicitly whitelist required domains (stripe.com, fonts.googleapis.com), use nonces for inline scripts, or switch to external scripts
**Warning signs:** Console errors about CSP violations, payment forms not loading

### Pitfall 2: Rate Limiting in Memory-Only
**What goes wrong:** Rate limits reset when server restarts, don't work with multiple instances
**Why it happens:** Default express-rate-limit uses in-memory store
**How to avoid:** Always use Redis store in production (project already has Redis via BullMQ)
**Warning signs:** Rate limits not enforced consistently, abuse after deployments

### Pitfall 3: Incomplete Data Deletion
**What goes wrong:** User data remains in backups, logs, or denormalized locations
**Why it happens:** GDPR requires deletion of ALL personal data, not just main tables
**How to avoid:** Document all data storage locations, cascade deletions, retain audit log of deletion (without personal data)
**Warning signs:** Data reappears after restore, compliance audit failures

### Pitfall 4: Cookie Consent Without Blocking
**What goes wrong:** Analytics/tracking loads before user consents
**Why it happens:** Banner shows but scripts still execute
**How to avoid:** Conditionally load tracking scripts only after consent is granted
**Warning signs:** Google Analytics receiving data before banner interaction

### Pitfall 5: HSTS on Staging/Dev
**What goes wrong:** Browser caches HSTS for domain, breaks HTTP access
**Why it happens:** HSTS preload applies to entire domain
**How to avoid:** Only enable HSTS for production domain, use separate staging domains
**Warning signs:** HTTPS errors on staging after production deploy

### Pitfall 6: Audit Log Performance
**What goes wrong:** Database slows down from excessive audit log writes
**Why it happens:** Logging every action synchronously in transactions
**How to avoid:** Log asynchronously, batch writes, set retention policies, archive old logs
**Warning signs:** Slow API responses, growing table size

## Code Examples

Verified patterns from official sources:

### Audit Logger Service
```typescript
// apps/slack-backend/src/services/audit-logger.ts
import { db } from '@slack-speak/database';
import { auditLogs, AuditAction } from '@slack-speak/database';
import { logger } from '../utils/logger.js';

interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  workspaceId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    // Fire and forget - don't block main request
    db.insert(auditLogs).values({
      action: entry.action,
      userId: entry.userId,
      workspaceId: entry.workspaceId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
    }).execute().catch(err => {
      // Log but don't throw - audit failure shouldn't break app
      logger.error({ err, entry }, 'Failed to write audit log');
    });
  } catch (err) {
    logger.error({ err, entry }, 'Error in audit logger');
  }
}

// Convenience functions
export const auditLogin = (userId: string, workspaceId: string, ip: string) =>
  logAuditEvent({ action: 'login', userId, workspaceId, ipAddress: ip });

export const auditDataExport = (userId: string, workspaceId: string) =>
  logAuditEvent({ action: 'data_export_requested', userId, workspaceId });

export const auditDataDeletion = (userId: string, workspaceId: string) =>
  logAuditEvent({ action: 'data_delete_requested', userId, workspaceId });

export const auditSettingsChange = (
  userId: string,
  workspaceId: string,
  setting: string,
  previousValue: unknown,
  newValue: unknown
) =>
  logAuditEvent({
    action: 'settings_changed',
    userId,
    workspaceId,
    resource: 'settings',
    resourceId: setting,
    previousValue,
    newValue,
  });
```

### Data Deletion Handler
```typescript
// apps/web-portal/app/api/gdpr/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  users, watchedConversations, userStylePreferences, personContext,
  refinementFeedback, suggestionFeedback, gdprConsent, reportSettings,
  googleIntegrations, workflowConfig, messageEmbeddings, threadParticipants
} from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId || !session?.workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, workspaceId } = session;
  const slackUserId = session.slackUserId;

  // Log deletion request
  await logAuditEvent({
    action: 'data_delete_requested',
    userId: slackUserId,
    workspaceId,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
  });

  try {
    // Delete in order respecting foreign key constraints
    // Use transactions for atomicity
    await db.transaction(async (tx) => {
      // User-specific data (no FKs pointing to them)
      await tx.delete(messageEmbeddings)
        .where(and(eq(messageEmbeddings.workspaceId, workspaceId), eq(messageEmbeddings.userId, slackUserId)));

      await tx.delete(threadParticipants)
        .where(and(eq(threadParticipants.workspaceId, workspaceId), eq(threadParticipants.userId, slackUserId)));

      await tx.delete(watchedConversations)
        .where(and(eq(watchedConversations.workspaceId, workspaceId), eq(watchedConversations.userId, slackUserId)));

      await tx.delete(userStylePreferences)
        .where(and(eq(userStylePreferences.workspaceId, workspaceId), eq(userStylePreferences.userId, slackUserId)));

      await tx.delete(personContext)
        .where(and(eq(personContext.workspaceId, workspaceId), eq(personContext.userId, slackUserId)));

      await tx.delete(refinementFeedback)
        .where(and(eq(refinementFeedback.workspaceId, workspaceId), eq(refinementFeedback.userId, slackUserId)));

      await tx.delete(suggestionFeedback)
        .where(and(eq(suggestionFeedback.workspaceId, workspaceId), eq(suggestionFeedback.userId, slackUserId)));

      await tx.delete(reportSettings)
        .where(and(eq(reportSettings.workspaceId, workspaceId), eq(reportSettings.userId, slackUserId)));

      await tx.delete(googleIntegrations)
        .where(and(eq(googleIntegrations.workspaceId, workspaceId), eq(googleIntegrations.userId, slackUserId)));

      await tx.delete(workflowConfig)
        .where(and(eq(workflowConfig.workspaceId, workspaceId), eq(workflowConfig.userId, slackUserId)));

      // Keep consent record but mark as deleted (for compliance records)
      await tx.update(gdprConsent)
        .set({ revokedAt: new Date() })
        .where(and(eq(gdprConsent.workspaceId, workspaceId), eq(gdprConsent.userId, slackUserId)));

      // Finally delete user record
      await tx.delete(users)
        .where(eq(users.id, userId));
    });

    // Log completion
    await logAuditEvent({
      action: 'data_delete_completed',
      userId: slackUserId, // Keep reference for audit trail
      workspaceId,
    });

    return NextResponse.json({
      success: true,
      message: 'Your data has been deleted. You will be logged out.'
    });
  } catch (error) {
    console.error('Data deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete data. Please contact support.' },
      { status: 500 }
    );
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| X-Frame-Options header | CSP frame-ancestors | ~2020 | Better browser support, more granular control |
| Serial npm audit | audit-ci with thresholds | ~2022 | Better CI integration, allowlisting |
| Custom security header libs | Next.js built-in headers() | Next.js 12+ | No extra dependencies |
| GDPR notices only | Full consent management | GDPR enforcement 2018 | Legal requirement |

**Deprecated/outdated:**
- X-XSS-Protection header: Modern browsers have built-in XSS protection, but still set for legacy browser support
- Express-rate-limit v5: v7 is current, uses different configuration format
- npm audit alone: Should be combined with audit-ci for better CI/CD integration

## Open Questions

Things that couldn't be fully resolved:

1. **Analytics tracking scope**
   - What we know: If using Google Analytics or similar, cookie consent is required
   - What's unclear: Does the project plan to use analytics? PostHog? GA4?
   - Recommendation: Implement cookie consent banner infrastructure; conditionally show if analytics is added

2. **Data retention policy**
   - What we know: GDPR requires data minimization, but allows retention for legitimate purposes
   - What's unclear: How long to retain audit logs, suggestion history, etc.
   - Recommendation: Default to 2 years for audit logs, document in privacy policy

3. **DigitalOcean App Platform edge settings**
   - What we know: DO App Platform doesn't set HSTS headers but .ondigitalocean.app is HSTS preloaded
   - What's unclear: Whether custom domain will have automatic HSTS preload
   - Recommendation: Set HSTS headers in Next.js config regardless

## Sources

### Primary (HIGH confidence)
- [Next.js Headers Documentation](https://nextjs.org/docs/pages/api-reference/config/next-config-js/headers) - Security headers configuration
- [Next.js CSP Guide](https://nextjs.org/docs/pages/guides/content-security-policy) - Content Security Policy patterns
- [react-cookie-consent GitHub](https://github.com/Mastermindzh/react-cookie-consent) - Cookie consent implementation
- [IBM audit-ci GitHub](https://github.com/IBM/audit-ci) - Dependency scanning configuration
- [express-rate-limit + rate-limit-redis](https://github.com/express-rate-limit/rate-limit-redis) - Rate limiting with Redis

### Secondary (MEDIUM confidence)
- [Auth0 GDPR Data Portability](https://auth0.com/docs/secure/data-privacy-and-compliance/gdpr/gdpr-data-portability) - Data export patterns
- [Bytebase PostgreSQL Audit Logging](https://www.bytebase.com/blog/postgres-audit-logging/) - Audit log schema patterns
- [DigitalOcean App Platform Security](https://docs.digitalocean.com/products/app-platform/how-to/configure-edge-settings/) - Edge and CORS settings
- [GDPR for SaaS Guide](https://complydog.com/blog/gdpr-for-saas-companies-complete-compliance-guide) - Compliance requirements

### Tertiary (LOW confidence)
- WebSearch results on 2026 security best practices - Verified against official docs where possible

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All recommendations based on official documentation and widely-used libraries
- Architecture: HIGH - Patterns from Next.js docs and established community practices
- Security headers: HIGH - Verified against Next.js official documentation
- Rate limiting: HIGH - Using established libraries with Redis, project already uses Redis
- GDPR compliance: MEDIUM - Legal requirements are clear, implementation patterns vary
- Pitfalls: MEDIUM - Based on common issues reported in community discussions

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - security domain evolves but patterns are stable)
