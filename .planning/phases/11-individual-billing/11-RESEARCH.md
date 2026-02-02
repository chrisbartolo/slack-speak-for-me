# Phase 11: Individual Billing - Research

**Researched:** 2026-02-02
**Domain:** Stripe Individual Subscriptions, User Identity Across Workspaces, Dual Billing Model
**Confidence:** HIGH

## Summary

This phase adds individual billing capability allowing users to pay for personal subscriptions independent of their organization's billing. The key challenge is that Slack user IDs are workspace-scoped (a user in Workspace A has a different ID than in Workspace B), so individual subscriptions need to be tied to email address rather than Slack user ID. The existing organization-level billing infrastructure (Stripe customers, webhooks, portal) will be extended to support a parallel user-level subscription model.

The architecture requires a new `user_subscriptions` table that links Stripe customers to user emails, allowing the subscription to follow the user across any workspace they join. The access check logic becomes: "Does user have active individual subscription OR does their workspace's organization have active subscription that includes them?"

**Primary recommendation:** Create user-level Stripe customers tied to email address, add `user_subscriptions` table, and implement dual-path access checking that prioritizes individual subscription over organization-provided access.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | 20.3.0 | Individual subscription billing | Already installed, same API for user-level customers |
| drizzle-orm | 0.38+ | User subscription schema | Already used for org billing |
| resend | 4.0+ | Individual billing emails | Already used for org billing emails |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.22+ | Validate billing mode, plan selection | Request validation on checkout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Email-based identity | Slack Enterprise ID | Enterprise ID only works for Enterprise Grid orgs, not individual workspaces |
| Separate user_subscriptions table | Extend organizations table | Cleaner separation of concerns; users aren't organizations |
| Stripe Entitlements API | Custom entitlement logic | Entitlements API adds complexity; simple boolean access check is sufficient |

**Installation:**
```bash
# No new dependencies - using existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
packages/database/src/
├── schema.ts                    # Add userSubscriptions table
└── index.ts

apps/web-portal/
├── app/
│   ├── pricing/page.tsx         # Update with individual/team tabs
│   ├── settings/billing/        # New individual billing settings
│   │   └── page.tsx
│   ├── api/
│   │   └── stripe/
│   │       ├── checkout/route.ts    # Extend with individual mode
│   │       ├── webhook/route.ts     # Extend with individual events
│   │       └── user-portal/route.ts # New user-level portal endpoint
└── lib/
    ├── billing/
    │   ├── access-check.ts      # Dual-path access checking
    │   └── user-subscription.ts # User subscription helpers
    └── auth/
        └── dal.ts               # Extend session with individual sub info
```

### Pattern 1: User Subscription Schema
**What:** Database table linking email to Stripe subscription
**When to use:** Storing individual subscription state
**Example:**
```typescript
// Source: Drizzle ORM pattern, extending existing schema
export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identity - email is the stable identifier across workspaces
  email: text('email').notNull().unique(),

  // Stripe billing
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status'), // 'active' | 'trialing' | 'paused' | 'canceled'
  planId: text('plan_id'), // 'individual_starter' | 'individual_pro'
  trialEndsAt: timestamp('trial_ends_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('user_subscriptions_email_idx').on(table.email),
  stripeCustomerIdx: index('user_subscriptions_stripe_customer_idx').on(table.stripeCustomerId),
}));
```

### Pattern 2: Dual-Path Access Checking
**What:** Check if user has access via individual OR organization subscription
**When to use:** Any feature-gated action
**Example:**
```typescript
// Source: Custom pattern for hybrid B2B/B2C billing
export type AccessResult =
  | { hasAccess: true; source: 'individual' | 'organization'; status: 'active' | 'trialing' }
  | { hasAccess: false; reason: 'no_subscription' | 'paused' | 'canceled' };

export async function checkUserAccess(
  email: string,
  workspaceId: string
): Promise<AccessResult> {
  // Priority 1: Check individual subscription by email
  const userSub = await db.query.userSubscriptions.findFirst({
    where: eq(userSubscriptions.email, email.toLowerCase()),
  });

  if (userSub?.subscriptionStatus === 'active' || userSub?.subscriptionStatus === 'trialing') {
    return { hasAccess: true, source: 'individual', status: userSub.subscriptionStatus };
  }

  // Priority 2: Check organization subscription via workspace
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    with: { organization: true },
  });

  if (workspace?.organization) {
    const orgStatus = workspace.organization.subscriptionStatus;
    if (orgStatus === 'active' || orgStatus === 'trialing') {
      return { hasAccess: true, source: 'organization', status: orgStatus };
    }
    if (orgStatus === 'paused') {
      return { hasAccess: false, reason: 'paused' };
    }
    if (orgStatus === 'canceled') {
      return { hasAccess: false, reason: 'canceled' };
    }
  }

  // No subscription found
  // Also check if individual sub is paused/canceled
  if (userSub?.subscriptionStatus === 'paused') {
    return { hasAccess: false, reason: 'paused' };
  }
  if (userSub?.subscriptionStatus === 'canceled') {
    return { hasAccess: false, reason: 'canceled' };
  }

  return { hasAccess: false, reason: 'no_subscription' };
}
```

### Pattern 3: Billing Mode Checkout
**What:** Create checkout session for individual or organization
**When to use:** When user initiates subscription
**Example:**
```typescript
// Source: Stripe Checkout patterns
export async function createCheckout(options: {
  mode: 'individual' | 'organization';
  email: string;
  planId: string;
  organizationId?: string; // Required for org mode
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const priceId = getPriceId(options.planId, options.mode);

  if (options.mode === 'individual') {
    // Get or create individual customer
    let customer = await findCustomerByEmail(options.email);
    if (!customer) {
      customer = await stripe.customers.create({
        email: options.email,
        metadata: { type: 'individual' },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      subscription_data: {
        trial_period_days: 14,
        trial_settings: { end_behavior: { missing_payment_method: 'pause' } },
        metadata: { type: 'individual', email: options.email, planId: options.planId },
      },
      payment_method_collection: 'if_required',
      metadata: { type: 'individual', email: options.email, planId: options.planId },
    });

    return session.url!;
  } else {
    // Existing org checkout logic
    return createOrgCheckout(options);
  }
}
```

### Pattern 4: Webhook Handler Extension
**What:** Process individual subscription events alongside org events
**When to use:** Stripe webhook handler
**Example:**
```typescript
// Source: Stripe webhook patterns
async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const type = subscription.metadata.type;
  const customerId = subscription.customer as string;

  if (type === 'individual') {
    // Individual subscription - update user_subscriptions table
    const email = subscription.metadata.email;
    await db.insert(userSubscriptions)
      .values({
        email: email.toLowerCase(),
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        planId: subscription.metadata.planId,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSubscriptions.email,
        set: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          planId: subscription.metadata.planId,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          updatedAt: new Date(),
        },
      });
  } else {
    // Organization subscription - existing logic
    await updateOrgSubscription(customerId, subscription);
  }
}
```

### Pattern 5: Pricing Page with Billing Mode Toggle
**What:** Show individual and team pricing options
**When to use:** Public pricing page
**Example:**
```typescript
// Source: Common SaaS pricing page pattern
const INDIVIDUAL_PLANS = [
  {
    name: 'Individual Starter',
    price: 10,
    description: 'For personal use across any workspace',
    features: ['AI response suggestions', 'Up to 5 channels', 'Copy to clipboard', 'Basic refinement'],
    cta: 'Start Free Trial',
  },
  {
    name: 'Individual Pro',
    price: 15,
    description: 'Full power for power users',
    features: ['Everything in Starter', 'Unlimited channels', 'Style learning', 'Weekly reports'],
    popular: true,
    cta: 'Start Free Trial',
  },
];

const TEAM_PLANS = [
  {
    name: 'Team Starter',
    price: 10,
    priceUnit: '/seat/month',
    description: 'Perfect for small teams',
    features: ['AI response suggestions', 'Team admin controls', 'Seat management', 'Email support'],
    cta: 'Start Free Trial',
  },
  // ... existing team plans
];

// Toggle component
function BillingModeToggle({ mode, onChange }: { mode: 'individual' | 'team'; onChange: (m) => void }) {
  return (
    <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
      <button
        onClick={() => onChange('individual')}
        className={mode === 'individual' ? 'bg-white shadow' : ''}
      >
        For Myself
      </button>
      <button
        onClick={() => onChange('team')}
        className={mode === 'team' ? 'bg-white shadow' : ''}
      >
        For My Team
      </button>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Using Slack user ID for individual billing:** User IDs are workspace-scoped; use email instead
- **Mixing individual and org in same Stripe customer:** Keep separate customers for clarity
- **Checking org subscription only:** Always check individual subscription first (user may have left org but kept individual sub)
- **Allowing duplicate individual subscriptions:** Unique constraint on email prevents this

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Customer portal for individuals | Separate portal UI | Stripe Customer Portal | Same portal works for both, just different customer ID |
| Subscription state sync | Manual status tracking | Stripe webhooks | Webhooks ensure consistency |
| Trial management | Custom trial logic | Stripe trial_period_days | Stripe handles all trial edge cases |
| Email uniqueness across case | Manual lowercase | Database constraint + normalize on insert | Let DB enforce uniqueness |
| Proration on plan changes | Manual calculation | Stripe proration_behavior | Stripe handles complex billing math |

**Key insight:** The same Stripe infrastructure used for org billing works for individual billing. The only difference is where the customer ID is stored (user_subscriptions vs organizations table) and how access is checked.

## Common Pitfalls

### Pitfall 1: Slack User ID Changes Between Workspaces
**What goes wrong:** User subscribes individually in Workspace A, joins Workspace B, loses access
**Why it happens:** Same person has different Slack user IDs in different workspaces
**How to avoid:** Use email as the stable identifier; always get email during Sign in with Slack
**Warning signs:** User reports access issues after joining new workspace

### Pitfall 2: Race Condition Between Individual and Org Access
**What goes wrong:** User has both individual and org subscription; canceling org causes brief lockout
**Why it happens:** Access check runs before individual subscription is verified
**How to avoid:** Always check individual subscription first; cache access state
**Warning signs:** Brief feature lockout during org subscription changes

### Pitfall 3: Email Case Sensitivity
**What goes wrong:** User signs up with John@Example.com, later logs in with john@example.com, creates duplicate
**Why it happens:** Email lookup doesn't normalize case
**How to avoid:** Always lowercase email on insert and lookup
**Warning signs:** User can't access features, has two Stripe customers

### Pitfall 4: Missing Email During Sign In
**What goes wrong:** User signs in via Apple (anonymized relay) or Slack without email permission
**Why it happens:** Slack Sign in with Apple uses relay addresses; email scope may not be granted
**How to avoid:** Require `identity.email` scope; detect and warn about relay addresses
**Warning signs:** Null/undefined email in user record; @privaterelay.appleid.com addresses

### Pitfall 5: Double Charging for Org Members
**What goes wrong:** User has individual sub, joins org with paid subscription, gets charged for both
**Why it happens:** No logic to pause/notify individual subscribers who get org coverage
**How to avoid:** Detect overlap in dashboard; allow user to pause individual sub
**Warning signs:** Customer complaints about duplicate billing

### Pitfall 6: Individual Billing Page Access
**What goes wrong:** Individual user goes to /admin/billing and sees "No Organization" error
**Why it happens:** Billing page assumes organization context
**How to avoid:** Create separate /settings/billing for individual users
**Warning signs:** Individual users can't manage their subscription

## Code Examples

Verified patterns from official sources:

### User Subscription Table Migration
```typescript
// Source: Drizzle ORM migration pattern
// packages/database/migrations/XXXX_user_subscriptions.ts
import { sql } from 'drizzle-orm';

export async function up(db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT,
      plan_id TEXT,
      trial_ends_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_customer_idx
      ON user_subscriptions(stripe_customer_id);
  `);
}
```

### Session Extension for Individual Billing
```typescript
// Source: Extending existing auth DAL
// apps/web-portal/lib/auth/dal.ts
export interface ExtendedSession {
  isAuth: true;
  userId: string;
  email: string; // Add email for individual billing lookup
  workspaceId: string;
  teamId: string;
  individualSubscription?: {
    status: 'active' | 'trialing' | 'paused' | 'canceled';
    planId: string;
  } | null;
}

export const verifySession = cache(async (): Promise<ExtendedSession> => {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('session')?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    redirect('/login');
  }

  // Fetch individual subscription status if exists
  const userSub = await db.query.userSubscriptions.findFirst({
    where: eq(userSubscriptions.email, session.email?.toLowerCase()),
  });

  return {
    isAuth: true,
    userId: session.userId,
    email: session.email,
    workspaceId: session.workspaceId,
    teamId: session.teamId,
    individualSubscription: userSub ? {
      status: userSub.subscriptionStatus,
      planId: userSub.planId,
    } : null,
  };
});
```

### Individual Billing Settings Page
```typescript
// Source: Pattern based on existing admin/billing page
// apps/web-portal/app/settings/billing/page.tsx
export default async function IndividualBillingPage() {
  const session = await verifySession();

  if (!session.email) {
    return <div>Email required for individual billing</div>;
  }

  const userSub = await db.query.userSubscriptions.findFirst({
    where: eq(userSubscriptions.email, session.email.toLowerCase()),
  });

  const subscription = userSub?.stripeSubscriptionId
    ? await getSubscription(userSub.stripeSubscriptionId)
    : null;

  const needsSubscription = !userSub || userSub.subscriptionStatus === 'canceled';

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Personal Billing</h1>
        <p className="text-muted-foreground mt-1">
          Your individual subscription - works across all workspaces
        </p>
      </div>

      {/* Subscription status card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {userSub ? (
            <>
              <div className="flex justify-between">
                <span>Plan</span>
                <span>{userSub.planId}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <Badge>{userSub.subscriptionStatus}</Badge>
              </div>
            </>
          ) : (
            <p>No active subscription</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          {needsSubscription ? (
            <Link href="/pricing?mode=individual">
              <Button>Subscribe Now</Button>
            </Link>
          ) : (
            <form action="/api/stripe/user-portal" method="POST">
              <input type="hidden" name="email" value={session.email} />
              <Button type="submit">Manage Subscription</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### User Portal API Route
```typescript
// Source: Based on existing org portal route
// apps/web-portal/app/api/stripe/user-portal/route.ts
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/dal';
import { createPortalSession } from '@/lib/stripe';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const { userSubscriptions } = schema;

export async function POST() {
  try {
    const session = await verifySession();

    if (!session.email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const userSub = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.email, session.email.toLowerCase()),
    });

    if (!userSub?.stripeCustomerId) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';
    const portalSession = await createPortalSession(
      userSub.stripeCustomerId,
      `${baseUrl}/settings/billing`
    );

    return NextResponse.redirect(portalSession.url);
  } catch (error) {
    console.error('User portal error:', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
```

### Webhook Extension
```typescript
// Source: Extending existing webhook handler
// apps/web-portal/app/api/stripe/webhook/route.ts (addition)

// Add to existing switch statement
case 'customer.subscription.created':
case 'customer.subscription.updated': {
  const subscription = event.data.object as Stripe.Subscription;
  const type = subscription.metadata?.type;

  if (type === 'individual') {
    // Handle individual subscription
    const email = subscription.metadata.email;
    if (!email) {
      console.error('Individual subscription missing email in metadata');
      break;
    }

    await db.insert(userSubscriptions)
      .values({
        email: email.toLowerCase(),
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        planId: subscription.metadata.planId || 'individual_pro',
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSubscriptions.email,
        set: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          planId: subscription.metadata.planId,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          updatedAt: new Date(),
        },
      });

    console.log(`Individual subscription ${event.type} for ${email}`);
  } else {
    // Existing org subscription logic
    const customerId = subscription.customer as string;
    await db.update(organizations)
      .set({
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        seatCount: subscription.items.data[0]?.quantity || 1,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        updatedAt: new Date(),
      })
      .where(eq(organizations.stripeCustomerId, customerId));
  }
  break;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Slack user ID for identity | Email for cross-workspace identity | Always (design decision) | Individual subs work across workspaces |
| Single billing model | Dual individual/org model | This phase | Supports B2C alongside B2B |
| Hardcoded billing page | Context-aware billing UI | This phase | Individual users have their own billing page |

**Deprecated/outdated:**
- Relying on Slack user ID for billing identity: Won't work across workspaces
- Single organizations-only billing: Doesn't serve individual users

## Open Questions

Things that couldn't be fully resolved:

1. **Overlap Handling - Individual Sub + Org Coverage**
   - What we know: User may have both; they shouldn't pay twice
   - What's unclear: Best UX for detecting and resolving overlap
   - Recommendation: Show banner in dashboard when overlap detected; allow user to pause individual sub

2. **Enterprise Grid User IDs**
   - What we know: Enterprise Grid has unified user IDs across workspaces
   - What's unclear: Whether to detect Enterprise Grid and use user ID instead of email
   - Recommendation: Stick with email for consistency; Enterprise Grid is rare

3. **Price Differentiation**
   - What we know: Individual plans could be same or different price than team plans
   - What's unclear: Whether individual should be cheaper (no seat management) or same
   - Recommendation: Start with same pricing; adjust based on market feedback

4. **Apple Sign In Relay Emails**
   - What we know: Apple Sign In uses relay addresses (@privaterelay.appleid.com)
   - What's unclear: Whether to block, warn, or allow these for individual billing
   - Recommendation: Allow but warn user that email must be accessible for billing communications

## Sources

### Primary (HIGH confidence)
- [Stripe Checkout with Trials](https://docs.stripe.com/payments/checkout/free-trials) - Trial checkout pattern
- [Stripe Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal) - Portal customization
- [Stripe Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) - Subscription lifecycle events
- [Stripe Metadata](https://docs.stripe.com/metadata) - Using metadata for routing
- [Stripe Multiple Subscriptions](https://docs.stripe.com/billing/subscriptions/multiple-products) - Multiple subscriptions per customer

### Secondary (MEDIUM confidence)
- [Slack users.identity](https://docs.slack.dev/reference/methods/users.identity/) - User identity and email retrieval
- [Kinde B2B vs B2C Best Practices](https://kinde.com/learn/billing/plans/structured-plan-variants-for-b2b-vs-b2c-saas-best-practices/) - Hybrid billing patterns
- [Stripe Entitlements](https://docs.stripe.com/billing/entitlements) - Feature-based access control (not used but researched)

### Tertiary (LOW confidence)
- [Slack user ID uniqueness](https://api.slack.com/changelog/2017-09-the-one-about-usernames) - User ID scope (older article, verified still accurate)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing Stripe and Drizzle patterns
- Architecture: HIGH - Clear extension of org billing model
- Pitfalls: HIGH - Email identity issues well-documented
- Access logic: MEDIUM - Dual-path checking is novel pattern for this codebase

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - Stripe API is stable)
