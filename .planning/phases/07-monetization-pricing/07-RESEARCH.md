# Phase 7: Monetization & Pricing - Research

**Researched:** 2026-02-01
**Domain:** Stripe Subscriptions, SEO Structured Data, Next.js Core Web Vitals
**Confidence:** HIGH

## Summary

This phase completes the monetization flow by building on existing Stripe infrastructure (checkout, portal, webhooks) from Phase 6 to add trial management, subscription lifecycle handling, and seat enforcement. Additionally, it requires SEO optimization through structured data (JSON-LD schemas), sitemap/robots.txt configuration, and Core Web Vitals optimization.

The existing codebase already has Stripe v20.3.0 integrated with checkout session creation, customer portal access, and basic webhook handling for subscription events. The research focuses on extending this foundation with free trials (14 days without payment), comprehensive webhook lifecycle handling, seat-based usage enforcement, and implementing FAQPage, SoftwareApplication, and Speakable JSON-LD schemas for SEO.

**Primary recommendation:** Use Stripe Checkout with `payment_method_collection: 'if_required'` and `trial_settings.end_behavior.missing_payment_method: 'pause'` for frictionless trial signup, then leverage existing webhook infrastructure to handle subscription state transitions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | 20.3.0 | Subscription billing, trials, webhooks | Already installed, industry-standard payment processor |
| next | 16.1.5 | App Router for SEO, sitemap, robots.txt | Already installed, native metadata and SEO support |
| schema-dts | 1.1.2+ | TypeScript types for JSON-LD schemas | Official schema.org TypeScript definitions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| serialize-javascript | 6.0+ | XSS-safe JSON stringification | When embedding JSON-LD in pages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual trial tracking | Stripe Billing trials | Stripe handles all trial logic natively |
| Custom email sending | Stripe email automation | Stripe can auto-send trial reminders (Settings > Subscriptions and emails) |
| next-seo | Native Next.js Metadata API | Next.js 16 has built-in metadata support, no extra dependency needed |

**Installation:**
```bash
npm install schema-dts serialize-javascript --workspace=web-portal
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web-portal/
├── app/
│   ├── pricing/                    # Public pricing page
│   │   └── page.tsx
│   ├── robots.ts                   # Dynamic robots.txt generation
│   ├── sitemap.ts                  # Dynamic sitemap generation
│   ├── api/
│   │   └── stripe/
│   │       ├── checkout/route.ts   # Extend with trial support
│   │       ├── portal/route.ts     # Existing
│   │       └── webhook/route.ts    # Extend with full lifecycle
│   └── layout.tsx                  # Add JSON-LD schemas
├── components/
│   ├── pricing/
│   │   ├── pricing-table.tsx       # Plan comparison component
│   │   ├── faq-section.tsx         # FAQ with schema markup
│   │   └── feature-matrix.tsx      # Feature comparison grid
│   └── seo/
│       └── json-ld.tsx             # Reusable JSON-LD component
└── lib/
    ├── stripe.ts                   # Extend with trial helpers
    ├── billing/
    │   ├── trial.ts                # Trial state management
    │   └── seat-enforcement.ts     # Seat limit checking
    └── seo/
        └── schemas.ts              # JSON-LD schema definitions
```

### Pattern 1: Stripe Trial Checkout Session
**What:** Create subscription with free trial that doesn't require payment upfront
**When to use:** When user clicks "Start Free Trial" on pricing page
**Example:**
```typescript
// Source: https://docs.stripe.com/payments/checkout/free-trials
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  success_url: `${baseUrl}/admin/billing?trial_started=true`,
  cancel_url: `${baseUrl}/pricing`,
  line_items: [{ price: priceId, quantity: seatCount }],
  subscription_data: {
    trial_period_days: 14,
    trial_settings: {
      end_behavior: {
        missing_payment_method: 'pause' // Pause instead of cancel
      }
    },
    metadata: { organizationId, planId }
  },
  payment_method_collection: 'if_required', // Don't require card upfront
  metadata: { organizationId }
});
```

### Pattern 2: Webhook Subscription Lifecycle
**What:** Handle all subscription state transitions via webhooks
**When to use:** Stripe sends webhook events
**Example:**
```typescript
// Source: https://docs.stripe.com/billing/subscriptions/webhooks
switch (event.type) {
  case 'customer.subscription.trial_will_end':
    // Sent 3 days before trial ends - send reminder email
    await sendTrialEndingReminder(subscription);
    break;

  case 'customer.subscription.paused':
    // Trial ended without payment - lock features
    await updateOrgStatus(customerId, 'paused');
    break;

  case 'customer.subscription.resumed':
    // Customer added payment and resumed
    await updateOrgStatus(customerId, 'active');
    break;

  case 'invoice.payment_failed':
    // Payment failed - notify and potentially downgrade
    await handleFailedPayment(invoice);
    break;

  case 'customer.subscription.updated':
    // Plan change (upgrade/downgrade) - update entitlements
    await syncSubscriptionState(subscription);
    break;
}
```

### Pattern 3: JSON-LD Structured Data Component
**What:** Reusable component for embedding JSON-LD schemas
**When to use:** Layout and page components that need structured data
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/guides/json-ld
import { WithContext, FAQPage, SoftwareApplication } from 'schema-dts';

interface JsonLdProps {
  data: WithContext<FAQPage | SoftwareApplication>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
```

### Pattern 4: Seat Enforcement Middleware
**What:** Check seat limits before allowing user actions
**When to use:** Any action that requires an active, paid seat
**Example:**
```typescript
// Application-level enforcement (Stripe doesn't enforce limits)
export async function enforceSeats(orgId: string, action: string): Promise<boolean> {
  const org = await getOrganization(orgId);
  const activeUsers = await countActiveUsers(orgId);

  // Check subscription status
  if (org.subscriptionStatus === 'paused' || org.subscriptionStatus === 'canceled') {
    throw new Error('Subscription inactive - upgrade required');
  }

  // Check seat count
  if (activeUsers >= (org.seatCount || 1)) {
    throw new Error(`Seat limit reached (${org.seatCount}). Upgrade to add more users.`);
  }

  return true;
}
```

### Anti-Patterns to Avoid
- **Storing subscription state locally only:** Always treat Stripe webhooks as source of truth for subscription status
- **Blocking webhooks on long operations:** Return 200 immediately, process async
- **Hardcoding trial days:** Use environment variable for easy adjustment
- **Missing JSON-LD XSS protection:** Always replace `<` with `\u003c` when stringifying

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trial period tracking | Custom date tracking | Stripe `trial_period_days` | Stripe handles timezone, billing cycle alignment |
| Trial expiration handling | Cron job checking dates | Stripe `trial_will_end` webhook | Stripe triggers exactly 3 days before |
| Payment retry logic | Manual retry scheduling | Stripe Smart Retries | Stripe ML-optimized retry timing |
| Subscription state machine | Custom status tracking | Stripe webhook events | Stripe guarantees state consistency |
| JSON-LD schema types | Manual interfaces | `schema-dts` package | 1:1 with schema.org spec |
| Sitemap generation | Manual XML building | Next.js `sitemap.ts` | Native caching and proper headers |

**Key insight:** Stripe manages the entire subscription lifecycle - your app should react to Stripe events, not try to track state independently.

## Common Pitfalls

### Pitfall 1: Webhook Timeout and Retry Chaos
**What goes wrong:** Webhook handler does expensive work synchronously, times out, Stripe retries, causing duplicate processing
**Why it happens:** Webhook endpoints have short timeout windows; Stripe retries failed webhooks for up to 3 days
**How to avoid:** Return 200 immediately, queue actual work via BullMQ (already have this infrastructure)
**Warning signs:** Seeing duplicate webhook events in logs, subscription state flickering

### Pitfall 2: Seat Count Drift
**What goes wrong:** Stripe subscription quantity doesn't match actual active users
**Why it happens:** Users added/removed without updating Stripe; forgot to sync on subscription events
**How to avoid:** Update Stripe quantity whenever user count changes; sync on every subscription webhook
**Warning signs:** Users complaining about access issues; revenue leakage from untracked seats

### Pitfall 3: Trial-to-Paid Transition Gaps
**What goes wrong:** Users lose access briefly during trial-to-paid transition
**Why it happens:** Race condition between trial end and first invoice payment
**How to avoid:** Use `pause` instead of `cancel` for missing payment; check `trial_end` in subscription object
**Warning signs:** Customer support tickets about sudden feature lockout

### Pitfall 4: JSON-LD XSS Vulnerability
**What goes wrong:** Malicious content in schema data executes JavaScript
**Why it happens:** Using `JSON.stringify` directly without sanitization
**How to avoid:** Replace `<` with `\u003c` OR use `serialize-javascript` library
**Warning signs:** Security scan warnings on structured data scripts

### Pitfall 5: CLS from Pricing Table Loading
**What goes wrong:** Pricing page layout shifts as pricing data loads
**Why it happens:** Dynamic content without placeholder sizing
**How to avoid:** Use skeleton loaders with fixed dimensions; SSR pricing data
**Warning signs:** Poor Core Web Vitals CLS score (>0.1)

### Pitfall 6: Speakable Schema Rejection
**What goes wrong:** Speakable markup not recognized by Google
**Why it happens:** Speakable is still beta, limited to US English news publishers
**How to avoid:** Implement it correctly but don't depend on it for SEO ranking
**Warning signs:** Rich Results Test shows no speakable features

## Code Examples

Verified patterns from official sources:

### Stripe Checkout with Trial (Complete)
```typescript
// Source: https://docs.stripe.com/payments/checkout/free-trials
export async function createTrialCheckout(
  organizationId: string,
  planId: string,
  seatCount: number
): Promise<string> {
  const stripe = getStripe();
  const org = await getOrganization(organizationId);

  // Get or create customer
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: org.billingEmail,
      name: org.name,
      metadata: { organizationId }
    });
    customerId = customer.id;
    await updateOrgCustomerId(organizationId, customerId);
  }

  const priceId = process.env[`STRIPE_PRICE_ID_${planId.toUpperCase()}`];
  const trialDays = parseInt(process.env.TRIAL_DAYS || '14');

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/billing?trial_started=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    line_items: [{ price: priceId, quantity: seatCount }],
    subscription_data: {
      trial_period_days: trialDays,
      trial_settings: {
        end_behavior: { missing_payment_method: 'pause' }
      },
      metadata: { organizationId, planId }
    },
    payment_method_collection: 'if_required',
    metadata: { organizationId, planId }
  });

  return session.url!;
}
```

### Complete Webhook Handler
```typescript
// Source: https://docs.stripe.com/billing/subscriptions/webhooks
export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    // Trial lifecycle
    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription;
      // Queue email reminder job
      await emailQueue.add('trial-ending', {
        customerId: sub.customer,
        trialEnd: sub.trial_end
      });
      break;
    }

    // Subscription state changes
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await db.update(organizations)
        .set({
          stripeSubscriptionId: sub.id,
          subscriptionStatus: sub.status,
          planId: sub.metadata.planId,
          seatCount: sub.items.data[0]?.quantity || 1,
          updatedAt: new Date()
        })
        .where(eq(organizations.stripeCustomerId, sub.customer as string));
      break;
    }

    case 'customer.subscription.paused': {
      const sub = event.data.object as Stripe.Subscription;
      await db.update(organizations)
        .set({ subscriptionStatus: 'paused', updatedAt: new Date() })
        .where(eq(organizations.stripeCustomerId, sub.customer as string));
      // Queue feature lockout notification
      await emailQueue.add('subscription-paused', { customerId: sub.customer });
      break;
    }

    case 'customer.subscription.resumed': {
      const sub = event.data.object as Stripe.Subscription;
      await db.update(organizations)
        .set({ subscriptionStatus: 'active', updatedAt: new Date() })
        .where(eq(organizations.stripeCustomerId, sub.customer as string));
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await db.update(organizations)
        .set({ subscriptionStatus: 'canceled', updatedAt: new Date() })
        .where(eq(organizations.stripeCustomerId, sub.customer as string));
      break;
    }

    // Payment events
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await emailQueue.add('payment-failed', {
        customerId: invoice.customer,
        invoiceId: invoice.id
      });
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      // Update billing period end
      if (invoice.subscription) {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        await db.update(organizations)
          .set({ subscriptionStatus: 'active', updatedAt: new Date() })
          .where(eq(organizations.stripeCustomerId, invoice.customer as string));
      }
      break;
    }
  }
}
```

### FAQPage JSON-LD Schema
```typescript
// Source: https://developers.google.com/search/docs/appearance/structured-data/faqpage
import { WithContext, FAQPage } from 'schema-dts';

const faqSchema: WithContext<FAQPage> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does the free trial work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Start your 14-day free trial without entering payment details. Get full access to all features. Add payment before trial ends to continue seamlessly.'
      }
    },
    {
      '@type': 'Question',
      name: 'What happens when my trial ends?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'If you add a payment method, your subscription continues automatically. Without payment, your subscription pauses and you can resume anytime by adding payment details.'
      }
    },
    {
      '@type': 'Question',
      name: 'How does per-seat pricing work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You pay for each active user in your workspace. Seats are prorated when added mid-billing cycle. Remove users anytime and your next invoice adjusts automatically.'
      }
    }
  ]
};
```

### SoftwareApplication/WebApplication Schema
```typescript
// Source: https://developers.google.com/search/docs/appearance/structured-data/software-app
import { WithContext, SoftwareApplication } from 'schema-dts';

const appSchema: WithContext<SoftwareApplication> = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Speak for Me',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  browserRequirements: 'Requires JavaScript and modern browser',
  description: 'AI-powered Slack response assistant that helps professionals craft contextually-aware responses to challenging workplace messages.',
  url: 'https://speakforme.app',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '9',
    highPrice: '15',
    priceCurrency: 'USD',
    offerCount: '2',
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter',
        price: '9',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '9',
          priceCurrency: 'USD',
          referenceQuantity: {
            '@type': 'QuantitativeValue',
            value: '1',
            unitCode: 'MON'
          }
        }
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '15',
        priceCurrency: 'USD'
      }
    ]
  }
};
```

### Next.js Sitemap
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
// app/sitemap.ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ];
}
```

### Next.js Robots.txt
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
// app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing'],
        disallow: ['/dashboard/', '/admin/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FID (First Input Delay) | INP (Interaction to Next Paint) | March 2024 | INP measures 95th percentile of all interactions, not just first |
| Stripe Charges API | Stripe Payment Intents | 2019 | Better 3DS support, required for SCA compliance |
| next-seo package | Next.js Metadata API | Next.js 13+ | Native metadata generation, no extra dependency |
| Manual sitemap.xml file | `sitemap.ts` dynamic generation | Next.js 13+ | Type-safe, automatic caching |

**Deprecated/outdated:**
- `next-seo`: Not needed for Next.js 16, use native Metadata API
- Manual SEO meta tags in `<head>`: Use `export const metadata` instead
- Stripe Checkout legacy integration: Use current Session-based flow

## Open Questions

Things that couldn't be fully resolved:

1. **Speakable Schema Effectiveness**
   - What we know: Speakable is still beta, limited to US English news publishers
   - What's unclear: Whether it will provide any benefit for a SaaS product page
   - Recommendation: Implement it correctly for future-proofing, but don't rely on it for SEO ranking now

2. **Email Notification Implementation**
   - What we know: Stripe can auto-send trial reminders; custom emails need email service
   - What's unclear: Whether to use Stripe's built-in emails or build custom with SendGrid/Resend
   - Recommendation: Start with Stripe's built-in emails (Settings > Subscriptions and emails), add custom later if needed

3. **Seat Sync Frequency**
   - What we know: Stripe subscription quantity can be updated via API
   - What's unclear: Whether to sync on every user add/remove or batch daily
   - Recommendation: Sync immediately on user changes for accurate billing; Stripe prorates automatically

## Sources

### Primary (HIGH confidence)
- [Stripe Trials Documentation](https://docs.stripe.com/billing/subscriptions/trials) - Trial configuration, webhook events
- [Stripe Checkout Free Trials](https://docs.stripe.com/payments/checkout/free-trials) - Checkout session with trial
- [Stripe Webhook Documentation](https://docs.stripe.com/billing/subscriptions/webhooks) - Subscription lifecycle events
- [Next.js JSON-LD Guide](https://nextjs.org/docs/app/guides/json-ld) - Structured data implementation
- [Next.js Sitemap API](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) - Dynamic sitemap generation
- [Next.js Robots.txt API](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots) - Dynamic robots.txt
- [Google FAQPage Schema](https://developers.google.com/search/docs/appearance/structured-data/faqpage) - FAQ structured data
- [Google SoftwareApplication Schema](https://developers.google.com/search/docs/appearance/structured-data/software-app) - Software app structured data
- [Google Speakable Schema](https://developers.google.com/search/docs/appearance/structured-data/speakable) - Voice assistant markup

### Secondary (MEDIUM confidence)
- [Stripe Seat-Based Pricing](https://docs.stripe.com/subscriptions/pricing-models/per-seat-pricing) - Per-seat billing patterns
- [Core Web Vitals Optimization](https://vercel.com/kb/guide/optimizing-core-web-vitals-in-2024) - LCP, CLS, INP optimization
- [SaaS Pricing Page Best Practices](https://www.designstudiouiux.com/blog/saas-pricing-page-design-best-practices/) - Pricing page design patterns

### Tertiary (LOW confidence)
- Competitor pricing research from context (needs validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using already-installed Stripe and Next.js with official documentation
- Architecture: HIGH - Patterns directly from Stripe and Next.js official docs
- Pitfalls: HIGH - Well-documented issues from official Stripe docs and community
- SEO schemas: MEDIUM - Google guidelines clear, but Speakable is beta

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - Stripe and Next.js are stable)
