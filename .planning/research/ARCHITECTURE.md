# Architecture Research

**Domain:** Slack AI Assistant with SaaS Portal
**Researched:** 2026-01-26
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Slack Client │  │  Web Portal  │  │ Mobile (opt) │              │
│  │   (User)     │  │  (Admin/UI)  │  │              │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                      │
├─────────┼─────────────────┼──────────────────┼──────────────────────┤
│         │                 │                  │                      │
│  ┌──────▼─────────────────▼──────────────────▼─────┐                │
│  │         API GATEWAY / LOAD BALANCER              │                │
│  └──────┬─────────────────┬──────────────────┬─────┘                │
│         │                 │                  │                      │
├─────────┼─────────────────┼──────────────────┼──────────────────────┤
│         │                 │                  │                      │
│         │   APPLICATION LAYER (MODULAR MONOLITH)                    │
├─────────┼─────────────────┼──────────────────┼──────────────────────┤
│  ┌──────▼───────┐  ┌──────▼────────┐  ┌──────▼─────────┐            │
│  │   Slack      │  │   Web App     │  │  Background    │            │
│  │   Handler    │  │   Service     │  │  Job Workers   │            │
│  │              │  │               │  │                │            │
│  │ - Events API │  │ - Auth/OAuth  │  │ - AI Queue     │            │
│  │ - Socket     │  │ - Dashboard   │  │ - Reports      │            │
│  │ - Webhooks   │  │ - Settings    │  │ - Training     │            │
│  │ - Modals     │  │ - Billing     │  │                │            │
│  └──────┬───────┘  └──────┬────────┘  └──────┬─────────┘            │
│         │                 │                  │                      │
├─────────┼─────────────────┼──────────────────┼──────────────────────┤
│         │                 │                  │                      │
│         │          BUSINESS LOGIC LAYER                             │
├─────────┼─────────────────┼──────────────────┼──────────────────────┤
│  ┌──────▼─────────────────▼──────────────────▼─────┐                │
│  │              SHARED SERVICES                     │                │
│  │  ┌────────────┐  ┌───────────┐  ┌──────────┐   │                │
│  │  │ AI/LLM     │  │  Context  │  │ Metering │   │                │
│  │  │ Service    │  │  Manager  │  │ Service  │   │                │
│  │  └────────────┘  └───────────┘  └──────────┘   │                │
│  └──────────────────────┬───────────────────────────┘                │
│                         │                                           │
├─────────────────────────┼───────────────────────────────────────────┤
│                         │                                           │
│              DATA / PERSISTENCE LAYER                               │
├─────────────────────────┼───────────────────────────────────────────┤
│  ┌──────────────┐  ┌────▼──────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Primary    │  │   Redis   │  │  Vector DB  │  │   Object    │ │
│  │   Database   │  │   Cache   │  │  (pgvector) │  │   Storage   │ │
│  │ (PostgreSQL) │  │  + Queue  │  │             │  │    (S3)     │ │
│  └──────────────┘  └───────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

EXTERNAL INTEGRATIONS:
  - Slack Platform (WebSocket/HTTP)
  - LLM Provider (OpenAI, Anthropic, etc.)
  - Payment Gateway (Stripe)
  - Analytics (PostHog, etc.)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Slack Handler** | Receives events from Slack (messages, interactions, modals); sends ephemeral messages and modal views | Slack Bolt SDK (Node.js) with HTTP or Socket Mode |
| **Web App Service** | Handles web portal UI, OAuth flows, user settings, workspace configuration | Next.js with React, API routes, SSR/ISR |
| **Background Job Workers** | Processes AI inference asynchronously; generates weekly reports; trains/refines user style models | Node.js workers with BullMQ/Redis queue |
| **AI/LLM Service** | Orchestrates calls to LLM providers; manages context windows; handles token counting | Abstraction layer over OpenAI/Anthropic SDKs |
| **Context Manager** | Stores and retrieves conversation history; manages token limits; implements summarization for long contexts | Custom service with PostgreSQL + Redis caching |
| **Metering Service** | Tracks API usage, AI token consumption, events per workspace for billing | Event-driven counter with PostgreSQL aggregation |
| **Primary Database** | Stores workspaces, users, preferences, message history, AI training data, subscriptions | PostgreSQL with row-level multi-tenancy |
| **Redis Cache + Queue** | Caches frequently accessed data; queues background jobs (AI inference, reports) | Redis with BullMQ for job processing |
| **Vector DB** | Stores embeddings for user communication style, retrieval-augmented generation (RAG) | PostgreSQL with pgvector extension |
| **Object Storage** | Stores large files (exported reports, training datasets, attachments) | AWS S3 or compatible |

## Recommended Project Structure

```
slack-speak-for-me/
├── apps/                          # Monorepo structure (if needed)
│   ├── slack-bot/                 # Slack event handler
│   │   ├── src/
│   │   │   ├── handlers/          # Event, action, modal handlers
│   │   │   ├── middleware/        # Auth, rate limiting
│   │   │   ├── services/          # Business logic
│   │   │   └── index.ts           # Bolt app initialization
│   │   └── package.json
│   ├── web-portal/                # Next.js web app
│   │   ├── src/
│   │   │   ├── app/               # Next.js App Router
│   │   │   │   ├── (auth)/        # Auth routes
│   │   │   │   ├── (dashboard)/   # Protected dashboard routes
│   │   │   │   └── api/           # API routes
│   │   │   ├── components/        # React components
│   │   │   ├── lib/               # Utilities, hooks
│   │   │   └── middleware.ts      # Auth middleware
│   │   └── package.json
│   └── worker/                    # Background job processor
│       ├── src/
│       │   ├── jobs/              # Job definitions
│       │   ├── processors/        # Job handlers
│       │   └── index.ts           # Worker initialization
│       └── package.json
├── packages/                      # Shared libraries (monorepo)
│   ├── shared/                    # Types, utilities
│   ├── database/                  # Prisma/Drizzle schema, migrations
│   ├── ai/                        # AI service abstraction
│   └── config/                    # Shared configuration
├── infra/                         # Infrastructure as Code
│   ├── terraform/                 # AWS/GCP resources
│   └── docker/                    # Container definitions
├── prisma/                        # Database schema (if not in packages)
│   ├── schema.prisma
│   └── migrations/
└── docs/                          # Documentation
```

### Structure Rationale

- **apps/**: Separates concerns - Slack bot (real-time events), web portal (user-facing UI), and workers (async processing). Each can scale independently if needed.
- **packages/**: Shared code to avoid duplication. Database schema, types, AI logic are used by multiple apps.
- **Modular Monolith First**: Start with a single repository but organized into modules. Easier to develop, deploy, and debug. Extract to microservices later only if specific scaling needs arise (e.g., AI processing consumes too many resources).
- **Slack bot isolation**: Keep Slack event handling separate to manage rate limits, retries, and webhook reliability independently.
- **Background workers**: Essential for AI inference. Slack requires responses within 3 seconds; AI calls take longer. Queue jobs and respond immediately.

## Architectural Patterns

### Pattern 1: Event-Driven Architecture with Job Queues

**What:** Slack events trigger immediate acknowledgment, enqueue background jobs for AI processing, then post results back to Slack asynchronously.

**When to use:** Always for AI workloads. Slack's 3-second timeout makes synchronous AI processing impossible.

**Trade-offs:**
- **Pros:** Handles long-running tasks; scales workers independently; retries on failure
- **Cons:** Adds complexity (queue management, job monitoring); eventual consistency (user sees "thinking..." then response)

**Example:**
```typescript
// Slack handler (apps/slack-bot/src/handlers/message.ts)
app.event('message', async ({ event, client }) => {
  // Acknowledge immediately
  await client.chat.postEphemeral({
    channel: event.channel,
    user: event.user,
    text: 'Thinking... :brain:',
  });

  // Enqueue AI job
  await aiQueue.add('generate-response', {
    userId: event.user,
    channelId: event.channel,
    messageText: event.text,
    messageTs: event.ts,
  });
});

// Worker (apps/worker/src/processors/ai.ts)
aiQueue.process('generate-response', async (job) => {
  const { userId, channelId, messageText, messageTs } = job.data;

  // Fetch user context and style
  const userStyle = await contextManager.getUserStyle(userId);

  // Call LLM
  const suggestion = await aiService.generateResponse(messageText, userStyle);

  // Post ephemeral message with suggestion
  await slackClient.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: suggestion,
    blocks: buildResponseBlocks(suggestion),
  });
});
```

### Pattern 2: Multi-Tenant Row-Level Security (Pool Model)

**What:** Single database with `workspace_id` column on all tables. Enforce workspace isolation via application logic and database constraints.

**When to use:** Early stage (0-10K workspaces). Simplest to build and maintain. Most SaaS apps use this pattern successfully.

**Trade-offs:**
- **Pros:** Simple schema; easy backups; cost-efficient; straightforward migrations
- **Cons:** One bad query can leak data across tenants; requires diligent code reviews; harder to offer per-tenant backups

**Example:**
```typescript
// Database schema (packages/database/schema.prisma)
model Message {
  id          String   @id @default(cuid())
  workspaceId String   @map("workspace_id")
  channelId   String   @map("channel_id")
  userId      String   @map("user_id")
  content     String
  createdAt   DateTime @default(now()) @map("created_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  @@index([workspaceId, channelId])
  @@map("messages")
}

// Service layer - ALWAYS filter by workspaceId
export class MessageService {
  async getMessages(workspaceId: string, channelId: string) {
    // Hard requirement: workspace_id must be in every query
    return prisma.message.findMany({
      where: { workspaceId, channelId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
```

### Pattern 3: Context Window Management with Summarization

**What:** Track token usage in conversation history. When approaching LLM context limits, summarize older messages and replace with summary.

**When to use:** For all AI features using conversation history. Essential to avoid degraded accuracy or context overflow errors.

**Trade-offs:**
- **Pros:** Maintains conversation coherence; avoids "lost-in-the-middle" effect; cost-effective (fewer tokens)
- **Cons:** Summarization loses detail; adds latency; requires tracking state

**Example:**
```typescript
// Context Manager (packages/ai/src/context-manager.ts)
export class ContextManager {
  private readonly MAX_TOKENS = 100_000; // Claude's context limit
  private readonly SUMMARIZE_THRESHOLD = 0.85; // 85% capacity

  async buildContext(userId: string, currentMessage: string): Promise<Message[]> {
    const history = await this.getConversationHistory(userId);
    let tokenCount = this.countTokens(currentMessage);
    const messages: Message[] = [{ role: 'user', content: currentMessage }];

    // Work backwards through history
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      tokenCount += this.countTokens(msg.content);

      if (tokenCount > this.MAX_TOKENS * this.SUMMARIZE_THRESHOLD) {
        // Summarize older messages
        const summary = await this.summarizeHistory(history.slice(0, i + 1));
        messages.unshift({ role: 'system', content: `Previous context: ${summary}` });
        break;
      }

      messages.unshift(msg);
    }

    return messages;
  }

  private async summarizeHistory(messages: Message[]): Promise<string> {
    // Use LLM to compress conversation history
    const response = await this.llm.complete({
      model: 'gpt-4o-mini', // Cheaper model for summarization
      messages: [
        {
          role: 'system',
          content: 'Summarize this conversation concisely, preserving key context.',
        },
        ...messages,
      ],
    });
    return response.content;
  }
}
```

### Pattern 4: Webhook Reliability with Retry Logic

**What:** Slack webhooks can fail due to network issues, rate limits, or transient errors. Implement exponential backoff and retry logic.

**When to use:** All Slack API calls, especially for sending messages. HTTP mode requires handling retries yourself (Socket Mode has some built-in).

**Trade-offs:**
- **Pros:** Improves reliability; handles transient failures gracefully
- **Cons:** Requires tracking retry state; can delay message delivery; may hit rate limits faster

**Example:**
```typescript
// Slack client wrapper (apps/slack-bot/src/services/slack-client.ts)
export class ReliableSlackClient {
  private maxRetries = 3;

  async postMessage(options: ChatPostMessageArguments): Promise<void> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < this.maxRetries) {
      try {
        await this.client.chat.postMessage(options);
        return; // Success
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error
        if (error.code === 'rate_limited') {
          const retryAfter = error.retryAfter || Math.pow(2, attempt);
          await this.sleep(retryAfter * 1000);
          attempt++;
          continue;
        }

        // Non-retryable error
        throw error;
      }
    }

    throw new Error(`Failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Pattern 5: Hybrid OAuth + Session Authentication

**What:** Use Slack OAuth to authenticate workspace installations, then issue JWTs for web portal sessions. Combine session tokens (control) with JWTs (performance).

**When to use:** SaaS apps with both Slack integration and web portal. OAuth for initial auth, sessions for ongoing access.

**Trade-offs:**
- **Pros:** Leverages Slack's identity; JWTs enable stateless scaling; sessions allow revocation
- **Cons:** Two auth systems to maintain; token refresh complexity

**Example:**
```typescript
// Slack OAuth callback (apps/web-portal/src/app/api/auth/slack/callback/route.ts)
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  // Exchange code for tokens
  const slackTokens = await slack.oauth.v2.access({
    client_id: process.env.SLACK_CLIENT_ID,
    client_secret: process.env.SLACK_CLIENT_SECRET,
    code,
  });

  // Store workspace and user in database
  const workspace = await db.workspace.upsert({
    where: { slackTeamId: slackTokens.team.id },
    create: {
      slackTeamId: slackTokens.team.id,
      slackAccessToken: encrypt(slackTokens.access_token),
      // ... other fields
    },
    update: {
      slackAccessToken: encrypt(slackTokens.access_token),
    },
  });

  // Issue JWT for web portal session
  const sessionToken = await issueSessionToken({
    workspaceId: workspace.id,
    userId: slackTokens.authed_user.id,
  });

  // Set session cookie
  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set('session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
```

## Data Flow

### User Message Flow (AI Suggestion)

```
[User posts message in Slack]
    ↓
[Slack Events API] → (HTTP POST or WebSocket)
    ↓
[Slack Handler] → app.event('message')
    ↓
[Check: Is channel monitored?] → Database query
    ↓ (yes)
[Post ephemeral "Thinking..."] → Slack API
    ↓
[Enqueue AI job] → Redis queue (BullMQ)
    ↓
[Background Worker picks up job]
    ↓
[Fetch user style + conversation context] → Database + Vector DB
    ↓
[Call LLM with context] → OpenAI/Anthropic API
    ↓
[Generate response suggestion]
    ↓
[Meter token usage] → Metering service (PostgreSQL)
    ↓
[Post ephemeral with suggestion + actions] → Slack API
    ↓
[User sees message with "Send", "Refine", "Dismiss" buttons]
```

### Modal Refinement Flow

```
[User clicks "Refine" button]
    ↓
[Slack sends interaction payload] → Slack Handler
    ↓
[app.action('refine_response')] → Extract trigger_id
    ↓
[Open modal with current suggestion] → views.open()
    ↓
[User edits in modal text field]
    ↓
[User submits modal] → Slack sends view_submission
    ↓
[app.view('refine_modal')] → Extract refined text
    ↓
[Enqueue refinement job] → Redis queue
    ↓
[Worker: Call LLM with refinement instructions]
    ↓
[Update modal with new suggestion] → views.update()
    ↓
[User can refine again or accept]
```

### Weekly Report Flow

```
[Cron triggers weekly job] → Scheduler (Vercel Cron or node-cron)
    ↓
[For each workspace with reports enabled] → Database query
    ↓
[Fetch all messages from monitored channels this week] → Database
    ↓
[Enqueue report generation job per workspace] → Redis queue
    ↓
[Worker: Aggregate and summarize with LLM]
    ↓
[Generate report text + insights]
    ↓
[Store report] → Database + S3 (if large)
    ↓
[Post to configured channel] → Slack API
    ↓
[Update last_report_at timestamp] → Database
```

### Web Portal Configuration Flow

```
[User visits portal] → HTTPS request
    ↓
[Next.js middleware checks session cookie] → JWT verification
    ↓
[Load workspace data] → Database query (filtered by workspace_id)
    ↓
[Render dashboard with SSR/ISR] → Next.js server component
    ↓
[User changes settings] → Client-side form submission
    ↓
[API route handler] → /api/settings
    ↓
[Validate + authenticate request] → Middleware
    ↓
[Update database] → Prisma mutation (with workspace_id filter)
    ↓
[Revalidate cache] → revalidatePath()
    ↓
[Return success] → JSON response
    ↓
[UI updates] → React state management
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-100 workspaces** | Single server (monolith) with Postgres + Redis. Use Render/Railway/Fly.io. Socket Mode for simplicity during development, switch to HTTP for production. No caching needed yet. |
| **100-1K workspaces** | Separate worker processes (scale background jobs independently). Add Redis caching for frequently accessed data (user preferences, workspace settings). Switch to HTTP mode with load balancer. Consider Vercel/Netlify for web portal (auto-scaling). |
| **1K-10K workspaces** | Horizontal scaling: Multiple web servers behind load balancer. Multiple worker instances processing queue jobs. Database connection pooling (PgBouncer). Add CDN for static assets. Monitor rate limits per workspace; implement per-workspace queuing to avoid one workspace consuming all API quota. |
| **10K+ workspaces** | Read replicas for database (split read/write traffic). Consider database sharding by workspace_id if single DB becomes bottleneck. Extract AI service as separate microservice (different resource requirements). Implement distributed tracing (OpenTelemetry) for debugging. Consider regional deployments (US, EU) for latency. |

### Scaling Priorities

1. **First bottleneck: AI job processing**
   - **Symptoms:** Jobs queuing up, users waiting >30s for responses
   - **Fix:** Add more worker processes. Use separate queue priorities (high priority for suggestions, low for reports). Scale workers independently from web servers.

2. **Second bottleneck: Database connections**
   - **Symptoms:** Connection pool exhausted errors, query timeouts
   - **Fix:** Add PgBouncer for connection pooling. Use read replicas for heavy queries (analytics, reports). Optimize slow queries with proper indexes (workspace_id + channel_id, user_id + created_at).

3. **Third bottleneck: Slack API rate limits**
   - **Symptoms:** HTTP 429 errors, delayed message delivery
   - **Fix:** Implement per-workspace rate limiting in queue. Use exponential backoff. Batch messages where possible. Consider Socket Mode for high-throughput workspaces (but manage WebSocket reconnections carefully).

## Anti-Patterns

### Anti-Pattern 1: Synchronous AI Processing in Slack Handler

**What people do:** Call LLM API directly in Slack event handler, wait for response, then post to Slack.

**Why it's wrong:** Slack requires response within 3 seconds. LLM calls take 5-30 seconds. This causes timeouts, missed events, and poor UX.

**Do this instead:** Immediately acknowledge the event, enqueue a background job, post ephemeral "thinking" message. Worker processes the job and posts result when ready.

### Anti-Pattern 2: Storing Slack Tokens in Plain Text

**What people do:** Store `bot_token` and `user_token` directly in database without encryption.

**Why it's wrong:** If database is compromised, attacker has full access to all Slack workspaces. Can post messages, read private channels, exfiltrate data.

**Do this instead:** Encrypt tokens at rest using AES-256. Use environment variable for encryption key (never in code/database). Decrypt only when needed, keep in memory briefly. Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault) for production.

### Anti-Pattern 3: Missing workspace_id Filter in Queries

**What people do:** Query database by user_id or channel_id alone, forgetting workspace_id.

**Why it's wrong:** In multi-tenant systems, IDs can collide across workspaces. User A in Workspace 1 could see User A's data from Workspace 2. Major security vulnerability.

**Do this instead:** ALWAYS include workspace_id in WHERE clause. Use TypeScript types to enforce this at compile time. Add database constraints (composite indexes on [workspace_id, user_id]). Code review checklist item: "Does this query filter by workspace_id?"

### Anti-Pattern 4: Loading Entire Conversation History into LLM

**What people do:** Fetch all messages from a channel and send to LLM for context, without checking token limits.

**Why it's wrong:** Exceeds context window (100K-200K tokens), causes API errors or high costs. Degrades accuracy ("lost-in-the-middle" effect). Slow to process.

**Do this instead:** Implement sliding window with summarization. Track token counts. Load recent messages (last 50-100), summarize older context. Use RAG (Retrieval-Augmented Generation) to fetch only relevant past messages based on semantic similarity.

### Anti-Pattern 5: Socket Mode in Production Without Reconnection Logic

**What people do:** Use Socket Mode for simplicity, deploy to production, assume WebSocket stays connected forever.

**Why it's wrong:** WebSockets disconnect due to network issues, server restarts, Slack's backend recycling. Without reconnection, app stops receiving events. Silent failures are hard to debug.

**Do this instead:** If using Socket Mode in production, implement robust reconnection with exponential backoff. Monitor connection health. Better: Use HTTP mode with webhooks for production (Slack's recommendation). HTTP is stateless and more reliable at scale.

### Anti-Pattern 6: Ignoring Slack Rate Limits

**What people do:** Send messages in tight loops (e.g., posting to 100 channels), ignore HTTP 429 responses.

**Why it's wrong:** Slack returns 429 Too Many Requests and stops delivering messages. App appears broken. In extreme cases, Slack may suspend the app.

**Do this instead:** Respect Retry-After header in 429 responses. Implement exponential backoff. Use Slack's recommended rate (1 message/second for most endpoints, 1/minute for incoming webhooks). Queue messages and throttle sending. Monitor rate limit usage via Slack Analytics API.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Slack Platform** | Bolt SDK + Events API (HTTP or Socket Mode) | HTTP recommended for production. Events delivered as JSON POST. Must respond with 200 within 3s. Use Bolt's built-in handlers for events, actions, views. |
| **LLM Provider** | REST API (OpenAI, Anthropic) | Abstract behind service layer (packages/ai). Track token usage for billing. Implement retry with exponential backoff. Use streaming for long responses. |
| **Payment Gateway** | Stripe Billing + Usage API | Webhook for subscription events (trial ending, payment failed). Report usage via Stripe Usage Records API (sync or batch). Handle prorated charges. |
| **Object Storage** | S3-compatible API | Store large files (reports, training data exports). Use presigned URLs for secure downloads. Consider CloudFront CDN for frequently accessed files. |
| **Monitoring** | OpenTelemetry + PostHog/Sentry | Distributed tracing for debugging. Error tracking with context (workspace_id, user_id). Performance monitoring (API latency, queue depth). |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Slack Handler ↔ Web App** | Shared database (read-only for handler) | Handler reads workspace config (monitored channels, enabled features). Web app writes config. No direct API calls between them. |
| **Web App ↔ Background Workers** | Redis queue (BullMQ) | Web app enqueues jobs (e.g., generate report now). Workers process and update database. Web app polls database for job status. |
| **All Services ↔ AI Service** | Direct function calls (shared package) or REST API | Start with shared package for simplicity. Extract to microservice if AI processing becomes bottleneck (different resource requirements - GPU, memory). |
| **All Services ↔ Database** | Prisma ORM (shared schema in packages/database) | Single source of truth for schema. Migrations run from CI/CD. Each service uses same Prisma client but with own connection pool. |
| **Slack Handler ↔ Slack Platform** | Bolt SDK (HTTP/Socket Mode) | Bolt abstracts WebSocket/HTTP differences. Use middleware for auth, logging. Install webhooks point to /slack/events endpoint. |
| **Web Portal ↔ User Browser** | Next.js SSR/ISR + API Routes | Server-side rendering for initial load (SEO, performance). Client-side React for interactivity. API routes for mutations (/api/*). Middleware for auth on protected routes. |

## Database Schema Highlights

### Core Tables (Multi-Tenant Row-Level Security)

```sql
-- Workspaces (Slack teams)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_team_id VARCHAR(255) UNIQUE NOT NULL,
  slack_team_name VARCHAR(255) NOT NULL,
  slack_bot_token TEXT NOT NULL, -- ENCRYPTED
  slack_bot_user_id VARCHAR(255) NOT NULL,
  installed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  plan VARCHAR(50) NOT NULL DEFAULT 'free', -- free, pro, enterprise
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users (Slack users within workspaces)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slack_user_id VARCHAR(255) NOT NULL,
  slack_email VARCHAR(255),
  display_name VARCHAR(255),
  ai_style_profile JSONB DEFAULT '{}', -- Learned communication style
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, slack_user_id)
);

-- Monitored channels
CREATE TABLE monitored_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slack_channel_id VARCHAR(255) NOT NULL,
  slack_channel_name VARCHAR(255),
  enabled BOOLEAN DEFAULT TRUE,
  auto_suggest BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, slack_channel_id)
);

-- Messages (for context and training)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  slack_channel_id VARCHAR(255) NOT NULL,
  slack_message_ts VARCHAR(255) NOT NULL,
  slack_thread_ts VARCHAR(255), -- NULL if not in thread
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX(workspace_id, slack_channel_id, created_at),
  UNIQUE(workspace_id, slack_message_ts)
);

-- AI suggestions (for feedback loop)
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  original_message_context TEXT,
  suggested_response TEXT NOT NULL,
  user_action VARCHAR(50), -- sent, refined, dismissed
  refined_text TEXT, -- If user refined before sending
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  actioned_at TIMESTAMP,
  INDEX(workspace_id, user_id, created_at)
);

-- Usage metering (for billing)
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- ai_suggestion, ai_refinement, report_generation
  token_count INTEGER, -- LLM tokens used
  cost_cents INTEGER, -- Calculated cost in cents
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX(workspace_id, created_at, event_type)
);
```

### Indexes for Performance

- `(workspace_id, slack_channel_id, created_at)` on messages - for fetching recent channel history
- `(workspace_id, user_id, created_at)` on suggestions - for user's suggestion history
- `(workspace_id, created_at, event_type)` on usage_events - for billing aggregation
- `(slack_team_id)` unique on workspaces - for OAuth lookups

## Sources

### Architectural Patterns
- [Changing the Model: Why and How We Re-Architected Slack - InfoQ](https://www.infoq.com/presentations/slack-rearchitecture/)
- [The Architecture of a Scalable AI SaaS: My 2026 Blueprint - DEV Community](https://dev.to/frankdotdev/the-architecture-of-a-scalable-ai-saas-my-2026-blueprint-56cm)
- [How Slack Supports Billions of Daily Messages](https://blog.bytebytego.com/p/how-slack-supports-billions-of-daily)
- [Real-Time Messaging Architecture at Slack - InfoQ](https://www.infoq.com/news/2023/04/real-time-messaging-slack/)

### Slack Integration
- [Comparing HTTP & Socket Mode | Slack Developer Docs](https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/)
- [Using Socket Mode | Slack Developer Docs](https://docs.slack.dev/apis/events-api/using-socket-mode/)
- [Bolt | Slack](https://api.slack.com/bolt)
- [Modals | Slack Developer Docs](https://docs.slack.dev/surfaces/modals/)
- [Block Kit | Slack Developer Docs](https://docs.slack.dev/block-kit/)

### AI Architecture
- [How to Build a Chatbot: Components & Architecture in 2026](https://research.aimultiple.com/chatbot-architecture/)
- [AI Chatbot Guide for 2026: Architecture, Use Cases, Deployment](https://www.enjo.ai/post/ai-chatbot-guide)
- [Top techniques to Manage Context Lengths in LLMs](https://agenta.ai/blog/top-6-techniques-to-manage-context-length-in-llms)
- [LLM context windows: what they are & how they work](https://redis.io/blog/llm-context-windows/)

### Background Jobs & Queues
- [BullMQ - Background Jobs processing and message queue for NodeJS](https://bullmq.io/)
- [Building a Job Queue System with Node.js, Bull, and Neon Postgres - Neon Guides](https://neon.com/guides/nodejs-queue-system)
- [How to Design a Message Queue Architecture for System Design Interviews](https://www.designgurus.io/answers/detail/how-to-design-a-message-queue-for-system-design-interviews)

### Multi-Tenant Architecture
- [The developer's guide to SaaS multi-tenant architecture — WorkOS](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)
- [Designing Multi-tenant SaaS Architecture on AWS: The Complete Guide for 2026](https://www.clickittech.com/software-development/multi-tenant-architecture/)
- [Designing a Multi-Tenant SaaS Application: Data Isolation Strategies | Medium](https://medium.com/@niteshthakur498/designing-a-multi-tenant-saas-application-data-isolation-strategies-dea298a1309b)

### Database & Data Modeling
- [Data models for Slack Apps | Wilhelm's Blog](https://wilhelmklopp.com/posts/slack-database-modelling/)
- [Slack Architecture - System Design](https://systemdesign.one/slack-architecture/)

### Authentication & Security
- [Installing with OAuth | Slack Developer Docs](https://api.slack.com/authentication/oauth-v2)
- [JWTs vs. sessions: which authentication approach is right for you?](https://stytch.com/blog/jwts-vs-sessions-which-is-right-for-you/)
- [Combining the benefits of session tokens and JWTs](https://clerk.com/blog/combining-the-benefits-of-session-tokens-and-jwts)

### Usage-Based Billing
- [The 2026 Guide to SaaS, AI, and Agentic Pricing Models](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models)
- [Kinde AI Token Pricing Optimization: Dynamic Cost Management for LLM-Powered SaaS](https://kinde.com/learn/billing/billing-for-ai/ai-token-pricing-optimization-dynamic-cost-management-for-llm-powered-saas/)
- [How to Implement Scalable Usage-Based Billing for AI Workloads](https://www.cloudraft.io/blog/usage-based-billing-for-ai-workloads)

### Web Portal Stack
- [Next.js SaaS Dashboard Development: Scalability & Best Practices](https://www.ksolves.com/blog/next-js/best-practices-for-saas-dashboards)
- [Next.js in 2026: The Full Stack React Framework That Dominates the Industry](https://www.nucamp.co/blog/next.js-in-2026-the-full-stack-react-framework-that-dominates-the-industry)

### Microservices vs Monolith
- [Microservices vs Monoliths in 2026: When Each Architecture Wins - Java Code Geeks](https://www.javacodegeeks.com/2025/12/microservices-vs-monoliths-in-2026-when-each-architecture-wins.html)
- [Monolithic vs Microservices: Differences, Pros, & Cons in 2026](https://www.superblocks.com/blog/monolithic-vs-microservices)

### Rate Limits & Reliability
- [Rate limits | Slack Developer Docs](https://docs.slack.dev/apis/web-api/rate-limits/)
- [Rate limit changes for non-Marketplace apps - Slack API](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/)

---
*Architecture research for: Slack AI Assistant with SaaS Portal*
*Researched: 2026-01-26*
