# Phase 2: Core Slack Response Suggestions - Research

**Researched:** 2026-01-26
**Domain:** Slack Bolt event handling, interactive components, AI context management
**Confidence:** HIGH

## Summary

This research covers implementing AI-powered response suggestions in Slack using the Bolt framework (v3.22). The standard approach involves:

1. **Event listeners** for detecting mentions, replies, and thread messages
2. **Message shortcuts** (right-click actions) for on-demand suggestions
3. **Ephemeral messages** with interactive buttons for private suggestions
4. **Modal views** for multi-turn refinement conversations
5. **Slash commands** for conversation watch/unwatch management
6. **Context retrieval** via conversations.history/replies APIs
7. **BullMQ job queue** for async AI processing (already implemented in Phase 1)

The Slack ecosystem is mature with comprehensive official documentation. Key constraints include:
- Apps cannot post as users (copy/paste workflow required)
- Ephemeral messages cannot be updated via API (only via response_url from interactions)
- 3-second acknowledgment requirement for all interactions
- Clipboard copy requires user interaction (cannot be triggered programmatically by server)
- Rate limits on conversations.* APIs (1 req/min for non-Marketplace apps as of March 2026)

**Primary recommendation:** Use Slack Bolt's event listeners (`app.event()`, `app.message()`, `app.shortcut()`, `app.action()`, `app.view()`, `app.command()`) combined with BullMQ for async AI processing. Store conversation context in database, fetch recent messages on-demand, and use `private_metadata` for modal state management.

## Standard Stack

The established libraries/tools for Slack AI response apps:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @slack/bolt | 3.22.0 | Slack app framework | Official Slack framework, handles OAuth, events, interactions, views |
| @slack/web-api | (via Bolt) | Slack API client | Included in Bolt, provides type-safe API methods |
| bullmq | 5.28.2+ | Job queue | Industry standard for Redis-backed async processing (already in Phase 1) |
| ioredis | 5.4.2+ | Redis client | Required by BullMQ, high performance (already in Phase 1) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.24.1+ | Schema validation | Validating event payloads, user inputs (already in Phase 1) |
| drizzle-orm | 0.38.3+ | Database ORM | Storing user preferences, conversation tracking (already in Phase 1) |
| pino | 9.6.0+ | Logging | Structured logging for debugging (already in Phase 1) |
| date-fns | 4.1.0+ | Date utilities | Timestamp calculations for context windows (already in Phase 1) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @slack/bolt | Direct Events API + Web API | More control but requires reimplementing OAuth, retries, error handling |
| BullMQ | Temporal, Inngest | More features but higher complexity, BullMQ sufficient for this use case |
| Modal refinement | Threaded DM conversation | Simpler but less structured, harder to track conversation state |

**Installation:**
```bash
# All dependencies already installed in Phase 1
npm install
```

## Architecture Patterns

### Recommended Project Structure
```
apps/slack-backend/src/
├── handlers/           # Event, action, view, command handlers
│   ├── events/        # app_mention, message listeners
│   ├── shortcuts/     # Message action handlers
│   ├── actions/       # Button click handlers
│   ├── views/         # Modal submission handlers
│   └── commands/      # Slash command handlers
├── jobs/              # BullMQ workers (already exists)
│   ├── workers/       # AI suggestion generation workers
│   └── queues.ts      # Queue definitions
├── services/          # Business logic
│   ├── context.ts     # Conversation context retrieval
│   ├── suggestions.ts # AI prompt construction
│   └── tracking.ts    # User preference management
└── utils/             # Helpers (already exists)
```

### Pattern 1: Event-Driven Suggestion Flow
**What:** Listen for Slack events, enqueue AI job, send ephemeral message when complete
**When to use:** App mentions, replies to user, new thread messages

**Example:**
```typescript
// Source: https://docs.slack.dev/tools/bolt-js/concepts/event-listening/
import { app } from './app.js';
import { suggestionQueue } from './jobs/queues.js';

// Listen for app mentions
app.event('app_mention', async ({ event, ack, logger }) => {
  await ack();

  // Enqueue suggestion generation job
  await suggestionQueue.add('generate-suggestion', {
    userId: event.user,
    channelId: event.channel,
    triggerId: event.ts,
    contextType: 'mention',
  });

  logger.info({ event: event.ts }, 'Enqueued suggestion for mention');
});

// Listen for replies to monitored conversations
app.message(async ({ message, logger }) => {
  // Filter for message_replied subtype
  if (message.subtype === 'message_replied') {
    // Check if user being replied to is watching this conversation
    const isWatching = await checkIfUserWatching(message.user, message.channel);

    if (isWatching) {
      await suggestionQueue.add('generate-suggestion', {
        userId: message.user,
        channelId: message.channel,
        threadTs: message.thread_ts,
        contextType: 'reply',
      });
    }
  }
});
```

### Pattern 2: Message Shortcut Handler
**What:** Handle right-click "Help me respond" action
**When to use:** User-initiated suggestions for any message

**Example:**
```typescript
// Source: https://docs.slack.dev/interactivity/implementing-shortcuts
app.shortcut('help_me_respond', async ({ shortcut, ack, logger }) => {
  await ack();

  // Enqueue suggestion with full message context
  await suggestionQueue.add('generate-suggestion', {
    userId: shortcut.user.id,
    channelId: shortcut.channel.id,
    messageTs: shortcut.message.ts,
    messageText: shortcut.message.text,
    contextType: 'shortcut',
  });

  logger.info({ shortcut: shortcut.callback_id }, 'Enqueued shortcut suggestion');
});
```

### Pattern 3: Ephemeral Message with Actions
**What:** Send private suggestion with Copy and Refine buttons
**When to use:** After AI suggestion is generated

**Example:**
```typescript
// Source: https://docs.slack.dev/tools/bolt-js/concepts/message-sending/
async function sendSuggestion(client, userId, channelId, suggestion) {
  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: 'AI-generated response suggestion',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Suggested Response:*\n${suggestion}`,
        },
      },
      {
        type: 'actions',
        block_id: 'suggestion_actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Copy' },
            action_id: 'copy_suggestion',
            value: suggestion, // Include text in value for button handler
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Refine' },
            action_id: 'refine_suggestion',
            value: JSON.stringify({ suggestion, contextId: 'xyz' }),
          },
        ],
      },
    ],
  });
}
```

### Pattern 4: Modal for Refinement Conversation
**What:** Open modal for back-and-forth with AI to adjust suggestion
**When to use:** User clicks "Refine" button

**Example:**
```typescript
// Source: https://docs.slack.dev/surfaces/modals
app.action('refine_suggestion', async ({ body, ack, client }) => {
  await ack();

  const { suggestion, contextId } = JSON.parse(body.actions[0].value);

  // Open modal with suggestion and text input
  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: 'modal',
      callback_id: 'refinement_modal',
      title: { type: 'plain_text', text: 'Refine Suggestion' },
      submit: { type: 'plain_text', text: 'Update' },
      close: { type: 'plain_text', text: 'Cancel' },
      private_metadata: JSON.stringify({ contextId, suggestion }),
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Current suggestion:*\n${suggestion}`,
          },
        },
        {
          type: 'input',
          block_id: 'refinement_input',
          element: {
            type: 'plain_text_input',
            action_id: 'refinement_text',
            placeholder: { type: 'plain_text', text: 'How should I adjust this?' },
          },
          label: { type: 'plain_text', text: 'Refinement request' },
        },
      ],
    },
  });
});

// Handle modal submission
app.view('refinement_modal', async ({ ack, body, view, client }) => {
  await ack();

  const { contextId, suggestion } = JSON.parse(view.private_metadata);
  const refinementRequest = view.state.values.refinement_input.refinement_text.value;

  // Enqueue refinement job
  await suggestionQueue.add('refine-suggestion', {
    userId: body.user.id,
    originalSuggestion: suggestion,
    refinementRequest,
    contextId,
  });
});
```

### Pattern 5: Slash Command for Watch Management
**What:** `/watch` and `/unwatch` commands to toggle conversation monitoring
**When to use:** User wants explicit control over which conversations trigger suggestions

**Example:**
```typescript
// Source: https://docs.slack.dev/interactivity/implementing-slash-commands
app.command('/watch', async ({ command, ack, respond }) => {
  await ack();

  const { user_id, channel_id } = command;

  // Save watch preference to database
  await db.insert(watchedConversations).values({
    userId: user_id,
    channelId: channel_id,
    watchedAt: new Date(),
  });

  await respond({
    response_type: 'ephemeral',
    text: `You're now watching this conversation. You'll receive AI suggestions when mentioned or replied to.`,
  });
});

app.command('/unwatch', async ({ command, ack, respond }) => {
  await ack();

  const { user_id, channel_id } = command;

  // Remove watch preference
  await db.delete(watchedConversations)
    .where(eq(watchedConversations.userId, user_id))
    .where(eq(watchedConversations.channelId, channel_id));

  await respond({
    response_type: 'ephemeral',
    text: `You've unwatched this conversation. You won't receive automatic suggestions here.`,
  });
});
```

### Pattern 6: Context Retrieval with Sliding Window
**What:** Fetch recent conversation history with rate limit awareness
**When to use:** Building context for AI suggestion generation

**Example:**
```typescript
// Source: https://docs.slack.dev/reference/methods/conversations.replies
import { subMinutes } from 'date-fns';

async function getConversationContext(
  client,
  channelId: string,
  threadTs?: string,
  maxMessages = 20
) {
  const oldest = subMinutes(new Date(), 60).getTime() / 1000; // Last hour

  if (threadTs) {
    // Get thread context
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: maxMessages,
      oldest: oldest.toString(),
    });

    return result.messages || [];
  } else {
    // Get channel context
    const result = await client.conversations.history({
      channel: channelId,
      limit: maxMessages,
      oldest: oldest.toString(),
    });

    return result.messages || [];
  }
}
```

### Pattern 7: Copy Button Workaround
**What:** Instruct user to select and copy text manually (Slack limitations)
**When to use:** Copy button clicked

**Example:**
```typescript
// Source: https://web.dev/patterns/clipboard/copy-text (web standards)
// Note: Slack does not support programmatic clipboard access
app.action('copy_suggestion', async ({ ack, respond, body }) => {
  await ack();

  // Cannot programmatically copy to clipboard in Slack
  // Provide clear instructions instead
  await respond({
    response_type: 'ephemeral',
    text: `To copy the suggestion:\n1. Select the text above\n2. Copy it (Cmd+C / Ctrl+C)\n3. Paste it into your message`,
  });
});
```

### Anti-Patterns to Avoid
- **Posting as user:** Slack prohibits apps from posting messages as users. Always use copy/paste workflow.
- **Updating ephemeral messages via API:** Can only update ephemeral messages via `response_url` from interactions, not via `chat.update`.
- **Excessive API calls:** Rate limits are strict (1 req/min for conversations.* as of March 2026). Cache context, batch requests.
- **Processing in event handler:** Always acknowledge within 3 seconds, then process async via job queue.
- **Storing full message history:** Store metadata only, fetch messages on-demand to comply with Slack's data practices.
- **Ignoring thread structure:** Always use `thread_ts` for thread replies, check if `ts === thread_ts` to identify parent messages.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slack OAuth flow | Custom token storage | Bolt's `installationStore` | Handles encryption, token refresh, multi-workspace installs |
| Event retry logic | Custom retry system | Bolt's built-in retries | Automatically retries failed events with exponential backoff |
| Interactive component routing | URL-based routing | Bolt's `action()`, `view()` | Type-safe, handles acknowledgments automatically |
| Rate limit handling | Custom backoff | Bolt + BullMQ rate limiting | Bolt respects `Retry-After` headers, BullMQ has built-in rate limiting |
| Clipboard copy | Server-side clipboard API | User instructions | Web Clipboard API requires user gesture, not accessible from server |
| Conversation threading | Custom thread tracking | Slack's `thread_ts` | Slack maintains thread relationships, use official field |
| Modal state | Session store | `private_metadata` | Built into Slack modals, 3000 char limit sufficient for most use cases |
| Prompt injection defense | Custom sanitization | Existing validation package | Phase 1 already has 4-layer defense implemented |

**Key insight:** Slack Bolt framework handles the complex protocol details (event acknowledgment, retries, OAuth, signature verification). Focus on business logic, not plumbing.

## Common Pitfalls

### Pitfall 1: 3-Second Acknowledgment Timeout
**What goes wrong:** Event handlers that process AI requests synchronously timeout, causing errors visible to users
**Why it happens:** AI processing takes longer than 3 seconds, Slack requires acknowledgment within 3 seconds
**How to avoid:**
- Call `ack()` immediately at start of handler
- Enqueue job to BullMQ for async processing
- Send results via separate API call (not in handler)
**Warning signs:** Users see "Operation timed out" errors, Slack disables event subscriptions

### Pitfall 2: Rate Limit Exhaustion on conversations.* APIs
**What goes wrong:** App hits 1 request/minute limit, context retrieval fails
**Why it happens:** March 2026 rate limit changes for non-Marketplace apps, frequent context fetching
**How to avoid:**
- Cache conversation context in database with TTL
- Fetch context only when generating suggestions, not on every event
- Use BullMQ rate limiting to throttle context retrieval jobs
- Consider batching suggestions if multiple needed
**Warning signs:** HTTP 429 errors, `Retry-After` headers, failed suggestion generation

### Pitfall 3: Ephemeral Message Update Failures
**What goes wrong:** Attempting to update ephemeral message via `chat.update` fails silently
**Why it happens:** Ephemeral messages can only be updated via `response_url` from interactions
**How to avoid:**
- Store `response_url` from button clicks (valid 30 minutes)
- Update via POST to `response_url`, not `chat.update` API
- If `response_url` expired, send new ephemeral message
**Warning signs:** Updates don't appear, no error messages (fails silently)

### Pitfall 4: Message Shortcut on Ephemeral Messages
**What goes wrong:** "Help me respond" shortcut doesn't appear on ephemeral suggestions
**Why it happens:** Slack disables message shortcuts on ephemeral messages
**How to avoid:**
- Accept limitation, document that shortcut only works on regular messages
- Provide alternative trigger (slash command in channel)
**Warning signs:** User confusion about why shortcut sometimes missing

### Pitfall 5: private_metadata Size Overflow
**What goes wrong:** Modal fails to open with vague error
**Why it happens:** `private_metadata` exceeds 3000 character limit
**How to avoid:**
- Store minimal data (IDs, not full text)
- Store large context in database, reference by ID
- Compress JSON before stringifying if needed
**Warning signs:** Modal operations fail with "invalid_arguments" error

### Pitfall 6: Context Scope Blindness
**What goes wrong:** Suggestion lacks important context because wrong API used
**Why it happens:** `conversations.history` excludes thread replies, `conversations.replies` requires parent `ts`
**How to avoid:**
- Use `conversations.replies` for thread context (includes parent + replies)
- Use `conversations.history` for channel context (parent messages only)
- Check if `thread_ts` exists to determine which API to call
**Warning signs:** AI suggestions that ignore thread context, incomplete conversation history

### Pitfall 7: Event Deduplication Omission
**What goes wrong:** Same event processed multiple times, duplicate suggestions sent
**Why it happens:** Slack retries events if not acknowledged quickly enough
**How to avoid:**
- Check for `x-slack-retry-num` header (values: 1, 2, 3)
- Use event `ts` + `channel` as idempotency key in job queue
- BullMQ's `jobId` option prevents duplicate jobs
**Warning signs:** Users receive multiple identical suggestions, logs show duplicate events

### Pitfall 8: Thread Detection Logic Errors
**What goes wrong:** App treats thread replies as channel messages or vice versa
**Why it happens:** Confusion about `thread_ts` vs `ts` fields
**How to avoid:**
- Parent message: `ts === thread_ts` (or `thread_ts` doesn't exist)
- Thread reply: `ts !== thread_ts` and `thread_ts` exists
- Always check both fields before determining message type
**Warning signs:** Wrong context fetched, suggestions for wrong conversation

## Code Examples

Verified patterns from official sources:

### Event Listener with Subtype Filtering
```typescript
// Source: https://docs.slack.dev/tools/bolt-js/concepts/message-listening
import { App, subtype } from '@slack/bolt';

// Listen for message_replied events
app.message(subtype('message_replied'), async ({ message, logger }) => {
  logger.info({ message }, 'User replied to message');

  // message.message contains the reply details
  // message.message.thread_ts is the parent message timestamp
});
```

### Modal with private_metadata State Management
```typescript
// Source: https://docs.slack.dev/surfaces/modals
// Opening modal with state
await client.views.open({
  trigger_id: body.trigger_id,
  view: {
    type: 'modal',
    callback_id: 'refinement_modal',
    private_metadata: JSON.stringify({
      contextId: 'conv_123',
      originalSuggestion: 'Original text here',
      messageTs: '1234567890.123456',
    }),
    // ... blocks
  },
});

// Retrieving state in submission handler
app.view('refinement_modal', async ({ ack, view }) => {
  await ack();

  const metadata = JSON.parse(view.private_metadata);
  const { contextId, originalSuggestion, messageTs } = metadata;

  // Use metadata to continue workflow
});
```

### Rate-Limited Context Retrieval
```typescript
// Source: https://docs.slack.dev/reference/methods/conversations.history
import { RateLimiterMemory } from 'rate-limiter-flexible';

// 1 request per minute for non-Marketplace apps
const rateLimiter = new RateLimiterMemory({
  points: 1,
  duration: 60,
});

async function fetchContextWithRateLimit(client, channel, threadTs) {
  try {
    await rateLimiter.consume(channel);

    const result = await client.conversations.replies({
      channel,
      ts: threadTs,
      limit: 20,
    });

    return result.messages;
  } catch (rateLimiterRes) {
    // Rate limit hit, retry after duration
    const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
    throw new Error(`Rate limited, retry after ${retryAfter}s`);
  }
}
```

### Slash Command with Escape Parsing
```typescript
// Source: https://docs.slack.dev/interactivity/implementing-slash-commands
app.command('/watch', async ({ command, ack, respond, client }) => {
  await ack();

  // command.channel_id is properly escaped (C123456)
  // command.user_id is properly escaped (U123456)
  // Enable "Escape channels, users, and links" in app config

  const channelInfo = await client.conversations.info({
    channel: command.channel_id,
  });

  await respond({
    response_type: 'ephemeral',
    text: `Now watching #${channelInfo.channel.name}`,
  });
});
```

### Response URL for Ephemeral Updates
```typescript
// Source: https://docs.slack.dev/interactivity/handling-user-interaction
app.action('refine_suggestion', async ({ ack, body, respond }) => {
  await ack();

  // body.response_url is valid for 30 minutes
  const responseUrl = body.response_url;

  // Store response_url for later use
  await redis.setex(
    `response_url:${body.user.id}`,
    1800, // 30 minutes
    responseUrl
  );

  // Later: update the ephemeral message
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      replace_original: true,
      text: 'Updated suggestion here',
    }),
  });
});
```

### BullMQ Job with Idempotency
```typescript
// Source: https://docs.bullmq.io/guide/jobs/job-ids
import { Queue } from 'bullmq';

const suggestionQueue = new Queue('suggestions', { connection: redis });

// Prevent duplicate jobs with jobId
await suggestionQueue.add(
  'generate-suggestion',
  {
    userId: event.user,
    channelId: event.channel,
    messageTs: event.ts,
  },
  {
    jobId: `suggestion:${event.channel}:${event.ts}`, // Idempotency key
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dialogs | Modals with Block Kit | 2019-2020 | Modals support richer UX, view stacks, better state management |
| Legacy message buttons | Block Kit actions | 2019-2020 | Block Kit provides consistent design, better accessibility |
| conversations.* unlimited | 1 req/min rate limit (non-Marketplace) | March 2026 | Must cache aggressively, design for rate limits from start |
| Custom message attachments | Block Kit components | 2019-2020 | Block Kit is the standard, attachments deprecated |
| Socket Mode optional | Recommended for development | 2022+ | Simpler dev setup, no need for public URLs |
| Classic Slack apps | Granular OAuth scopes | Deprecated May 2026 | Must migrate to new app framework by May 25, 2026 |
| Storing full Slack data | Store metadata only | 2023+ (best practice) | Compliance with data minimization, Slack recommends real-time fetch |

**Deprecated/outdated:**
- **Dialogs:** Replaced by modals in 2019. Use `views.open()` instead of `dialogs.open()`.
- **Message attachments:** Use Block Kit instead. Attachments still work but not recommended.
- **Classic apps:** Must migrate to granular scopes by May 25, 2026.
- **unlimited conversations.* calls:** Rate limited as of March 3, 2026 for non-Marketplace apps.

## Open Questions

Things that couldn't be fully resolved:

1. **Clipboard Copy UX**
   - What we know: Slack doesn't support programmatic clipboard access, Web Clipboard API requires user gesture
   - What's unclear: Best UX pattern for instructing users to copy (tooltip? inline message? modal?)
   - Recommendation: Test with real users, measure if users understand instructions. Consider adding "auto-select text" feature if feasible.

2. **AI Streaming in Ephemeral Messages**
   - What we know: Slack has new streaming APIs (`chat.startStream`, `chat.appendStream`, `chat.stopStream`) for Agents & AI apps
   - What's unclear: Whether streaming works with ephemeral messages or only in split-view/threads
   - Recommendation: Implement basic approach (send complete suggestion), explore streaming in future phase if beneficial.

3. **Thread Participation Detection**
   - What we know: Can detect when user posts in thread, can fetch thread history
   - What's unclear: Best way to determine "user participates in this thread" (posted in past? replied to? mentioned?)
   - Recommendation: Define participation as "user has posted at least one message in thread in last 7 days", store in database for performance.

4. **Context Window Size**
   - What we know: Modern LLMs support 128K-200K tokens, context window management is critical
   - What's unclear: Optimal message count for Slack suggestions (too few = missing context, too many = noise + cost)
   - Recommendation: Start with 20 most recent messages in sliding window, monitor AI quality, adjust based on feedback.

5. **Rate Limit Workarounds**
   - What we know: 1 req/min limit for conversations.* APIs (non-Marketplace apps)
   - What's unclear: Whether Marketplace submission is worthwhile for this app
   - Recommendation: Implement aggressive caching first. If rate limits become blocking, evaluate Marketplace submission effort vs. benefit.

## Sources

### Primary (HIGH confidence)
- [Slack Bolt for JavaScript Documentation](https://docs.slack.dev/tools/bolt-js/) - Official framework docs
- [Slack Events API Reference](https://docs.slack.dev/reference/events/) - Event payload structures
- [Slack Web API Methods](https://docs.slack.dev/reference/methods/) - API method specifications
- [Slack Modals Documentation](https://docs.slack.dev/surfaces/modals/) - Modal views, private_metadata
- [Slack Interactivity Guide](https://docs.slack.dev/interactivity/handling-user-interaction/) - Actions, shortcuts, commands
- [Slack AI Apps Best Practices](https://docs.slack.dev/ai/ai-apps-best-practices/) - Official AI app guidance
- [conversations.replies API](https://docs.slack.dev/reference/methods/conversations.replies/) - Thread context retrieval
- [conversations.history API](https://docs.slack.dev/reference/methods/conversations.history/) - Channel history retrieval

### Secondary (MEDIUM confidence)
- [Slack Bolt Event Listening](https://docs.slack.dev/tools/bolt-js/concepts/event-listening/) - Event handler patterns
- [Slack Message Listening](https://docs.slack.dev/tools/bolt-js/concepts/message-listening/) - Subtype filtering
- [Implementing Shortcuts](https://docs.slack.dev/interactivity/implementing-shortcuts/) - Message shortcut creation
- [Implementing Slash Commands](https://docs.slack.dev/interactivity/implementing-slash-commands/) - Command handling
- [Slack Rate Limits](https://docs.slack.dev/apis/web-api/rate-limits/) - Rate limit specifications
- [Slack Message Metadata](https://docs.slack.dev/messaging/message-metadata/) - Metadata patterns
- [BullMQ Documentation](https://docs.bullmq.io/) - Job queue patterns (already used in Phase 1)

### Tertiary (LOW confidence - requires validation)
- Web searches on AI context management best practices (general patterns, not Slack-specific)
- Web searches on clipboard copy patterns (web standards, may not apply fully to Slack)
- Community blog posts on Slack app development (not official, may be outdated)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries officially documented, versions verified from package.json
- Architecture: HIGH - Patterns sourced from official Slack documentation with code examples
- Pitfalls: HIGH - Based on official docs, known Slack limitations, and WebSearch cross-referenced with official sources
- AI integration: MEDIUM - General AI patterns are well-documented, but Slack-specific AI patterns are newer (streaming APIs announced 2025-2026)
- Clipboard copy: MEDIUM - Web Clipboard API is standard, but Slack-specific constraints require validation

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - Slack API is stable, but AI features evolving rapidly)

**Notes:**
- Phase 1 already completed: OAuth, encryption, BullMQ, validation, error handling all in place
- Slack Bolt 3.22 is current, no major version changes expected short-term
- Rate limit changes effective March 3, 2026 must be considered in implementation
- Classic app migration deadline May 25, 2026 (not relevant - using new framework already)
