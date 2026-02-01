# Phase 6: Production Polish & Admin - Research

**Researched:** 2026-02-01
**Domain:** Production bug fixes, UX improvements, Slack event filtering, admin panel
**Confidence:** HIGH

## Summary

Phase 6 addresses production issues in the live Slack app and adds admin management capabilities. The research covers three main areas: (1) Slack event filtering bugs where the app responds incorrectly to mentions without /watch and to user's own messages, (2) web portal UX issues including showing channel IDs instead of names and limited feedback tracking, and (3) adding an admin panel for organization/user/billing management.

The primary technical challenges are around Slack Bolt event filtering patterns, particularly for DMs where the `ignoreSelf` middleware has known issues, and implementing proper `channel_type` checking. The web portal improvements are straightforward Next.js enhancements. The admin panel requires new database schema for organizations and role-based access control, plus Stripe integration for billing.

**Primary recommendation:** Fix Slack event filtering first (highest user impact), then UX improvements, then admin panel (separate scope).

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @slack/bolt | 3.22+ | Slack app framework | Official Slack SDK, event handling |
| Next.js | 16 | Web portal | Already in use, React 19 support |
| shadcn/ui | latest | UI components | Already in use, Radix-based |
| Drizzle ORM | latest | Database access | Already in use |

### Supporting (New for Admin)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| stripe | 17+ | Billing/subscriptions | Per-seat subscription management |
| @stripe/stripe-js | latest | Client-side Stripe | Payment forms, customer portal |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe | Clerk Billing | Clerk Billing is newer but Stripe is more mature and flexible |
| Custom admin | Retool/AdminJS | Custom is better for tight integration with existing portal |

**Installation:**
```bash
npm install stripe @stripe/stripe-js --workspace=@slack-speak-for-me/web-portal
```

## Architecture Patterns

### Recommended Project Structure
```
apps/slack-backend/src/
├── handlers/events/        # Event handlers with proper filtering
│   ├── app-mention.ts     # Check isWatching before processing
│   └── message-reply.ts   # Filter own messages, check channel_type
├── services/watch.ts      # Add DM support (im channel type)

apps/web-portal/
├── app/admin/             # Admin section (new)
│   ├── layout.tsx        # Admin layout with role check
│   ├── organizations/    # Org management
│   ├── users/           # User management
│   └── billing/         # Billing dashboard
├── lib/db/
│   └── admin-queries.ts  # Admin-specific queries
```

### Pattern 1: Slack Event Filtering for Watch Requirement
**What:** Check if user has /watch active before processing app_mention events
**When to use:** app_mention handler - should only trigger if channel is watched
**Example:**
```typescript
// Source: Existing codebase pattern + research
app.event('app_mention', async ({ event, client }) => {
  const workspaceId = await getWorkspaceId(teamId);

  // FIX: Check if user is watching this channel
  const isWatchingChannel = await isWatching(workspaceId, event.user, event.channel);
  if (!isWatchingChannel) {
    logger.debug({ channel: event.channel, user: event.user }, 'Ignoring mention - channel not watched');
    return;
  }

  // Continue with AI suggestion...
});
```

### Pattern 2: Filtering Own Messages
**What:** Don't trigger suggestions for user's own messages
**When to use:** message event handler - user sending message shouldn't trigger their own suggestion
**Example:**
```typescript
// Source: Slack Bolt ignoreSelf + manual check pattern
app.message(async ({ message, client }) => {
  // Filter bot messages (already exists)
  if ('bot_id' in message || 'subtype' in message) return;

  // Extract user ID from message
  const messageAuthorId = message.user;

  // For each participant we're checking...
  for (const participantUserId of participantUserIds) {
    // FIX: Skip if the message author IS the watching user
    if (messageAuthorId === participantUserId) {
      logger.debug({ user: participantUserId }, 'Skipping - user is message author');
      continue;
    }

    // Continue with AI suggestion for this watcher...
  }
});
```

### Pattern 3: DM Message Handling with channel_type
**What:** Handle messages in DM conversations (channel_type: "im")
**When to use:** /watch in DM should trigger on incoming messages
**Example:**
```typescript
// Source: GitHub bolt-js issues #580, #601
app.message(async ({ message, client }) => {
  // Type guard for channel_type
  const channelType = 'channel_type' in message ? message.channel_type : undefined;

  // For DM conversations (im), watch triggers directly
  if (channelType === 'im') {
    // Check if user is watching this DM
    const isWatchingDM = await isWatching(workspaceId, userId, channelId);
    if (isWatchingDM && messageAuthorId !== userId) {
      // Queue AI suggestion for the watcher
      await queueAIResponse({ ... });
    }
    return;
  }

  // Existing thread-based logic for channels...
});
```

### Pattern 4: Stripe Per-Seat Billing
**What:** Quantity-based subscription with seat management
**When to use:** Organization billing with multiple users
**Example:**
```typescript
// Source: Stripe docs - subscriptions/quantities
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create subscription with seats
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{
    price: 'price_per_seat_monthly',
    quantity: seatCount,
  }],
  payment_behavior: 'default_incomplete',
  expand: ['latest_invoice.payment_intent'],
});

// Update seat count
await stripe.subscriptions.update(subscriptionId, {
  items: [{
    id: subscriptionItemId,
    quantity: newSeatCount,
  }],
  proration_behavior: 'create_prorations',
});

// Customer portal for self-service
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: 'https://speakforme.app/dashboard/billing',
});
```

### Anti-Patterns to Avoid
- **Relying solely on ignoreSelf for DMs:** The middleware doesn't work properly in IM channels because bot messages lack the `bot_message` subtype. Always manually check `bot_id` or compare user IDs.
- **Calling conversations.info for every message:** Cache channel info or store channel names in the database when /watch is called.
- **Updating Stripe quantities in a loop:** Use atomic operations or usage-based billing if quantities change frequently.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription billing | Custom payment tracking | Stripe Subscriptions | Handles proration, failed payments, invoices |
| Customer payment portal | Custom billing UI | Stripe Customer Portal | Pre-built, PCI compliant, maintained |
| Channel name resolution | Manual API calls per render | Cache in DB + background refresh | Rate limits, performance |
| Admin role checking | Manual user role checks | Middleware + session role | Consistent, secure |

**Key insight:** Stripe handles all the complexity of subscription lifecycle (trials, upgrades, downgrades, cancellations, failed payments) that would take months to build correctly.

## Common Pitfalls

### Pitfall 1: app_mention Without Watch Check
**What goes wrong:** Bot responds to every @mention even when user hasn't enabled /watch
**Why it happens:** app_mention handler processes events immediately without checking watched_conversations table
**How to avoid:** Add `isWatching()` check at the start of app_mention handler
**Warning signs:** Users complaining about unsolicited suggestions

### Pitfall 2: ignoreSelf Not Working in DMs
**What goes wrong:** Bot triggers on its own messages in DM conversations
**Why it happens:** In IM channels, bot messages don't have `subtype: "bot_message"` so ignoreSelf middleware fails
**How to avoid:** Manually check if `message.user` equals the watcher's user ID or if `bot_id` exists
**Warning signs:** Infinite loops or duplicate suggestions in DMs

### Pitfall 3: DM Watch Not Triggering
**What goes wrong:** /watch in DM conversation doesn't trigger suggestions on new messages
**Why it happens:** Current message-reply handler only processes thread messages, not top-level DM messages
**How to avoid:** Check `channel_type === 'im'` and handle DMs with different logic than thread replies
**Warning signs:** Users reporting /watch doesn't work in DMs

### Pitfall 4: Channel Names Showing as IDs
**What goes wrong:** Web portal displays "C04XXXXXX" instead of "#general"
**Why it happens:** Database stores channel IDs, names require Slack API call
**How to avoid:** Either store channel name when /watch is called, or cache API responses
**Warning signs:** UX complaints about unreadable channel list

### Pitfall 5: Feedback Type Misclassification
**What goes wrong:** AI Learning tab shows "refined" when user actually accepted suggestion as-is
**Why it happens:** No tracking of "accepted without changes" vs "refined then accepted"
**How to avoid:** Track acceptance events separately from refinement events in database
**Warning signs:** Inaccurate AI learning statistics

### Pitfall 6: Stripe Quantity Race Conditions
**What goes wrong:** Seat count becomes incorrect when multiple admins add users simultaneously
**Why it happens:** Read-modify-write pattern isn't atomic
**How to avoid:** Use Stripe's subscription update with specific quantity, or use usage-based billing
**Warning signs:** Billing discrepancies, seat count mismatches

## Code Examples

Verified patterns from official sources and existing codebase:

### Channel Name Resolution (Cache Pattern)
```typescript
// Source: Existing conversation-list.tsx pattern + optimization
// Store channel name when /watch is called
export async function watchConversation(
  workspaceId: string,
  userId: string,
  channelId: string,
  channelName?: string  // NEW: Optional channel name
): Promise<void> {
  await db.insert(watchedConversations).values({
    workspaceId,
    userId,
    channelId,
    channelName,  // Store for display
  }).onConflictDoNothing();
}

// Get channel info once during /watch command
const channelInfo = await client.conversations.info({ channel: channel_id });
const channelName = channelInfo.channel?.name;
await watchConversation(workspaceId, user_id, channel_id, channelName);
```

### Track Suggestion Acceptance
```typescript
// Source: New pattern for tracking accepted vs refined
// New schema addition
export const suggestionFeedback = pgTable('suggestion_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull(),
  suggestionId: text('suggestion_id').notNull(),
  action: text('action').notNull(), // 'accepted' | 'refined' | 'dismissed' | 'sent'
  originalText: text('original_text'),
  finalText: text('final_text'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Track when user clicks "Copy" without refinement
async function trackAcceptance(workspaceId: string, userId: string, suggestionId: string, suggestion: string) {
  await db.insert(suggestionFeedback).values({
    workspaceId,
    userId,
    suggestionId,
    action: 'accepted',
    originalText: suggestion,
    finalText: suggestion,
  });
}
```

### Admin Role Check Middleware
```typescript
// Source: Next.js auth patterns + existing dal.ts
// lib/auth/admin.ts
export async function requireAdmin() {
  const session = await verifySession();

  // Check admin role in database
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.workspaceId, session.workspaceId),
        eq(users.slackUserId, session.userId),
        eq(users.role, 'admin')
      )
    )
    .limit(1);

  if (!user) {
    redirect('/dashboard');
  }

  return { ...session, role: 'admin' };
}
```

### DM Message Detection
```typescript
// Source: Slack API docs + bolt-js issues
interface MessageWithChannelType {
  channel_type?: 'channel' | 'group' | 'im' | 'mpim';
  channel: string;
  user?: string;
  ts: string;
  text?: string;
}

function isDMMessage(message: MessageWithChannelType): boolean {
  return message.channel_type === 'im' || message.channel.startsWith('D');
}

function isFromBot(message: any): boolean {
  return 'bot_id' in message || message.subtype === 'bot_message';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ignoreSelf middleware | Manual user ID comparison in DMs | Ongoing issue | Required for DM support |
| conversations.info per channel | Store channel name in DB | Best practice | Eliminates API calls |
| Custom billing UI | Stripe Customer Portal | Stripe 2024+ | Saves months of dev |

**Deprecated/outdated:**
- None identified for this domain

## Open Questions

Things that couldn't be fully resolved:

1. **Admin scope definition**
   - What we know: Requirements mention org/user/billing management
   - What's unclear: Is admin per-workspace or super-admin across all workspaces?
   - Recommendation: Implement workspace-level admin first, super-admin later

2. **Billing model specifics**
   - What we know: Per-seat subscription is the goal
   - What's unclear: Pricing tiers, trial periods, usage limits
   - Recommendation: Start with basic per-seat, expand later based on requirements

3. **Channel name refresh strategy**
   - What we know: Channel names can change in Slack
   - What's unclear: How often to refresh cached names
   - Recommendation: Refresh on /watch command + periodic background job (weekly)

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis - Current implementation patterns
- Slack Bolt.js GitHub issues #580, #601 - DM handling and ignoreSelf issues
- Stripe Subscriptions/Quantities docs - Per-seat billing patterns

### Secondary (MEDIUM confidence)
- Slack API events/message documentation - Message event structure
- Next.js forms guide - Server actions patterns
- shadcn/ui documentation - Component patterns

### Tertiary (LOW confidence)
- WebSearch results for admin dashboard templates - General patterns only

## Metadata

**Confidence breakdown:**
- Event filtering fixes: HIGH - Based on codebase analysis and official Slack docs
- UX improvements: HIGH - Straightforward Next.js patterns with existing components
- Admin panel: MEDIUM - New feature, patterns are standard but scope needs clarification
- Stripe integration: HIGH - Well-documented, standard patterns

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain)
