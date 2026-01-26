# Pitfalls Research

**Domain:** Slack AI Communication Assistant
**Researched:** 2026-01-26
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: Prompt Injection Attacks via Slack Messages

**What goes wrong:**
Attackers embed hidden instructions in Slack messages that manipulate the AI to exfiltrate private data or perform unauthorized actions. In demonstrated attacks (EchoLeak), AI assistants autonomously execute malicious commands by processing specially crafted messages without any user interaction.

**Why it happens:**
AI models read all message content including hidden text (white text on white background, zero-width characters) that's invisible to human users. When AI processes these messages to generate responses, hidden prompts override the assistant's normal behavior.

**How to avoid:**
- Implement input sanitization that strips potentially malicious formatting before AI processing
- Use prompt injection detection libraries (Rebuff, LLM Guard) to scan user messages
- Implement output validation to detect anomalous AI behavior (unexpected API calls, data access patterns)
- Add "safety rail" prompts that remind the model not to follow instructions from user messages
- Limit AI's access to sensitive data - use role-based data filtering before context is provided to AI
- Never allow AI direct access to message history without content filtering

**Warning signs:**
- AI generates responses containing unexpected URLs or external references
- AI attempts to access channels/users outside expected scope
- Unusual patterns in AI token usage or API calls
- User reports of "strange" AI suggestions that seem off-topic

**Phase to address:**
Phase 1 (Core Architecture) - Security architecture must be foundational. Design prompt isolation and input sanitization into the initial AI integration. Cannot be retrofitted effectively.

---

### Pitfall 2: Over-Scoped OAuth Permissions Blocking Admin Approval

**What goes wrong:**
Slack admins reject the app installation because it requests excessive permissions. Apps requesting broad scopes like `channels:history` (all channel messages), `users:read` (all user data), or admin scopes face scrutiny. Studies show 82% of breaches stem from excessive permissions, making admins extremely cautious.

**Why it happens:**
Developers request convenient "wide access" scopes during prototyping and never narrow them. It's easier to request `channels:history` than to carefully scope to specific channels. The Slack Marketplace review specifically rejects apps with unnecessary user token scopes or admin scopes.

**How to avoid:**
- Apply principle of least privilege from day one - document why each scope is needed
- Use bot tokens over user tokens whenever possible (Marketplace strongly discourages user tokens)
- Implement scope request workflow: list required actions → map to minimum scopes → document justification
- For message history access, use event subscriptions (`message.channels`) rather than polling `conversations.history`
- Never request admin scopes unless absolutely critical (Marketplace unlikely to approve)
- Provide clear in-app explanation of why each permission is needed

**Warning signs:**
- Your app requests more than 8-10 scopes
- You have any admin.* scopes
- You're using user tokens when bot tokens would work
- Installation abandonment rate >30% (users see permissions and back out)
- Admin approval process taking >2 weeks with permission questions

**Phase to address:**
Phase 1 (Core Architecture) - Scope decisions are foundational. Changing scopes post-launch requires re-approval from all installed workspaces, causing massive user friction. Design minimal scope architecture from start.

---

### Pitfall 3: Rate Limit Catastrophe for Non-Marketplace Apps (March 2026)

**What goes wrong:**
Starting March 3, 2026, non-Marketplace apps face draconian rate limits: `conversations.history` and `conversations.replies` throttled to 1 request/minute returning max 15 messages. Apps that learn from message history or analyze conversation context become essentially non-functional.

**Why it happens:**
Slack implemented these limits to prevent bulk data exfiltration by unvetted apps. Apps not going through Marketplace approval are treated as potential security risks. Many developers build "custom distribution" apps unaware of the compliance deadline.

**How to avoid:**
- **Critical decision:** Commit to Slack Marketplace distribution from project start
- Budget 10 weeks for functional review + 10 business days for preliminary review
- If Marketplace isn't viable, architect around severe message access limits:
  - Use event subscriptions (`message.channels`) to collect messages in real-time as they're posted
  - Store messages in your own database (with proper retention policies)
  - Never rely on polling `conversations.history` for analysis
- For learning user communication style, use incremental event-based collection, not historical scanning

**Warning signs:**
- Architecture depends on scanning historical messages
- Plan to launch without Marketplace approval
- No timeline for Marketplace submission (10+ weeks needed)
- Building "training" features that batch-process message history

**Phase to address:**
Phase 0 (Planning) - This is a strategic fork: Marketplace vs. non-Marketplace paths have completely different technical architectures. Event-based architecture must be chosen before any API integration code is written.

---

### Pitfall 4: AI Response Latency Destroying User Trust

**What goes wrong:**
AI takes 8-12 seconds to generate response suggestions, causing users to give up or write their own message. Users expect chatbot responses within 5 seconds maximum, with satisfaction declining rapidly beyond 2 seconds for conversational contexts. Slow AI creates the perception of a "broken" feature.

**Why it happens:**
Complex workflows combine multiple slow operations: (1) Retrieve user's communication history from database (2) Retrieve channel context (3) Build large prompt with examples (4) LLM inference (5) Post-processing/refinement. Each step adds 1-3 seconds. Large context windows (20k+ tokens) increase latency significantly.

**How to avoid:**
- **Architecture for speed:**
  - Pre-compute user style profiles asynchronously (don't compute on-demand)
  - Use streaming responses via SSE to show progressive generation
  - Cache frequently accessed data (user's recent messages, channel context)
  - Implement "quick suggestion" (3 second) vs. "refined suggestion" (10 second) modes
- **Technical optimizations:**
  - Use smaller, faster models (GPT-4o-mini, Claude 3.5 Haiku) for initial suggestions
  - Limit context window to 8k tokens max for real-time responses
  - Parallel processing: retrieve context while previous message is being sent
  - Use latency-optimized inference endpoints (AWS Bedrock latency mode, Anthropic's prompt caching)
- **UX mitigations:**
  - Show "AI is thinking..." with progress indicator immediately
  - Display interim "quick suggestion" while better response generates in background
  - Set user expectations: "Generating personalized response (5-10s)"

**Warning signs:**
- Time-to-first-response >3 seconds in development
- LLM calls with >10k token context
- Sequential processing (wait for A, then B, then C)
- No caching layer for user profiles or context
- Testing only with small workspaces (100 messages) rather than realistic scale (10k+ messages)

**Phase to address:**
Phase 2 (MVP Features) - Performance architecture must be designed before AI integration. However, real performance tuning happens during MVP testing with realistic data volumes. Budget 2-3 sprint iterations for latency optimization.

---

### Pitfall 5: Socket Mode Scaling Crisis at Growth Stage

**What goes wrong:**
App built with Socket Mode (WebSocket connections) hits hard limits when growing beyond 10 concurrent workspaces. Slack limits apps to 10 concurrent WebSocket connections per app. WebSocket connections randomly disconnect when Slack recycles backend containers. Stateful architecture makes horizontal scaling nearly impossible.

**Why it happens:**
Socket Mode is convenient for local development (no public endpoint needed, works behind firewalls). Developers prototype with Socket Mode and never migrate to HTTP webhooks. The scaling problems only appear after successful launch when hitting 10+ workspace installations.

**How to avoid:**
- **Use Socket Mode only for local development**
- **Mandate HTTP webhooks for production from day one**
- Architecture checklist:
  - Public HTTPS endpoint for Slack events
  - Event verification using signing secret
  - Request signature validation on all webhook payloads
  - Idempotent event processing (handle duplicate deliveries)
  - Background job queue for async event processing
- If HTTP endpoint isn't viable (on-premise deployments), architect for Socket Mode limits:
  - Implement connection pooling/rotation across workspaces
  - Add reconnection logic with exponential backoff
  - Monitor connection health and failover to backup connections
  - Accept that you can only serve 10 concurrent workspaces max

**Warning signs:**
- Production deployment plan includes Socket Mode
- No public endpoint infrastructure in architecture
- Development using Socket Mode with no migration plan
- "We'll add HTTP support later" (this is a major refactor)

**Phase to address:**
Phase 1 (Core Architecture) - Socket Mode vs. HTTP is a foundational decision affecting infrastructure, deployment, and scaling. Changing post-launch requires complete rewrite of event handling infrastructure.

---

### Pitfall 6: "Uncanny Valley" - AI Sounds Too Good

**What goes wrong:**
AI-generated messages are too polished, too formal, or too perfect, making colleagues suspicious. Studies show employees detect AI-generated content and interpret its use as laziness or insincerity. Only 40-52% view supervisors as sincere when using heavy AI assistance vs. 83% for low-assistance messages.

**Why it happens:**
Training data for LLMs skews toward formal, published text. Default AI tone is "professional blog post" not "quick Slack message." Developers optimize for grammatical perfection rather than authentic voice matching. Users don't customize AI style, use default suggestions unchanged.

**How to avoid:**
- **Style learning architecture:**
  - Train on user's actual Slack messages (casual tone, abbreviations, emoji usage)
  - Detect user's formality level: "Hey!" vs. "Hello," - "thanks!" vs. "Thank you"
  - Learn user's signature phrases, humor style, punctuation patterns
  - Measure message length distribution (user writes 1-2 sentences, not paragraphs)
- **UX design for authenticity:**
  - Default to "rough draft" mode - intentionally slightly less polished
  - Always show AI suggestion as editable draft, never auto-send
  - Include refinement options: "More casual," "More formal," "Shorter," "Add humor"
  - Prominent "Regenerate" button encouraging iteration
  - Show "AI-assisted" indicator for transparency (optional setting)
- **Context-aware generation:**
  - Adjust tone based on channel (eng-team vs. exec-updates)
  - Adjust formality based on recipient (peer vs. manager)
  - For emotional messages (sympathy, congratulations), default to human-written prompts only

**Warning signs:**
- User feedback: "This doesn't sound like me"
- Low adoption despite technical functionality working
- Users heavily editing suggestions (>50% word changes)
- Messages get "Thanks but I prefer to write these myself" responses
- Suggestion accept rate <20%

**Phase to address:**
Phase 3 (Style Learning) - Core style learning must happen early, but continuous refinement spans all phases. Include style authenticity metrics in initial MVP testing. Plan 2-3 major iterations on tone/style algorithms.

---

### Pitfall 7: Training Data Privacy Violation (GDPR/CCPA Nuclear Risk)

**What goes wrong:**
App collects Slack messages to train AI models on user communication style, violating GDPR/CCPA requirements. Regulators consider this "AI training on personal data" requiring explicit consent and legitimate interest assessment. Potential fines up to 4% of global revenue or €20M. Worker councils can block deployment entirely.

**Why it happens:**
Developers treat internal Slack messages as "company data" available for ML training. Privacy policies don't explicitly disclose AI training. "Improving AI" is bundled into general "product improvement" consent. Apps scrape message history without granular consent for training vs. feature functionality.

**How to avoid:**
- **Legal compliance architecture:**
  - **No training on customer data** - Critical: Do NOT train your base AI model on customer messages
  - Training vs. feature usage distinction:
    - Feature usage (generate suggestions for this user) = legitimate interest, no extra consent
    - Model training (improve AI for all users with this user's data) = requires explicit consent
  - Explicit, separate consent for AI training on user's messages
  - Allow users to opt-out of training while keeping feature access
  - Data minimization: only collect messages necessary for current session context, not bulk history
  - Retention limits: messages used for suggestions deleted after session (ephemeral processing)
- **Technical safeguards:**
  - Use RAG (Retrieval-Augmented Generation) not fine-tuning for personalization
  - User style profiles stored as embeddings/parameters, not raw message text
  - Implement "forget me" - complete user data deletion on request
  - No message data sent to third-party LLM APIs for training
  - Verify LLM provider contracts: "No training on customer data" clause required
- **Transparency requirements:**
  - Privacy policy explicitly states: "AI training on messages" with opt-in
  - In-app disclosure when AI learns from user's messages
  - Data access request support: users can download all stored messages
  - Public documentation of data retention periods

**Warning signs:**
- Privacy policy says "product improvement" without specifying AI training
- No separate consent flow for AI training
- Architecture includes model fine-tuning on user messages
- Message retention periods undefined or "indefinite"
- Legal/compliance team hasn't reviewed AI data usage
- Using OpenAI/Anthropic APIs with default settings (some have opt-out training)

**Phase to address:**
Phase 0 (Planning) - Legal/privacy architecture must be designed before any message collection code. Cannot be retrofitted - requires complete data handling redesign. Consult privacy lawyer before Phase 1 begins.

---

### Pitfall 8: Ephemeral Message UX Confusion

**What goes wrong:**
Users don't understand ephemeral messages (only visible to them) vs. regular messages. AI suggestions posted as ephemeral messages confuse users who expect persistence. Users reload Slack and suggestions disappear. Users switch from desktop to mobile and lose context. Users try to edit/copy ephemeral message content after it's gone.

**Why it happens:**
Ephemeral messages are perfect for private AI suggestions, but users aren't familiar with the concept. No visual distinction from regular messages beyond small "Only visible to you" text. Ephemeral messages don't appear in API responses, don't persist across sessions, and can't be retrieved. Developers expect "obvious" behavior but users miss subtle indicators.

**How to avoid:**
- **Clear visual design:**
  - Distinctive styling: border, background color, icon indicating "private suggestion"
  - Large, prominent text: "PRIVATE AI SUGGESTION - Only you can see this"
  - Different visual treatment than regular Slack ephemeral system messages
- **UX education:**
  - First-time user onboarding: "AI suggestions appear privately - only you see them"
  - In-app tooltips explaining ephemeral nature
  - Warning before switching devices: "Suggestions won't appear on mobile until you request again"
- **Persistence architecture:**
  - Store suggestions in your database with message timestamp for retrieval
  - Provide "View recent suggestions" command to recall disappeared suggestions
  - Include suggestion content in modal when user clicks "Refine" button
  - Consider hybrid model: ephemeral for quick suggestions, modal for complex interactions
- **Modal-first approach (alternative):**
  - Use slash command → modal workflow instead of ephemeral messages
  - Modal content persists during session, doesn't disappear on reload
  - Modal provides dedicated space for refinement controls
  - Ephemeral messages only for "suggestion ready" notifications

**Warning signs:**
- User testing shows confusion about where suggestions went
- Support requests: "I saw a suggestion but now I can't find it"
- Users screenshot ephemeral messages to save them
- Low click-through rate on ephemeral message buttons (<10%)
- High abandonment after device switch

**Phase to address:**
Phase 2 (MVP Features) - UX pattern decision affects entire interaction model. Test ephemeral vs. modal approaches early in MVP. Plan usability testing specifically for this pattern.

---

### Pitfall 9: Hallucination in Workplace Context (Reputational Damage)

**What goes wrong:**
AI suggests a response referencing a project that doesn't exist, misquoting someone, or fabricating meeting outcomes. User accepts suggestion without careful review. Colleague responds with confusion: "What project are you talking about?" User's professional credibility damaged. AI hallucinations undermine trust in the entire product.

**Why it happens:**
LLMs confidently generate plausible-sounding but false information. Context windows lose track of conversation details (attention fades on earlier messages). RAG retrieval returns irrelevant context that AI incorporates incorrectly. AI pattern-matches similar project names or people. Users trust AI suggestions without verification, especially when under time pressure.

**How to avoid:**
- **Grounding techniques:**
  - Use RAG with strict relevance filtering (cosine similarity >0.8 threshold)
  - Retrieve only from verified sources: actual Slack messages, not web content
  - Include source citations in suggestions: "Based on message from @user in #channel"
  - Limit generation to extractive responses (paraphrase actual content) not creative responses
  - Add "uncertainty markers" when AI lacks sufficient context: "I don't have enough information to suggest a response to this question"
- **Factual verification:**
  - Implement entity extraction and verification: check if mentioned people/projects exist
  - Cross-reference with workspace directory (user names, channel names, project tags)
  - Detect temporal inconsistencies: "last week's meeting" when no meeting occurred
  - Flag suggestions containing specific claims for user review: "Verify: This suggests $50k budget"
- **UX safeguards:**
  - Color-code confidence levels: green = high confidence, yellow = verify facts, red = uncertain
  - Show "fact-check required" warnings for suggestions with numbers, names, dates
  - Default to open-ended responses vs. specific factual claims: "I'd be happy to help with that" vs. "The budget is $50k"
  - Refinement option: "Make less specific" to remove potentially wrong details
- **Prompt engineering:**
  - System prompt: "If you don't know, say 'I don't have enough context' - never guess"
  - Few-shot examples showing uncertain responses
  - Penalize overconfident tone in generation parameters

**Warning signs:**
- User reports of incorrect information in suggestions
- Suggestions reference non-existent entities (projects, people, meetings)
- High edit rate specifically on proper nouns and numbers
- Users asking "Did we really discuss this?" after AI-suggested messages
- Suggestion confidence scores consistently >0.9 (unrealistically high)

**Phase to address:**
Phase 2 (MVP Features) - Hallucination mitigation must be built into initial AI integration. Requires prompt engineering, RAG architecture, and UX design for uncertainty. Plan dedicated testing sprint for factual accuracy.

---

### Pitfall 10: Token Cost Explosion Destroying Unit Economics

**What goes wrong:**
AI token costs spiral out of control making the product unprofitable. Each response generation costs $0.10-0.50 in LLM API fees. Users generate 20-50 suggestions per day. Cost per user: $2-25/day = $60-750/month, far exceeding subscription revenue. "Usage-based" pricing scares away customers. Company forced to severely limit AI features or shut down.

**Why it happens:**
Developers use large context windows (20k-50k tokens) with expensive models (GPT-4, Claude Opus) for every request. No caching strategy for repeated context (user history sent fresh each time). Unnecessary AI calls for simple cases. No token cost tracking in development. Pricing model created before understanding real token consumption patterns.

**How to avoid:**
- **Cost-efficient architecture:**
  - Use smaller, cheaper models for common cases:
    - Quick suggestions: GPT-4o-mini ($0.15/1M tokens) or Claude 3.5 Haiku ($0.25/1M tokens)
    - Complex refinements: GPT-4o or Claude 3.5 Sonnet
  - Implement prompt caching (Anthropic's prompt caching reduces costs 90% for repeated context)
  - Lazy loading: don't include user history unless user clicks "More personalized"
  - Context compression: summarize long conversations rather than including full text
  - Template-based responses for common cases (no AI call needed): "Thanks!", "Got it", "Let me check"
  - Batch processing: aggregate weekly report generation rather than real-time per-request
- **Token budget system:**
  - Per-user token limits tied to subscription tier:
    - Free tier: 50k tokens/month (~50 suggestions)
    - Pro tier: 500k tokens/month (~500 suggestions)
    - Enterprise: unlimited with usage alerting
  - Real-time token tracking per user, display in UI: "You've used 35% of your monthly AI credits"
  - Soft limits with upgrade prompts, not hard cutoffs
- **Pricing model:**
  - Hybrid pricing reduces sticker shock: $10/user/month + $0.01 per AI suggestion over included amount
  - Transparent token usage: show cost per suggestion type in settings
  - Cost optimization tips in product: "Use 'Quick suggestion' to save AI credits"
- **Monitoring:**
  - Track token costs per feature, per user cohort, per time of day
  - Alert when user exceeds expected consumption (potential bug/abuse)
  - A/B test prompt efficiency: does shorter context maintain quality with lower cost?

**Warning signs:**
- Token cost per user >50% of subscription revenue
- Average context window >15k tokens
- No prompt caching implementation
- Using GPT-4/Opus for all requests regardless of complexity
- No per-user cost tracking dashboard
- Token costs not included in financial projections

**Phase to address:**
Phase 2 (MVP Features) - Cost architecture must be designed before MVP launch. However, real consumption patterns only emerge from production usage. Plan Phase 3 optimization sprint after 30 days of real user data. Include cost monitoring from day one.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using Socket Mode in production | Avoid public endpoint setup, 2-3 days faster launch | Cannot scale beyond 10 workspaces, major refactor needed for growth | Never for Marketplace apps. Only acceptable for internal-only deployments with <5 workspaces |
| Requesting broad OAuth scopes ("we might need it later") | Faster development, fewer iterations | Admin approval rejections, Marketplace rejection, security audit failures | Never. Scopes are extremely difficult to narrow post-launch |
| Storing raw message text for AI training | Simpler data pipeline, easier debugging | GDPR violations, privacy lawsuits, requires complete data handling redesign | Never. Use embeddings/summaries from day one |
| Using GPT-4/Claude Opus for all AI calls | Best quality responses, 1 model integration | Unsustainable unit economics, forced to limit features later | Acceptable for Phase 1 prototype/testing. Must optimize by Phase 3 |
| Skipping suggestion confidence scores | Simpler UI, faster implementation | Users trust hallucinated content, reputational damage, no basis for quality improvements | Never. Confidence scores are critical for UX safety |
| Single-tenant architecture (separate instance per workspace) | Easier data isolation, simpler security model | Operational nightmare at scale, infrastructure costs 10x higher | Acceptable for enterprise-only sales model with <50 customers |
| Synchronous AI generation (block until response ready) | Simpler code flow, easier error handling | Poor UX (8+ second waits), users abandon feature | Acceptable for Phase 1 MVP testing only. Must implement async/streaming by Phase 2 |
| No message retention policy | Unlimited AI training data, better personalization | GDPR violations, storage costs scale infinitely, no compliance certification | Never. Define retention policy before storing first message |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Slack OAuth | Storing client secret in frontend code or public repos | Store in environment variables, never commit to code. Rotate immediately if exposed |
| Slack OAuth | Using "add to Slack" button without state parameter | Include cryptographic state parameter, verify on callback to prevent CSRF attacks |
| Slack Events API | Processing events synchronously in webhook handler | Respond with 200 OK within 3 seconds, queue event for async processing |
| Slack Events API | No event deduplication logic | Track event IDs, skip processing if duplicate (Slack sends redundantly for reliability) |
| Slack Rate Limits | No Retry-After header handling | Parse Retry-After from 429 responses, implement exponential backoff with max 5 retries |
| OpenAI/Anthropic API | Assuming zero data retention by default | Verify contract has "no training on customer data" clause. Check API settings for opt-out requirements |
| OpenAI API | No timeout configuration | Set 30-second timeout for streaming, 60-second for batch. Implement fallback response for timeouts |
| Database (message storage) | Storing messages in same DB as application data | Separate database for message data with strict access controls and encryption at rest |
| Database (message storage) | No data encryption before storage | Encrypt sensitive message content before writing to DB (application-level encryption) |
| Stripe/billing | Allowing unlimited AI usage before payment processed | Implement soft token limits for trial users, enforce hard limits until payment method verified |
| Stripe webhooks | Trusting webhook payloads without signature verification | Verify Stripe signatures on all webhook payloads before processing |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full message history for every suggestion | 2-3 second response time growing to 15-30 seconds | Implement pagination, load only last 50 messages, use indexed database queries | >1,000 messages per user or >100 concurrent users |
| No database connection pooling | Random 500 errors under load, "too many connections" errors | Configure connection pool (min: 5, max: 20 connections), implement connection retry logic | >50 concurrent users |
| Synchronous LLM API calls in webhook handlers | Slack webhooks timeout (3 second limit), events dropped | Use background job queue (Celery, Bull), respond 200 immediately, process async | Any production load |
| No prompt/context caching | Token costs scale linearly with users, LLM provider rate limits | Implement Anthropic prompt caching or similar, cache user style profiles for 5 minutes | >100 active users/day |
| Storing all messages in single database table | Query performance degrades, suggestion latency increases | Partition by workspace_id and date, archive messages >90 days to cold storage | >100k messages stored |
| No CDN for web portal assets | Slow page loads from distant regions, bandwidth costs spike | Use Cloudflare/CloudFront for static assets, enable gzip compression | >1,000 users or international users |
| Polling for suggestion status (frontend checks every 500ms) | Database overload, websocket connection exhaustion | Use Server-Sent Events or WebSocket for push updates, not polling | >20 concurrent suggestion generations |
| No background job retry logic | Random failures under load appear as missing suggestions | Implement exponential backoff retries (max 3), dead letter queue for permanent failures | Any production usage |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not validating Slack request signatures | Attacker can forge webhook payloads, trigger unauthorized actions, access user data | Verify X-Slack-Signature header on all webhook requests using signing secret |
| Exposing user messages in error logs | Sensitive conversations leaked to logging service, compliance violations | Sanitize logs: redact message content, only log message IDs and metadata |
| Using user OAuth tokens instead of bot tokens | Broader access than necessary, user's personal permissions instead of app's | Use bot tokens for all app actions. User tokens only for user-specific scopes like DMs |
| No token rotation strategy | Compromised token remains valid indefinitely | Implement automated token refresh, detect token reuse, expire old tokens |
| Storing Slack tokens in local storage (web portal) | XSS attacks can steal tokens, session hijacking | Store tokens in HttpOnly cookies or server-side sessions, never in localStorage |
| AI prompt injection via user-controlled context | Attacker controls parts of AI prompt, exfiltrates data or manipulates behavior | Treat all user input as untrusted, use structured prompts with clear boundaries, validate outputs |
| No rate limiting on AI suggestion endpoint | Abuse/DOS via unlimited AI calls, token cost explosion | Implement per-user rate limits (e.g., 10 suggestions per minute), track token usage |
| Mixing message data across workspaces | Data leak between companies, catastrophic compliance violation | Strict workspace isolation: database rows tagged with workspace_id, verify in all queries |
| No workspace admin override controls | Compliance requirements for admin visibility into AI usage | Provide workspace admin dashboard showing AI usage, allow admins to disable for specific users |
| Client-side AI processing (attempting to save costs) | API keys exposed in frontend code, prompt injection at scale | All AI calls must happen server-side with server-controlled prompts |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Auto-sending AI suggestions without user review | Users blamed for AI mistakes, loss of control, high anxiety | Always show as editable draft, require explicit user action to send |
| No indication that AI generated content | Colleagues detect AI, perceive user as insincere or lazy | Provide optional "AI-assisted" badge/disclaimer, let users choose transparency level |
| Making "Refine" modal too complex | Users overwhelmed by options, abandon refinement, use mediocre suggestions | Start with 3-5 simple options (more casual/formal, shorter/longer), progressive disclosure for advanced |
| No quick escape from long AI generation | Users stuck waiting, can't cancel, frustrated | Show "Cancel generation" button immediately, allow user to return to manual writing |
| Suggestion notifications interrupting focus | Users disable notifications, miss valuable suggestions | Use unobtrusive ephemeral messages, batch suggestions for low-priority channels |
| No onboarding for AI style customization | AI uses generic tone, users think "this is just ChatGPT" | First-run wizard: "Let's learn your style" with 3-5 sample messages to analyze |
| Identical suggestions for similar messages | AI feels robotic and repetitive | Add variation: generate 2-3 different approaches, detect similar contexts and diversify |
| No context for why AI suggested specific content | Users don't trust opaque suggestions | Show reasoning: "Based on your previous response to @user about similar topic" |
| Forcing AI for every message | Power users frustrated, want manual control | Make AI opt-in via slash command or button, not automatic for every message |
| Burying the "give feedback on AI" option | No signal for improving AI quality | Prominent thumbs up/down on every suggestion, quick "why?" follow-up options |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **OAuth flow:** Often missing state parameter CSRF protection, token refresh logic, revocation handling, graceful handling of denied permissions
- [ ] **Event subscriptions:** Often missing deduplication logic (same event delivered multiple times), event verification, graceful degradation when Slack retries
- [ ] **AI suggestions:** Often missing confidence scoring, source attribution, graceful handling of API timeouts/errors, fallback responses when AI fails
- [ ] **Message history access:** Often missing pagination, rate limit handling, workspace isolation verification, data retention enforcement
- [ ] **User style learning:** Often missing cold start problem handling (new users with no history), incremental updates as user writes more, style drift detection
- [ ] **Billing integration:** Often missing webhook signature verification, failed payment retry logic, graceful degradation to free tier
- [ ] **Web portal authentication:** Often missing Slack SSO integration, token refresh, logout from all devices, session expiration
- [ ] **Admin controls:** Often missing workspace-level override settings, usage analytics, bulk user management, CSV export of usage
- [ ] **Privacy compliance:** Often missing data export (GDPR), data deletion (right to be forgotten), consent tracking, privacy policy version acceptance
- [ ] **Error handling:** Often missing user-friendly error messages (not raw API errors), retry logic, fallback content when services down

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| OAuth over-scoping discovered post-launch | MEDIUM | 1. Design minimal scope architecture 2. Deploy new version with narrower scopes 3. Email all workspace admins requesting re-authorization 4. Provide migration tool that preserves user data. Expect 30-40% re-authorization rate |
| Prompt injection vulnerability exploited | HIGH | 1. Immediate: disable AI features 2. Audit all AI-generated content from last 30 days 3. Implement input sanitization and output validation 4. Re-deploy with security fixes 5. Notify affected workspaces 6. External security audit before re-enabling |
| Socket Mode scaling crisis | HIGH | 1. Emergency: provision HTTP webhook infrastructure 2. Implement event handling rewrite (2-3 weeks engineering) 3. Deploy parallel HTTP version 4. Migrate workspaces in batches 5. Deprecate Socket Mode version. Cannot be done without service disruption |
| GDPR violation (training on user data) | CRITICAL | 1. Immediately stop all training processes 2. Delete all collected message data 3. Legal consultation 4. Self-report to supervisory authority 5. Re-architect with compliant data handling 6. External privacy audit. Potential fines, app removal from Marketplace |
| Rate limit hit (non-Marketplace app) | MEDIUM | 1. If <90 days to March 3, 2026: emergency Marketplace submission 2. If Marketplace not viable: re-architect for event subscriptions 3. Migrate all workspaces to new version 4. If neither viable: pivot to enterprise self-hosted model |
| AI token cost explosion | LOW | 1. Immediate: implement hard token limits per user 2. Switch to cheaper models (GPT-4o-mini/Haiku) 3. Add prompt caching 4. Communicate new usage limits to users 5. Offer upgrade path to higher tier. May cause user churn |
| Hallucination causing workplace incident | MEDIUM | 1. Immediate: add "verify facts" warning to all suggestions 2. Implement source citation 3. Lower confidence threshold for showing suggestions 4. Add explicit confidence indicators 5. Public acknowledgment and quality improvement plan |
| Ephemeral message UX confusion | LOW | 1. Add more prominent "only visible to you" styling 2. Implement suggestion history retrieval 3. Add onboarding tips 4. Consider pivot to modal-first UX if confusion persists. Can be fixed with UI updates |
| Latency destroying adoption | MEDIUM | 1. Emergency: implement quick suggestion mode with simpler prompts 2. Add streaming responses 3. Profile slow queries and optimize 4. Switch to faster models for real-time path 5. Add caching layer. Requires 2-3 week engineering effort |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Prompt injection attacks | Phase 1 (Core Architecture) | Security audit with red team testing, input sanitization code review, pen test report |
| Over-scoped OAuth permissions | Phase 1 (Core Architecture) | Scope justification document, Marketplace preliminary review approval |
| Rate limit crisis (March 2026) | Phase 0 (Planning) | Marketplace submission timeline confirmed, or event-based architecture verified |
| AI response latency | Phase 2 (MVP Features) | 95th percentile latency <5s measured in production, load testing with 100 concurrent users |
| Socket Mode scaling crisis | Phase 1 (Core Architecture) | HTTP webhook infrastructure deployed, no Socket Mode in production code |
| Uncanny Valley AI tone | Phase 3 (Style Learning) | User study: >70% say suggestions "sound like me," suggestion accept rate >30% |
| Training data privacy violation | Phase 0 (Planning) | Privacy lawyer review, GDPR compliance checklist completed, consent flows implemented |
| Ephemeral message UX confusion | Phase 2 (MVP Features) | User testing: <10% confusion rate, task completion rate >80% for refinement flow |
| AI hallucination damage | Phase 2 (MVP Features) | Factual accuracy testing: <5% hallucination rate on test set, confidence calibration metrics |
| Token cost explosion | Phase 3 (Optimization) | Cost per user <20% of subscription price, token usage dashboard live, caching hit rate >60% |

---

## Sources

### Slack Platform Documentation
- [Rate limits | Slack Developer Docs](https://docs.slack.dev/apis/web-api/rate-limits/)
- [Rate limit changes for non-Marketplace apps](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/)
- [Best practices for security | Slack Developer Docs](https://docs.slack.dev/authentication/best-practices-for-security/)
- [Comparing HTTP & Socket Mode | Slack Developer Docs](https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/)
- [Slack Marketplace app guidelines and requirements](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/)
- [Six UX Challenges Building Slack Apps And How We Fixed Them](https://www.cloverpop.com/blog/six-ux-challenges-when-building-slack-apps-and-how-we-fixed-them)

### Slack Security & Permissions
- [Security best practices | Slack Developer Docs](https://docs.slack.dev/security/)
- [Security recommendations for approving apps | Slack](https://slack.com/help/articles/360001670528-Security-recommendations-for-approving-apps)
- [Slack Security Concerns: What Technical Teams Need to Know](https://www.reco.ai/hub/slack-security-concerns)
- [Avoiding Common Pitfalls in Slack Development - Data Privacy Mistakes](https://moldstud.com/articles/p-avoiding-common-pitfalls-in-slack-development-data-privacy-mistakes-to-watch-for)

### AI Security & Prompt Injection
- [LLM Security Risks in 2026: Prompt Injection, RAG, and Shadow AI](https://sombrainc.com/blog/llm-security-risks-2026)
- [Prompt Injection Attacks in LLMs: Complete Guide for 2026](https://www.getastra.com/blog/ai-security/prompt-injection-attacks/)
- [LLM01:2025 Prompt Injection - OWASP Gen AI Security Project](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Indirect Prompt Injection: The "XSS" of the AI Agent Era](https://medium.com/@instatunnel/indirect-prompt-injection-the-xss-of-the-ai-agent-era-fac00bd25e4e)
- [OpenAI says prompt injection may never be 'solved'](https://cyberscoop.com/openai-chatgpt-atlas-prompt-injection-browser-agent-security-update-head-of-preparedness/)

### AI Trust & Workplace Communication
- [Why AI emails can quietly destroy trust at work | ScienceDaily](https://www.sciencedaily.com/releases/2025/08/250811104226.htm)
- [Managers risk loss of trust by over-relying on AI-written messages | HR Dive](https://www.hrdive.com/news/managers-risk-loss-of-trust-by-over-relying-on-ai-written-messages/758098/)
- [AI-Assisted Emails May Put Trustworthiness at Risk - USC Marshall](https://www.marshall.usc.edu/news/ai-assisted-emails-may-put-trustworthiness-at-risk-in-workplace-communications)

### AI Hallucinations
- [AI Hallucination: Compare top LLMs like GPT-5.2 in 2026](https://research.aimultiple.com/ai-hallucination/)
- [Will a Large Context Window Fix AI Hallucinations?](https://medium.com/@wetrocloud/will-a-large-context-window-fix-ai-hallucinations-3e9e73caf60a)
- [AI Hallucinations Are Quietly Undermining Customer Experience](https://www.cmswire.com/customer-experience/preventing-ai-hallucinations-in-customer-service-what-cx-leaders-must-know/)

### AI Privacy & GDPR
- [Complete GDPR Compliance Guide (2026-Ready)](https://secureprivacy.ai/blog/gdpr-compliance-2026)
- [GDPR and AI in 2026: Rules, Risks & Tools That Comply](https://www.sembly.ai/blog/gdpr-and-ai-rules-risks-tools-that-comply/)
- [CNIL Clarifies GDPR Basis for AI Training](https://www.skadden.com/insights/publications/2025/06/cnil-clarifies-gdpr-basis-for-ai-training)
- [AI and the GDPR: Understanding the Foundations of Compliance](https://techgdpr.com/blog/ai-and-the-gdpr-understanding-the-foundations-of-compliance/)

### AI Performance & Latency
- [LLM Latency Benchmark by Use Cases in 2026](https://research.aimultiple.com/llm-latency-benchmark/)
- [Optimizing AI responsiveness: Amazon Bedrock latency-optimized inference](https://aws.amazon.com/blogs/machine-learning/optimizing-ai-responsiveness-a-practical-guide-to-amazon-bedrock-latency-optimized-inference/)
- [Building Responsive AI: A Practical Guide to Optimizing Agent Latency](https://medium.com/@yuxiaojian/building-responsive-ai-a-practical-guide-to-optimizing-agent-latency-7364e12937af)

---

*Pitfalls research for: Slack AI Communication Assistant*
*Researched: 2026-01-26*
*Confidence: HIGH - Based on official Slack documentation, recent AI security research, workplace trust studies, and GDPR compliance guidance for 2026*
