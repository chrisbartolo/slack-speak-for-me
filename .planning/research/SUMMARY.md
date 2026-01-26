# Project Research Summary

**Project:** Slack Speak for Me
**Domain:** Slack AI Communication Assistant with SaaS Web Portal
**Researched:** 2026-01-26
**Confidence:** HIGH

## Executive Summary

Slack Speak for Me is an AI-powered communication coaching tool that helps professionals craft better workplace messages. Based on comprehensive research of the Slack AI ecosystem, SaaS architecture patterns, and workplace AI security in 2026, the recommended approach centers on a **TypeScript-first, modern JavaScript stack** with **Next.js for the web portal**, **Slack Bolt for Slack integration**, and **Anthropic Claude for AI generation**. The architecture should be a **modular monolith** with event-driven background job processing to handle AI latency requirements.

The product differentiates from Slackbot AI (general-purpose assistant) and communication coaches like Poised (meeting-focused) by offering **context-aware message drafting** that learns the user's personal communication style. Critical success factors include: (1) Slack Marketplace approval from day one to avoid March 2026 rate limit restrictions, (2) privacy-first architecture that avoids GDPR violations around AI training data, (3) sub-3-second response times through async job processing and prompt caching, and (4) authentic AI tone matching that avoids "uncanny valley" overly-polished suggestions.

Key risks center on security (prompt injection attacks), compliance (OAuth over-scoping blocking admin approval, GDPR violations from message training), and economics (AI token costs destroying unit profitability). These risks are mitigatable through foundational architectural decisions: input sanitization from Phase 1, minimal OAuth scopes from the start, RAG-based personalization instead of model fine-tuning, and hybrid model tiering (cheap models for quick suggestions, expensive models only when needed).

## Key Findings

### Recommended Stack

The 2026 standard for Slack AI SaaS applications emphasizes **TypeScript-first development**, **managed services for complexity**, and **serverless-friendly architectures**. The research identified a clear technology consensus across official documentation, authoritative sources, and recent 2025-2026 blog posts.

**Core technologies:**
- **TypeScript 5.5+ with Node.js 20/22 LTS**: Industry standard for 2026, provides compile-time safety essential for maintainable AI systems. All downstream tools (Bolt, Drizzle, Vercel AI SDK) are TypeScript-native.
- **Next.js 16.x with App Router**: Dominant choice for SaaS web portals in 2026. Provides React Server Components, built-in API routes, Edge Runtime support, and zero-config full-stack capabilities. Pairs naturally with Vercel deployment.
- **Slack Bolt 4.x**: Official Slack framework, only realistic choice for production apps. Handles OAuth, token rotation, rate limiting, and event routing out-of-the-box. TypeScript-first since recent versions.
- **PostgreSQL 16+ with Drizzle ORM**: Proven relational database with JSONB support for flexibility. ACID compliance required for billing/subscriptions. Drizzle chosen over Prisma for faster serverless cold starts and lighter runtime footprint.
- **Redis 7.x with BullMQ**: Required for job queues (AI processing), caching (user profiles), and session management. Provides 100x+ speed improvements over database queries.
- **Vercel AI SDK 6.x**: Unified interface for OpenAI, Anthropic, and other LLMs. Handles streaming, tool calling, and reasoning blocks. 20M+ monthly downloads, TypeScript-first design.
- **Anthropic Claude API (Opus 4.5, Sonnet 4)**: Primary LLM for response generation. Excels at coding and workplace communication with large 200K+ token context windows ideal for Slack history analysis.
- **Stripe Billing**: Industry standard for subscription + usage-based billing. Supports hybrid pricing (seat-based + usage metering), automatic invoicing, customer portal, and real-time usage tracking.

**Critical version note:** Next.js 16 requires React 19, which introduces breaking changes. Ensure all React component libraries are React 19-compatible.

**Deployment stack:** Vercel for web portal (zero-config Next.js), Railway/Render for Slack bot backend (Node.js with WebSocket/HTTP support), Neon or Supabase for serverless PostgreSQL.

### Expected Features

Research identified clear feature tiers based on user expectations, competitive analysis (Slackbot AI, Poised), and Slack Marketplace requirements.

**Must have (table stakes):**
- **Private AI suggestions via ephemeral messages**: Privacy-first UX is standard for workplace AI tools. Users expect suggestions visible only to them.
- **Context-aware response generation**: AI must understand conversation history and channel context to be useful. Without this, suggestions are generic and worthless.
- **Secure data handling**: TLS 1.2+, OAuth, signed secrets required. Slack Marketplace requirement. Must verify requests, encrypt traffic, handle tokens securely.
- **Fast response time**: Sub-3-second AI suggestions or users abandon the tool. Requires optimized prompts, streaming responses, and caching strategies.
- **Mobile support**: Professionals work from phones. AI explanations and suggestions must work on mobile Slack clients.
- **Error handling with guidance**: When AI fails, provide actionable messages, not generic errors. Slack Marketplace requirement.

**Should have (competitive differentiators):**
- **Style learning from message history**: AI learns user's communication patterns from past Slack messages to match their voice. Core differentiator vs generic AI assistants.
- **Iterative refinement interface**: Modal-based back-and-forth with AI to refine suggestions before posting. Gives users control and personalization.
- **Explicit style guidance**: Users provide direct instructions ("be more assertive", "sound diplomatic") that persist across sessions. Faster to implement than history learning.
- **Feedback loop for improvement**: Users rate suggestions (thumbs up/down), AI adapts over time based on preferences. Standard 2026 UX pattern.
- **Tone controls**: User selects tone (formal, friendly, assertive, diplomatic) before generating response. Simple prompt engineering, high perceived value.
- **Multi-response options**: Generate 3 alternative responses with different approaches. Gives users choice without refinement cycle.

**Defer (v2+):**
- **Message difficulty detection**: Proactively identifies "hard to answer" messages and offers help before user asks. Technically challenging (sentiment analysis, conflict detection), requires high user trust.
- **Weekly team report automation**: Aggregates channel activity and generates summarized reports automatically. Different use case than personal assistance—validate personal features first.
- **Team style guides**: Company-wide communication templates and preferences. Enterprise feature, not needed for initial adoption.
- **Multi-language support**: Suggestions in languages beyond English. Localization is expensive—defer until international demand is clear.

**Anti-features (do NOT build):**
- **Automatic posting without review**: Creates trust issues, liability risks. Slack prohibits destructive automation. Always require human approval.
- **Access to all channels by default**: Violates privacy expectations, creates compliance risk. Opt-in per channel/conversation only.
- **Training LLM on workspace data**: Explicitly prohibited by Slack Marketplace guidelines. Violates user trust and data ownership principles.
- **Real-time monitoring of all messages**: Performance nightmare, privacy violation. User-triggered assistance or opted-in channels only.

### Architecture Approach

The standard 2026 architecture for Slack AI assistants is a **modular monolith** with clear component boundaries, designed to scale horizontally when needed but avoiding premature microservices complexity. The architecture is **event-driven** to handle Slack's 3-second timeout requirements and AI inference latency (8-15 seconds).

**Major components:**
1. **Slack Handler** — Receives events from Slack (messages, interactions, modals), sends ephemeral messages and modal views. Implemented with Slack Bolt SDK using HTTP webhooks (not Socket Mode in production). Immediately acknowledges events and enqueues background jobs.
2. **Background Job Workers** — Processes AI inference asynchronously using BullMQ with Redis queue. Retrieves context, calls LLM, meters usage, posts results back to Slack. Scales independently from web servers.
3. **AI/LLM Service** — Orchestrates calls to LLM providers (Anthropic, OpenAI). Manages context windows, token counting, prompt construction, and streaming responses. Abstraction layer with Vercel AI SDK.
4. **Context Manager** — Stores and retrieves conversation history; manages token limits; implements summarization for long contexts. Uses sliding window with RAG for relevant message retrieval.
5. **Web Portal Service** — Next.js web app for authentication, dashboard, settings, style guidance management, billing integration, and analytics. Handles OAuth flows and user configuration.
6. **Metering Service** — Tracks API usage, AI token consumption, events per workspace for billing. Event-driven counter with PostgreSQL aggregation.
7. **Primary Database (PostgreSQL)** — Stores workspaces, users, preferences, message history (limited retention), AI training data, subscriptions. Multi-tenant with row-level security (workspace_id on all tables).
8. **Redis Cache + Queue** — Caches frequently accessed data (user profiles, workspace settings), queues background jobs. Provides 100x+ speed improvements.
9. **Vector DB (pgvector)** — Stores embeddings for user communication style, enables RAG for style matching. Uses PostgreSQL pgvector extension for simplicity.

**Key architectural patterns:**
- **Event-driven with job queues**: Slack events → immediate acknowledgment → enqueue job → async processing → post result. Essential for AI latency.
- **Multi-tenant row-level security**: Single database with workspace_id column on all tables. Enforce isolation via application logic and indexes.
- **Context window management**: Track token usage, summarize older messages when approaching limits, use RAG for relevant history retrieval.
- **Webhook reliability**: Exponential backoff, retry logic, idempotent event processing to handle Slack's redundant deliveries.
- **Hybrid OAuth + session auth**: Slack OAuth for workspace installation, JWTs for web portal sessions.

**Critical infrastructure decision:** Use **HTTP webhooks** for production Slack integration, NOT Socket Mode. Socket Mode has 10 concurrent workspace limit and stateful architecture that doesn't scale. HTTP is Slack's recommendation for Marketplace apps.

### Critical Pitfalls

Research identified 10 critical pitfalls, ranked by impact and phase to address. Top 5 require foundational architectural decisions:

1. **Prompt injection attacks via Slack messages** — Attackers embed hidden instructions in Slack messages that manipulate AI to exfiltrate data. In demonstrated attacks (EchoLeak), AI autonomously executes malicious commands. **Prevention:** Input sanitization, prompt injection detection (Rebuff, LLM Guard), output validation, safety rail prompts, role-based data filtering. **Phase to address:** Phase 1 (Core Architecture) — cannot be retrofitted.

2. **Over-scoped OAuth permissions blocking admin approval** — Slack admins reject apps requesting excessive permissions like `channels:history` (all messages), `users:read` (all users), or admin scopes. 82% of breaches stem from excessive permissions. **Prevention:** Principle of least privilege from day one, use bot tokens over user tokens, event subscriptions (`message.channels`) instead of polling `conversations.history`, document justification for each scope. **Phase to address:** Phase 1 — changing scopes post-launch requires re-approval from all workspaces.

3. **Rate limit catastrophe for non-Marketplace apps (March 2026)** — Starting March 3, 2026, non-Marketplace apps face throttling: `conversations.history` limited to 1 request/minute returning max 15 messages. Apps that learn from message history become non-functional. **Prevention:** Commit to Marketplace distribution from start (budget 10 weeks for review), or architect around event subscriptions to collect messages in real-time. **Phase to address:** Phase 0 (Planning) — strategic fork in architecture.

4. **AI response latency destroying user trust** — AI taking 8-12 seconds causes users to give up. Users expect responses within 5 seconds max, with satisfaction declining beyond 2 seconds. **Prevention:** Pre-compute user style profiles asynchronously, use streaming responses, cache frequently accessed data, use smaller/faster models (GPT-4o-mini, Claude 3.5 Haiku) for quick suggestions, implement "quick suggestion" vs "refined suggestion" modes. **Phase to address:** Phase 2 (MVP Features) — performance architecture must be designed before AI integration.

5. **Socket Mode scaling crisis at growth stage** — Socket Mode (WebSocket) hits hard 10 concurrent workspace limit. WebSocket connections randomly disconnect. Stateful architecture makes horizontal scaling impossible. **Prevention:** Use Socket Mode only for local development, mandate HTTP webhooks for production from day one. **Phase to address:** Phase 1 — foundational infrastructure decision.

**Additional critical pitfalls:**
- **"Uncanny Valley" AI tone** (Phase 3): AI sounds too polished, colleagues suspicious. Users detect AI-generated content and interpret as laziness. Requires style learning, "rough draft" mode, prominent "Regenerate" button.
- **Training data privacy violation (GDPR/CCPA)** (Phase 0): Collecting Slack messages for AI training violates GDPR without explicit consent. Potential fines up to 4% of revenue. Use RAG not fine-tuning, explicit consent for training, ephemeral processing, "forget me" deletion.
- **Ephemeral message UX confusion** (Phase 2): Users don't understand ephemeral messages disappear. Requires distinctive styling, onboarding education, suggestion history retrieval, or modal-first approach.
- **AI hallucination in workplace context** (Phase 2): AI fabricates project names, misquotes people, creates reputational damage. Requires RAG with strict relevance filtering, source citations, uncertainty markers, fact-check warnings, entity verification.
- **Token cost explosion destroying unit economics** (Phase 3): Each response costs $0.10-0.50, users generate 20-50 suggestions/day, cost per user exceeds subscription revenue. Requires smaller models for common cases, prompt caching, lazy loading context, per-user token limits tied to tier.

## Implications for Roadmap

Based on research, suggested phase structure prioritizes foundational security and compliance decisions, followed by MVP feature validation, then advanced personalization and optimization.

### Phase 1: Foundation & Core Architecture

**Rationale:** Security, compliance, and infrastructure decisions are foundational and cannot be retrofitted. This phase establishes the bedrock that all subsequent phases depend on.

**Delivers:**
- HTTP webhook infrastructure (not Socket Mode) for production scalability
- Multi-tenant PostgreSQL database with row-level security (workspace_id isolation)
- Slack OAuth with minimal scopes (no history access yet)
- Event-driven job queue with BullMQ/Redis for async processing
- Input sanitization and prompt injection prevention
- Token encryption at rest
- Basic AI integration (Vercel AI SDK + Anthropic Claude)

**Addresses features:**
- Secure data handling (table stakes requirement)
- Fast response time architecture (async job processing)

**Avoids pitfalls:**
- Prompt injection attacks (input sanitization from start)
- Over-scoped OAuth permissions (minimal scopes, documented justification)
- Socket Mode scaling crisis (HTTP webhooks only)
- Rate limit catastrophe (Marketplace submission planned)

**Research flag:** Standard patterns, no additional research needed. Slack Bolt documentation is comprehensive.

---

### Phase 2: MVP Features & User Validation

**Rationale:** Validate core value proposition before building advanced personalization. Test whether users want AI communication coaching, whether ephemeral message UX works, whether tone controls provide sufficient value without history learning.

**Delivers:**
- Private AI suggestions via ephemeral messages
- Context-aware response generation (thread + recent channel messages)
- Explicit style guidance (user-provided instructions that persist)
- Tone controls (formal/friendly/assertive/diplomatic presets)
- Multi-response options (3 alternatives per request)
- One-click posting workflow
- Basic web portal (Next.js) for settings and style guidance
- Feedback loop (thumbs up/down on suggestions)

**Addresses features:**
- Private AI suggestions (table stakes)
- Context-aware responses (table stakes)
- Explicit style guidance (differentiator, faster than history learning)
- Tone controls (differentiator)
- Multi-response options (differentiator)

**Avoids pitfalls:**
- AI response latency (streaming responses, quick suggestion mode, cached profiles)
- Ephemeral message UX confusion (distinctive styling, onboarding, suggestion history retrieval)
- AI hallucination (RAG with source citations, uncertainty markers, fact-check warnings)

**Research flag:** Needs deeper research on RAG implementation patterns for Slack message retrieval, prompt engineering for tone consistency, ephemeral vs modal UX testing.

---

### Phase 3: Style Learning & Personalization

**Rationale:** After validating MVP, add advanced differentiator: learning from user's actual Slack messages. This requires restricted OAuth scopes (`channels:history`) triggering Slack security review, so only pursue after product-market fit confirmed.

**Delivers:**
- Message history access with restricted OAuth scopes
- Style learning from user's past messages (tone, formality, phrase patterns, emoji usage)
- Iterative refinement modal (back-and-forth with AI before posting)
- Enhanced feedback loop (user ratings adapt style model)
- Mobile-optimized UX (adapted refinement flows for mobile constraints)

**Addresses features:**
- Style learning from history (core differentiator)
- Iterative refinement interface (differentiator)
- Mobile support (table stakes)

**Avoids pitfalls:**
- "Uncanny Valley" AI tone (learns from real messages, "rough draft" mode, regeneration)
- Training data privacy violation (RAG not fine-tuning, explicit consent, ephemeral processing, GDPR compliance)

**Research flag:** Needs deeper research on Slack history access patterns, RAG embedding strategies for style matching, privacy-compliant data handling.

---

### Phase 4: Billing & Usage Optimization

**Rationale:** With validated product and growing usage, implement monetization and optimize costs to achieve sustainable unit economics.

**Delivers:**
- Stripe Billing integration (subscription + usage-based pricing)
- Token usage metering and per-user limits
- Prompt caching (Anthropic's caching reduces costs 90%)
- Model tiering (cheap models for quick suggestions, expensive for refinements)
- Context compression and lazy loading
- Usage dashboard (token consumption, cost transparency)
- Subscription tier enforcement (free, pro, enterprise)

**Addresses features:**
- Basic web portal expanded (billing integration)

**Avoids pitfalls:**
- Token cost explosion (smaller models, caching, lazy loading, per-user limits)

**Research flag:** Standard Stripe integration patterns, well-documented. Prompt caching requires Anthropic-specific research.

---

### Phase 5: Team Features & Scale

**Rationale:** After individual features proven, expand to team-level use cases. Enterprise customers request centralized management.

**Delivers:**
- Weekly team report automation (scheduled workflows, summarization, distribution)
- Workspace admin dashboard (usage analytics, user management, override controls)
- Team style guides (company-wide communication templates)
- Enhanced monitoring and reliability (OpenTelemetry tracing, error tracking)
- Database scaling (connection pooling, read replicas if needed)

**Addresses features:**
- Weekly team report automation (differentiator)

**Avoids pitfalls:**
- Performance degradation at scale (database optimization, caching, horizontal scaling)

**Research flag:** Needs research on scheduled workflow patterns in Next.js/Vercel, team analytics UI patterns.

---

### Phase Ordering Rationale

**Dependency-driven ordering:**
- Phase 1 must come first: security, compliance, infrastructure are foundational
- Phase 2 validates core features before expensive Phase 3 (history access triggers security review)
- Phase 4 requires production usage data to optimize costs effectively
- Phase 5 requires validated individual features before team expansion

**Architecture-driven grouping:**
- Phase 1 groups all infrastructure decisions (HTTP vs Socket, database, auth, job queue)
- Phase 2 groups all MVP features that share AI generation pipeline
- Phase 3 groups all personalization features that require history access
- Phase 4 groups all cost optimization features that share metering infrastructure
- Phase 5 groups all team-level features that require admin controls

**Pitfall avoidance:**
- Critical Phase 0/1 pitfalls addressed before writing feature code (security, OAuth scoping, infrastructure)
- Phase 2 pitfalls (latency, hallucination, UX confusion) mitigated during MVP implementation
- Phase 3 pitfall (privacy violation) requires legal review before implementation
- Phase 4 pitfall (cost explosion) requires production data to optimize

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 2 (MVP Features):** RAG implementation patterns for Slack messages, prompt engineering for consistent tone, ephemeral vs modal UX patterns (need usability testing)
- **Phase 3 (Style Learning):** Privacy-compliant message access patterns, embedding strategies for style matching, incremental style model updates
- **Phase 5 (Team Features):** Scheduled workflow patterns in Next.js/Vercel, team analytics dashboard UX

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Slack Bolt, Next.js, PostgreSQL, BullMQ are well-documented with abundant tutorials and official guides
- **Phase 4 (Billing):** Stripe integration is extensively documented with official Stripe Billing guides and Next.js examples

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified with official documentation (Slack Bolt, Next.js, Vercel AI SDK, Stripe). Industry consensus on TypeScript + Next.js + PostgreSQL for 2026 SaaS apps. Version compatibility confirmed. |
| Features | MEDIUM-HIGH | Strong consensus on table stakes (ephemeral messages, context-aware, secure handling) from Slack Marketplace requirements and competitive analysis. Differentiators validated by research on Slackbot AI positioning and communication coach tools like Poised. Anti-features confirmed by Marketplace guidelines. Minor uncertainty on feature prioritization (tone controls vs refinement interface). |
| Architecture | HIGH | Standard patterns verified across multiple authoritative sources (Slack architecture blog posts, SaaS architecture guides, multi-tenant patterns). Event-driven architecture with job queues is consensus for AI latency. HTTP webhooks vs Socket Mode clearly documented by Slack. Database schema patterns validated by Slack app data modeling articles. |
| Pitfalls | HIGH | Critical pitfalls verified with official sources (Slack rate limit changes, Marketplace guidelines, GDPR compliance). Prompt injection attacks confirmed by recent 2025-2026 AI security research (OWASP LLM01). Workplace AI trust issues validated by peer-reviewed studies. Token cost economics confirmed by pricing model research. Some uncertainty on specific hallucination mitigation techniques (requires experimentation). |

**Overall confidence:** HIGH (85-90%)

### Gaps to Address

**Gaps identified during research:**

1. **Ephemeral vs Modal UX for suggestions** — Research found both patterns used in Slack apps, but limited data on user preference for AI suggestions specifically. **How to handle:** Plan Phase 2 usability testing comparing ephemeral messages vs modal-first workflow. A/B test if possible.

2. **Optimal token budget per subscription tier** — Research identified cost ranges ($0.10-0.50 per suggestion) but actual consumption depends on context window size and user behavior patterns. **How to handle:** Phase 4 requires 30 days of production usage data before finalizing pricing model. Start with generous limits, tighten based on data.

3. **RAG retrieval strategies for style matching** — Research confirmed RAG is preferred over fine-tuning for personalization, but specific embedding strategies (sentence-level vs message-level, similarity thresholds) require experimentation. **How to handle:** Phase 3 planning should include technical spike on RAG implementation with pgvector. Test with sample Slack message corpus.

4. **Mobile-specific UX constraints** — Research noted modals work differently on mobile Slack, but limited specifics on interaction limitations. **How to handle:** Phase 3 planning includes mobile testing environment setup and UX adaptation research.

5. **Slack Marketplace review timeline variability** — Research cited 10 weeks for functional review, but anecdotal reports suggest 4-16 week range depending on complexity. **How to handle:** Submit Marketplace preliminary review immediately after Phase 1, parallel with Phase 2 development. Budget buffer time.

6. **Hallucination mitigation effectiveness** — Research provided techniques (RAG filtering, source citations, uncertainty markers) but no quantitative data on hallucination rate reduction. **How to handle:** Phase 2 planning includes hallucination testing protocol with benchmark dataset. Aim for <5% hallucination rate on test set.

## Sources

### Primary (HIGH confidence)

**Official Documentation:**
- [Slack Bolt Framework Documentation](https://docs.slack.dev/tools) — Slack Bolt patterns, OAuth, event handling
- [Slack Marketplace Guidelines](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/) — OAuth scoping requirements, prohibited features
- [Slack Rate Limit Changes](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/) — March 2026 rate limit restrictions
- [Next.js Official Documentation](https://nextjs.org/) — Next.js 16 features, App Router patterns
- [Vercel AI SDK Documentation](https://ai-sdk.dev/docs/introduction) — LLM abstraction, streaming, tool calling
- [Stripe Billing Documentation](https://docs.stripe.com/billing) — Subscription + usage-based billing
- [BullMQ Documentation](https://docs.bullmq.io) — Job queue patterns, Redis integration
- [Drizzle ORM Documentation](https://orm.drizzle.team) — Database schema, migrations

**Context7 Research:**
- Research conducted across Slack development, AI SaaS architecture, LLM security, workplace communication AI, GDPR compliance
- Multiple sources cross-verified for each finding

### Secondary (MEDIUM confidence)

**Architectural Patterns:**
- [Changing the Model: Why and How We Re-Architected Slack](https://www.infoq.com/presentations/slack-rearchitecture/) — Slack's internal architecture evolution
- [The Architecture of a Scalable AI SaaS: My 2026 Blueprint](https://dev.to/frankdotdev/the-architecture-of-a-scalable-ai-saas-my-2026-blueprint-56cm) — Modern AI SaaS patterns
- [The developer's guide to SaaS multi-tenant architecture](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) — Multi-tenancy patterns

**AI Security:**
- [LLM Security Risks in 2026: Prompt Injection, RAG, and Shadow AI](https://sombrainc.com/blog/llm-security-risks-2026) — Prompt injection attack vectors
- [LLM01:2025 Prompt Injection - OWASP](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — Industry classification of risks
- [OpenAI says prompt injection may never be 'solved'](https://cyberscoop.com/openai-chatgpt-atlas-prompt-injection-browser-agent-security-update-head-of-preparedness/) — Persistent threat acknowledgment

**Workplace AI Trust:**
- [Why AI emails can quietly destroy trust at work](https://www.sciencedaily.com/releases/2025/08/250811104226.htm) — Peer-reviewed study on AI communication trust
- [Managers risk loss of trust by over-relying on AI-written messages](https://www.hrdive.com/news/managers-risk-loss-of-trust-by-over-relying-on-ai-written-messages/758098/) — Workplace sincerity research (40-52% vs 83% sincerity ratings)

**Competitive Analysis:**
- [Slackbot is an AI agent now](https://techcrunch.com/2026/01/13/slackbot-is-an-ai-agent-now/) — Slackbot AI positioning (general-purpose vs coaching)
- [Poised: AI-Powered Communication Coach](https://www.poised.com/) — Meeting-focused competitor analysis

**Privacy & Compliance:**
- [Complete GDPR Compliance Guide (2026-Ready)](https://secureprivacy.ai/blog/gdpr-compliance-2026) — AI training data regulations
- [GDPR and AI in 2026: Rules, Risks & Tools That Comply](https://www.sembly.ai/blog/gdpr-and-ai-rules-risks-tools-that-comply/) — Consent requirements for AI

### Tertiary (LOW confidence, requires validation)

- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — Performance claims (5x faster builds) need production validation
- [shadcn/ui Ecosystem 2025](https://ui.shadcn.com/) — Component library coverage, assumes compatibility with React 19
- Token cost estimates ($0.10-0.50 per suggestion) — Derived from API pricing + estimated context windows, requires production validation

---

*Research completed: 2026-01-26*
*Ready for roadmap: yes*
