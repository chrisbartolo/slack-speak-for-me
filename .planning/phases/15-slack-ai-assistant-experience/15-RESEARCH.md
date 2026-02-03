# Phase 15: Slack AI Assistant Experience - Research

**Researched:** 2026-02-03
**Domain:** Slack AI Assistants, Bolt 4.x, Streaming APIs
**Confidence:** HIGH

## Summary

Slack's AI Assistant platform provides native side-panel UX for AI-powered apps, solving the DM delivery problem where bots cannot post ephemeral messages in user-to-user DMs. The assistant runs in a persistent side panel with streaming responses, context awareness, and interactive actions.

**Key architectural changes required:**
1. Upgrade Bolt 3.22 → 4.x with web-api v6 → v7 and Express v4 → v5
2. Enable "Agents & AI Apps" in Slack app settings and add assistant:write scope
3. Implement Assistant class with three event handlers: threadStarted, threadContextChanged, userMessage
4. Replace manual streaming with WebClient.chatStream() utility for LLM integration
5. Maintain backward compatibility by keeping ephemeral delivery for channels

**Primary recommendation:** Use Bolt's Assistant class with built-in ThreadContextStore for message metadata persistence, implement dual delivery (assistant panel for DMs, ephemeral for channels), and leverage chatStream() utility for seamless OpenAI/Claude integration.

## Standard Stack

The established libraries/tools for Slack AI assistants:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @slack/bolt | 4.6.0+ | Slack app framework with Assistant class | Official SDK, handles all assistant events natively |
| @slack/web-api | 7.x | Slack API client with streaming | Bundled in Bolt v4, provides chatStream() utility |
| @slack/types | Latest | TypeScript definitions | Now namespaced export (types.*) in Bolt v4 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| express | 5.x | HTTP server for custom routes | Required upgrade with Bolt v4's ExpressReceiver |
| @anthropic-ai/sdk | 0.71.2+ | Claude AI integration | Existing project dependency for LLM |
| Node.js | 18+ | Runtime environment | Required for Bolt v4, v14/v16 EOL |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Assistant class | Manual event listeners | Lose built-in context storage, status helpers, streaming utilities |
| chatStream() | Manual startStream/appendStream/stopStream | More boilerplate, need manual buffering logic |
| ThreadContextStore | Custom metadata solution | Reinvent message metadata persistence, error-prone |

**Installation:**
```bash
npm install @slack/bolt@^4.6.0
# Bolt v4 bundles @slack/web-api v7 and express v5 automatically
```

## Architecture Patterns

### Recommended Project Structure
```
apps/slack-backend/src/
├── assistant/                    # NEW: Assistant-specific code
│   ├── assistant.ts             # Assistant class setup
│   ├── handlers/                # Event handlers
│   │   ├── thread-started.ts    # threadStarted handler
│   │   ├── thread-context.ts    # threadContextChanged handler
│   │   └── user-message.ts      # userMessage handler
│   ├── streaming.ts             # chatStream integration
│   └── suggested-prompts.ts     # Context-aware prompt generation
├── handlers/                     # Existing handlers (unchanged)
├── services/
│   ├── suggestion-delivery.ts   # Keep for backward compatibility
│   └── ai.ts                    # Shared AI generation logic
└── app.ts                       # Bolt app with Assistant
```

### Pattern 1: Assistant Class Setup
**What:** Bolt v4's Assistant class abstracts assistant event handling with built-in context storage
**When to use:** For all assistant implementations
**Example:**
```typescript
// Source: https://docs.slack.dev/tools/bolt-js/concepts/ai-apps/
import { App, Assistant } from '@slack/bolt';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const assistant = new Assistant({
  threadStarted: async ({ say, setSuggestedPrompts, event }) => {
    // Welcome message
    await say("How can I help you?");

    // Context-aware prompts based on channel
    const prompts = await generatePrompts(event.context);
    await setSuggestedPrompts({ prompts });
  },

  threadContextChanged: async ({ saveThreadContext, event }) => {
    // Context store automatically persists via message metadata
    await saveThreadContext();
  },

  userMessage: async ({ say, client, setTitle, setStatus, event, context }) => {
    await setTitle("Generating response...");
    await setStatus("thinking...");

    // Streaming response
    const streamer = client.chatStream({
      channel: event.channel,
      thread_ts: event.thread_ts,
    });

    // Integrate with LLM (Claude, OpenAI, etc.)
    const stream = await generateAIResponse(event.text, context);
    for await (const chunk of stream) {
      await streamer.append({ markdown_text: chunk });
    }

    // Stop with feedback buttons
    await streamer.stop({
      blocks: [feedbackButtonsBlock()],
    });
  },
});

app.assistant(assistant);
```

### Pattern 2: Dual Delivery Mode
**What:** Support both assistant panel (for DMs) and ephemeral messages (for channels) simultaneously
**When to use:** During transition, for backward compatibility, when users haven't opened assistant
**Example:**
```typescript
// Source: Project context + https://docs.slack.dev/messaging/sending-and-scheduling-messages/
async function deliverSuggestion(options) {
  const { channelId, userId, suggestion, deliveryMode } = options;

  // Check user preference or conversation type
  if (deliveryMode === 'assistant' || channelId.startsWith('D')) {
    // Use assistant panel - requires user to have opened assistant
    // Assistant delivery happens via userMessage handler
    return 'assistant';
  } else {
    // Fall back to ephemeral for channels (existing behavior)
    await sendSuggestionEphemeral(options);
    return 'ephemeral';
  }
}
```

### Pattern 3: Streaming Integration with chatStream
**What:** WebClient.chatStream() utility simplifies three-method streaming workflow
**When to use:** For all streaming responses in assistant threads
**Example:**
```typescript
// Source: https://docs.slack.dev/tools/node-slack-sdk/reference/web-api/classes/WebClient/
const streamer = client.chatStream({
  channel: channelId,
  thread_ts: threadTs,
  // Optional buffering (default 256 chars)
  buffer_size: 128,
});

// Append chunks as they arrive from LLM
for await (const chunk of llmStream) {
  await streamer.append({ markdown_text: chunk });
}

// Stop with optional blocks (feedback buttons, etc.)
await streamer.stop({
  blocks: [
    {
      type: 'context_actions',
      elements: [{
        type: 'feedback_buttons',
        action_id: 'feedback',
        positive_button: {
          text: { type: 'plain_text', text: '👍 Good' },
          value: 'positive',
        },
        negative_button: {
          text: { type: 'plain_text', text: '👎 Bad' },
          value: 'negative',
        },
      }],
    },
  ],
});
```

### Pattern 4: Context-Aware Suggested Prompts
**What:** Dynamic prompts based on channel context, conversation history, user profile
**When to use:** In threadStarted and after context changes
**Example:**
```typescript
// Source: https://docs.slack.dev/ai/ai-apps-best-practices/
async function generateSuggestedPrompts(context) {
  const { channel_id, team_id } = context;

  // Fetch channel info to determine context
  const channelInfo = await client.conversations.info({ channel: channel_id });

  if (channelInfo.channel.is_im) {
    return [
      { message: "Help me respond professionally", title: "Professional tone" },
      { message: "Make this more concise", title: "Concise version" },
    ];
  } else {
    // Channel context - fetch recent messages
    const history = await client.conversations.history({
      channel: channel_id,
      limit: 5
    });

    return [
      { message: `Summarize the last ${history.messages.length} messages`, title: "Summarize" },
      { message: "What action items are there?", title: "Action items" },
    ];
  }
}
```

### Pattern 5: Feedback Buttons Block
**What:** context_actions block with feedback_buttons element for thumbs up/down
**When to use:** On every assistant response for quality tracking
**Example:**
```typescript
// Source: https://docs.slack.dev/reference/block-kit/block-elements/feedback-buttons-element/
function createFeedbackBlock(suggestionId: string) {
  return {
    type: 'context_actions',
    elements: [
      {
        type: 'feedback_buttons',
        action_id: 'ai_feedback',
        positive_button: {
          text: { type: 'plain_text', text: 'Good' },
          value: JSON.stringify({ suggestionId, feedback: 'positive' }),
          accessibility_label: 'Mark this response as good',
        },
        negative_button: {
          text: { type: 'plain_text', text: 'Bad' },
          value: JSON.stringify({ suggestionId, feedback: 'negative' }),
          accessibility_label: 'Mark this response as bad',
        },
      },
    ],
  };
}

// Handle feedback in action handler
app.action('ai_feedback', async ({ ack, body, client }) => {
  await ack();
  const value = JSON.parse(body.actions[0].value);
  // Store feedback in database for quality tracking
  await storeFeedback(value.suggestionId, value.feedback);
});
```

### Anti-Patterns to Avoid
- **Ignoring thread context in message.im events:** The message.im event doesn't include thread context; must use ThreadContextStore
- **Static suggested prompts:** Seeing same prompts repeatedly reduces user trust (use dynamic prompts based on context)
- **Manual streaming without buffering:** Use chatStream() utility instead of manual startStream/appendStream/stopStream
- **Not handling ephemeral fallback:** Always support ephemeral delivery for users who haven't opened assistant
- **Forgetting to clear status:** Call setStatus('') or provide final status when processing completes
- **Using standard markdown:** LLMs output markdown, but Slack requires mrkdwn syntax or Markdown block type

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Thread context persistence | Custom message metadata API | Assistant's ThreadContextStore | Built-in, automatic persistence via message metadata |
| Streaming response buffering | Manual chunk accumulation | chatStream() utility | Handles buffering, rate limits, error states |
| Assistant event routing | Manual event listener patterns | Assistant class | Type-safe handlers, built-in utilities (say, setTitle, setStatus) |
| Suggested prompts UI | Custom Block Kit JSON | setSuggestedPrompts() helper | Properly formatted, validates prompt structure |
| Feedback collection | Custom button actions | feedback_buttons element | Standardized UX, designed for AI responses |
| Message metadata storage | Custom database/Redis | DefaultThreadContextStore | Uses Slack's native message metadata |

**Key insight:** Slack designed the Assistant class and related utilities specifically for this use case. Custom implementations miss built-in features like automatic context persistence, type-safe handlers, and streaming optimizations.

## Common Pitfalls

### Pitfall 1: Bolt 3.x → 4.x Migration - Middleware Breaking Change
**What goes wrong:** Code breaks because ignoreSelf() and directMention() are called as functions
**Why it happens:** Bolt v4 changed these from function-returning-middleware to direct middleware
**How to avoid:** Remove parentheses when using these middlewares
**Warning signs:** TypeScript errors about middleware types, runtime errors about "middleware is not a function"
**Migration example:**
```typescript
// Bolt v3 (WRONG in v4)
app.message(ignoreSelf(), directMention(), async ({ message }) => {});

// Bolt v4 (CORRECT)
app.message(ignoreSelf, directMention, async ({ message }) => {});
```

### Pitfall 2: web-api v7 TypeScript Type Strictness
**What goes wrong:** TypeScript compilation errors on previously working API calls
**Why it happens:** web-api v7 enforces stricter argument typing for better type safety
**How to avoid:** Review migration guide, fix argument types to match method signatures
**Warning signs:** TypeScript errors like "Type 'X' is not assignable to parameter of type 'Y'"
**Note:** JavaScript users unaffected; only TypeScript projects see breaking changes

### Pitfall 3: message.im Events Missing Thread Context
**What goes wrong:** Assistant loses track of which channel user is viewing
**Why it happens:** assistant_thread_started provides context, but subsequent message.im events don't
**How to avoid:** Use Assistant class with built-in ThreadContextStore (automatic via message metadata)
**Warning signs:** Assistant responses ignore user's current channel context
**Example:**
```typescript
// WRONG - context not preserved
app.event('message', async ({ event }) => {
  // event.context doesn't exist on message.im
});

// CORRECT - use Assistant class
const assistant = new Assistant({
  userMessage: async ({ event, context }) => {
    // context.channel_id available from thread context store
  },
});
```

### Pitfall 4: Ephemeral Messages Don't Work in User-to-User DMs
**What goes wrong:** postEphemeral fails with "user_not_in_channel" error for DMs between other users
**Why it happens:** Bot isn't a member of user-to-user DMs, can't post ephemeral there
**How to avoid:** Use assistant panel for DMs (solves this natively), keep ephemeral for channels
**Warning signs:** Ephemeral delivery errors specifically in DM contexts
**Current workaround (Phase 6):** Falls back to bot DM - bad UX, assistant panel eliminates need

### Pitfall 5: LLM Markdown vs Slack mrkdwn Formatting
**What goes wrong:** Bold/italic/code formatting doesn't render correctly in Slack messages
**Why it happens:** LLMs output standard markdown (**, __, \`\`\`), Slack uses mrkdwn syntax (*, _, \```)
**How to avoid:** Use Block Kit's "markdown" block type or prompt LLM to use Slack mrkdwn
**Warning signs:** Asterisks and underscores visible as literal characters in responses
**Example:**
```typescript
// WRONG - standard markdown won't render
await say({ text: "**bold** text" });

// CORRECT - use markdown block or mrkdwn
await say({
  blocks: [{
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*bold* text',  // Slack mrkdwn syntax
    },
  }],
});
```

### Pitfall 6: Not Updating Status During Long Operations
**What goes wrong:** Users see indefinite "thinking..." status, assume app crashed
**Why it happens:** Forgot to call setStatus() with updates or clear status when done
**How to avoid:** Update status during processing, clear with setStatus('') when complete
**Warning signs:** User complaints about app "hanging" or "not responding"
**Example:**
```typescript
await setStatus("thinking...");
// ... fetch context ...
await setStatus("generating response...");
// ... call LLM ...
await setStatus(""); // Clear status when done
```

### Pitfall 7: Static Suggested Prompts
**What goes wrong:** Users lose trust in assistant intelligence
**Why it happens:** Showing identical prompts every time signals app doesn't understand context
**How to avoid:** Generate prompts based on channel_id, recent messages, user role, conversation history
**Warning signs:** User feedback about "generic" or "repetitive" suggestions
**Best practice:** Use threadContextChanged to update prompts when user switches channels

### Pitfall 8: Assuming Assistant Always Available
**What goes wrong:** Breaking existing ephemeral delivery in channels
**Why it happens:** Assistant panel only works when user opens it; not all users will
**How to avoid:** Implement dual delivery mode - assistant for DMs, ephemeral for channels
**Warning signs:** Channel watchers stop receiving suggestions
**Architecture:** Keep existing ephemeral delivery, add assistant as enhancement

## Code Examples

Verified patterns from official sources:

### App Manifest with Assistant Configuration
```yaml
# Source: https://docs.slack.dev/ai/developing-ai-apps/
features:
  bot_user:
    display_name: Speak for Me
    always_online: true
  # Enable Agents & AI Apps in app settings (not in manifest)

oauth_config:
  scopes:
    bot:
      - assistant:write    # NEW: Required for assistant functionality
      - chat:write
      - im:history
      - channels:history
      - channels:read
      # ... existing scopes ...

settings:
  event_subscriptions:
    bot_events:
      - assistant_thread_started        # NEW: When user opens assistant
      - assistant_thread_context_changed # NEW: When user switches channels
      - message.im                       # NEW: User messages in assistant
      # ... existing events ...
```

### Complete Assistant Setup with Streaming
```typescript
// Source: https://docs.slack.dev/tools/bolt-js/tutorials/ai-assistant/
import { App, Assistant } from '@slack/bolt';
import Anthropic from '@anthropic-ai/sdk';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const assistant = new Assistant({
  threadStarted: async ({ say, setSuggestedPrompts, event }) => {
    // Welcome message
    await say({
      text: "I'll help you craft professional responses to workplace messages.",
      metadata: { event_type: 'assistant_greeting' },
    });

    // Context-aware prompts
    const { channel_id } = event.assistant_thread.context;
    const prompts = [];

    if (channel_id.startsWith('D')) {
      // DM context
      prompts.push(
        { message: "Help me respond professionally", title: "Professional tone" },
        { message: "Make this more empathetic", title: "Empathetic" },
      );
    } else {
      // Channel context - fetch recent messages
      prompts.push(
        { message: "Summarize this conversation", title: "Summarize" },
        { message: "What should I say?", title: "Suggest response" },
      );
    }

    await setSuggestedPrompts({ prompts });
  },

  threadContextChanged: async ({ saveThreadContext }) => {
    // Automatically persists context via message metadata
    await saveThreadContext();
  },

  userMessage: async ({ client, event, context, say, setTitle, setStatus }) => {
    const userText = event.text;
    const { channel_id } = context;

    try {
      // Set thread title based on user request
      await setTitle(userText.slice(0, 50));

      // Show processing status
      await setStatus("thinking...");

      // Fetch conversation context if needed
      let conversationContext = '';
      if (channel_id) {
        const history = await client.conversations.history({
          channel: channel_id,
          limit: 10,
        });
        conversationContext = formatMessagesForPrompt(history.messages);
      }

      // Stream response from Claude
      const streamer = client.chatStream({
        channel: event.channel,
        thread_ts: event.thread_ts,
      });

      const stream = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Context:\n${conversationContext}\n\nUser request: ${userText}`,
          },
        ],
        stream: true,
      });

      // Stream chunks to user
      for await (const event of stream) {
        if (event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta') {
          await streamer.append({
            markdown_text: event.delta.text,
          });
        }
      }

      // Stop stream with feedback buttons
      await streamer.stop({
        blocks: [
          {
            type: 'context_actions',
            elements: [{
              type: 'feedback_buttons',
              action_id: 'ai_feedback',
              positive_button: {
                text: { type: 'plain_text', text: 'Good' },
                value: 'positive',
              },
              negative_button: {
                text: { type: 'plain_text', text: 'Bad' },
                value: 'negative',
              },
            }],
          },
        ],
      });

      // Clear status
      await setStatus('');

    } catch (error) {
      await setStatus('');
      await say({
        text: "Sorry, I encountered an error generating that response.",
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:warning: Sorry, I encountered an error. Please try again.`,
            },
          },
        ],
      });
    }
  },
});

app.assistant(assistant);

// Action handler for feedback buttons
app.action('ai_feedback', async ({ ack, body, client }) => {
  await ack();

  const value = body.actions[0].value;
  const userId = body.user.id;

  // Store feedback for quality tracking
  await storeFeedback({
    userId,
    feedback: value,
    timestamp: Date.now(),
  });

  // Optional: acknowledge feedback to user
  // (update message or send ephemeral confirmation)
});
```

### Bolt v3 → v4 Migration Checklist
```typescript
// Source: https://github.com/slackapi/bolt-js/wiki/Bolt-v3-%E2%80%90--v4-Migration-Guide

// 1. Update package.json
// "dependencies": {
//   "@slack/bolt": "^4.6.0"
// }

// 2. Update Node.js to v18+ (check .nvmrc or Dockerfile)

// 3. Fix middleware calls - remove parentheses
// BEFORE (v3):
app.message(ignoreSelf(), directMention(), handler);
// AFTER (v4):
app.message(ignoreSelf, directMention, handler);

// 4. Update types import - now namespaced
// BEFORE (v3):
import { BotMessageEvent, SlackEvent } from '@slack/bolt';
// AFTER (v4):
import { App, type types } from '@slack/bolt';
// Use as: types.BotMessageEvent, types.SlackEvent

// 5. Update Express custom routes (if using ExpressReceiver)
// Express v5 changes router syntax slightly
// Check: https://expressjs.com/en/guide/migrating-5.html

// 6. Review web-api v7 breaking changes (TypeScript only)
// Check: https://docs.slack.dev/tools/node-slack-sdk/migration/migrating-web-api-package-to-v7/
// Main impact: stricter type checking on API method arguments

// 7. Run TypeScript compiler to catch type errors
// npm run build

// 8. Test all existing handlers, shortcuts, actions
// Verify no regressions in event handling
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual stream (startStream, appendStream, stopStream) | chatStream() utility | Oct 2025 (Bolt v4) | Simpler streaming, built-in buffering |
| Custom context storage | Assistant's ThreadContextStore | Bolt v4 release | Automatic persistence via message metadata |
| Bot DM fallback for DMs | Assistant panel | Late 2024/Early 2025 | Native private UX in side panel |
| Generic interaction patterns | Assistant class | Bolt v4 | Type-safe, built-in helpers (say, setTitle, setStatus) |
| Static prompts | Dynamic setSuggestedPrompts | Late 2024 | Context-aware conversation starters |
| Manual feedback collection | feedback_buttons element | Oct 2025 | Standardized AI feedback UX |

**Deprecated/outdated:**
- **Manual streaming API calls:** chatStream() utility replaces three-method workflow
- **ignoreSelf() / directMention() with parentheses:** Now direct middleware in Bolt v4
- **export * from '@slack/types':** Now namespaced as types.* in Bolt v4
- **Node v14/v16:** EOL, Bolt v4 requires v18+
- **Steps from Apps:** Deprecated in Bolt v4, removal planned for v5

## Open Questions

Things that couldn't be fully resolved:

1. **Assistant panel adoption rate**
   - What we know: Assistant panel only works when user opens it
   - What's unclear: What percentage of users will open assistant vs rely on ephemeral messages
   - Recommendation: Implement dual delivery mode, track metrics to measure adoption

2. **Context-aware prompt generation complexity**
   - What we know: Dynamic prompts improve trust, static prompts reduce trust
   - What's unclear: Optimal prompt refresh frequency, how many context variables to consider
   - Recommendation: Start simple (channel type, DM vs channel), iterate based on user feedback

3. **web-api v7 specific breaking changes**
   - What we know: TypeScript type checking is stricter, JavaScript unaffected
   - What's unclear: Complete list of method signature changes
   - Recommendation: Run TypeScript compiler after upgrade, fix errors as they appear; migration guide web page content wasn't fully accessible

4. **Express v5 router breaking changes**
   - What we know: Bolt v4 bundles Express v5, some router syntax changes
   - What's unclear: Whether customRoutes in this project will break
   - Recommendation: Test custom routes after upgrade, review Express v5 migration guide if issues arise

5. **chat:write:user scope for "Send as Me"**
   - What we know: Requires user-level OAuth with chat:write:user scope
   - What's unclear: Whether assistant panel provides alternative mechanism, or requires separate OAuth flow
   - Recommendation: Investigate during implementation; may need user OAuth flow for "Send as Me" feature

## Sources

### Primary (HIGH confidence)
- [Bolt v3 → v4 Migration Guide](https://github.com/slackapi/bolt-js/wiki/Bolt-v3-%E2%80%90--v4-Migration-Guide) - Complete breaking changes list
- [Using AI in Apps - Bolt.js Concepts](https://docs.slack.dev/tools/bolt-js/concepts/ai-apps/) - Assistant class, ThreadContextStore, event handlers
- [AI Assistant Tutorial](https://docs.slack.dev/tools/bolt-js/tutorials/ai-assistant/) - Step-by-step implementation guide
- [Best Practices for AI-Enabled Apps](https://docs.slack.dev/ai/ai-apps-best-practices/) - Official UX guidelines, security, pitfalls
- [Feedback Buttons Element](https://docs.slack.dev/reference/block-kit/block-elements/feedback-buttons-element/) - Block Kit structure
- [Context Actions Block](https://docs.slack.dev/reference/block-kit/blocks/context-actions-block/) - Container for feedback buttons
- [WebClient chatStream](https://docs.slack.dev/tools/node-slack-sdk/reference/web-api/classes/WebClient/) - Streaming API method signatures

### Secondary (MEDIUM confidence)
- [Chat Streaming Announcement](https://docs.slack.dev/changelog/2025/10/7/chat-streaming/) - Oct 2025 streaming features release
- [Slack Bolt 4.x Releases](https://github.com/slackapi/bolt-js/releases) - Version history, release notes
- [Migrating to V4 Tutorial](https://docs.slack.dev/tools/bolt-js/tutorial/migration-v4/) (redirected page) - Migration steps
- [assistant_thread_started Event Reference](https://docs.slack.dev/reference/events/assistant_thread_started/) - Event payload structure
- [assistant_thread_context_changed Event Reference](https://docs.slack.dev/reference/events/assistant_thread_context_changed/) - Context change events
- [Slack API Marketplace Checklist](https://api.slack.com/reference/slack-apps/slack-marketplace-checklist) - Verification requirements
- [chat:write:user scope](https://api.slack.com/scopes/chat:write:user) - User-level message posting

### Tertiary (LOW confidence)
- Web search results on "dual delivery" strategy - not officially documented, inferred from ephemeral limitations
- Express v5 migration details - limited specific information found for Bolt context
- web-api v7 specific TypeScript changes - documentation pages inaccessible, only summary available

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Bolt v4 release, documented versions, verified via GitHub
- Architecture: HIGH - Official Slack docs provide Assistant class patterns, streaming examples, code samples
- Pitfalls: HIGH - Documented in migration guide (middleware, types), best practices doc (markdown, prompts, status)
- Migration steps: HIGH - Official migration guide on GitHub wiki, comprehensive breaking changes list
- Streaming APIs: MEDIUM - Recent release (Oct 2025), some docs still being populated
- "Send as Me" OAuth: LOW - Requires user-level scope, implementation details unclear for assistant context

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable framework, but streaming APIs are new)
