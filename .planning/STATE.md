# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-26)

**Core value:** When a challenging message arrives, the user gets an intelligent suggested response that sounds like them, considers full context, and helps them respond professionally without emotional reactivity.
**Current focus:** Phase 04 - Web Portal (IN PROGRESS)

## Current Position

Phase: 04 of 5 (Web Portal)
Plan: 07 of 10 in current phase
Status: In progress
Last activity: 2026-01-27 - Completed 04-07-PLAN.md (People Context Management)

Progress: [██████████████░] ~92% (Phase 04 plan 07 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 30
- Average duration: 3.2 min
- Total execution time: 1.68 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 - Foundation | 5 | 13 min | 2.6 min |
| 02 - Core Slack | 8 | 25 min | 3.1 min |
| 02.1 - Testing | 7 | 30 min | 4.3 min |
| 03 - AI Personalization | 7 | 22 min | 3.1 min |
| 04 - Web Portal | 4 | 21 min | 5.3 min |

**Recent Trend:**
- Last 5 plans: 04-01 (5 min), 04-02 (2 min), 04-03 (2 min), 04-04 (8 min), 04-07 (6 min)
- Trend: Phase 4 UI pages averaging 5+ min due to component complexity

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 0 (Planning): Copy/paste for sending - Slack prohibits apps posting as users
- Phase 0 (Planning): Message action for DMs - Can't passively monitor 1:1 DMs without visibility
- Phase 0 (Planning): Hybrid pricing model - AI token costs must be customer-borne
- Phase 0 (Planning): Three-source personality learning - History + explicit + feedback covers cold start and evolution
- Phase 1 Plan 01: NPM workspaces - Simpler tooling than pnpm/yarn for monorepo
- Phase 1 Plan 01: Snake_case for DB columns - Explicit naming matches PostgreSQL convention and RLS syntax
- Phase 1 Plan 02: AES-256-GCM for OAuth tokens - Authenticated encryption prevents tampering attacks
- Phase 1 Plan 02: Zod for environment validation - Type-safe parsing with clear error messages
- Phase 1 Plan 02: Minimal OAuth scopes - Least-privilege principle (5 scopes only)
- Phase 1 Plan 03: Rate limiting at 10 jobs/second - Prevents overwhelming AI API while maintaining responsiveness
- Phase 1 Plan 03: Exponential backoff (2s, 4s, 8s) - Gives transient failures time to recover without retry storms
- Phase 1 Plan 03: Worker error handlers log without crashing - Critical for production stability
- Phase 1 Plan 04: 4-layer prompt injection defense - Sanitize, spotlight, detect, filter - cannot be retrofitted
- Phase 1 Plan 04: Spotlighting with <|user_input_start|> markers - Microsoft research-based data/instruction separation
- Phase 1 Plan 04: Logger redaction of all secrets - Automatic protection prevents accidental exposure
- Phase 1 Plan 05: Bolt customRoutes for health endpoints - Type-safe official API instead of private receiver access
- Phase 2 Plan 01: Unique constraint on (workspace_id, user_id, channel_id) - Prevents duplicate watches
- Phase 2 Plan 01: 7-day window for thread participation - Balances context freshness with user engagement
- Phase 2 Plan 01: Separate threadParticipants table - Enables granular per-thread tracking vs channel-level watches
- Phase 2 Plan 02: Claude Sonnet 4 (claude-sonnet-4-20250514) - Balance of quality and speed for response generation
- Phase 2 Plan 02: 1024 max tokens for suggestions - Sufficient for concise professional responses
- Phase 2 Plan 02: prepareForAI for input sanitization - Adds spotlighting markers to prevent prompt injection
- Phase 2 Plan 02: sanitizeAIOutput for output filtering - Prevents system content leakage to users
- Phase 2 Plan 03: 20 req/min rate limit for Slack API - Moderate limit suitable for testing and non-marketplace apps
- Phase 2 Plan 03: Warning logs on rate limit approach - Proactive monitoring of API usage patterns
- Phase 2 Plan 04: Type assertions for Slack events - TypeScript narrowing doesn't work well with Bolt union types
- Phase 2 Plan 04: Multi-user thread support - All thread participants checked for watch status, enables team collaboration
- Phase 2 Plan 04: Thread context for mentions - Automatic thread vs channel context selection based on message location
- Phase 2 Plan 04: Participation tracking on every message - Ensures 7-day window is fresh and accurate
- Phase 2 Plan 05: Check watch status before toggling - Prevents duplicate database operations and provides accurate user feedback
- Phase 2 Plan 05: Ephemeral command responses - Command feedback is private to the user who ran the command
- Phase 2 Plan 05: Immediate ack() for slash commands - Meets Slack's 3-second acknowledgment requirement
- Phase 2 Plan 06: Ephemeral messages for suggestions - Ensures private delivery only visible to target user
- Phase 2 Plan 06: Three-button action layout - Copy (primary), Refine, Dismiss for clear user options
- Phase 2 Plan 06: Non-fatal delivery errors - Suggestion generation succeeds even if message delivery fails
- Phase 2 Plan 06: Installation token lookup in workers - Workers decrypt tokens directly for Slack API access
- Phase 2 Plan 07: Message shortcut triggers AI job regardless of watch status - User-initiated actions should always work
- Phase 2 Plan 07: Copy button shows code block with triple-click instructions - Slack doesn't support programmatic clipboard access
- Phase 2 Plan 07: Dismiss button uses delete_original: true - Cleanest UX for removing ephemeral messages
- Phase 2 Plan 08: Multi-turn refinement history - Tracks all refinement rounds for progressive improvement
- Phase 2 Plan 08: 2800 char metadata limit - Leaves buffer under Slack's 3000 char limit for private_metadata
- Phase 2 Plan 08: History truncation strategy - Removes oldest entries when approaching metadata limit
- Phase 2 Plan 08: Modal update pattern - Use ack with response_action:update then client.views.update for async operations
- Phase 2.1 Plan 01: Vitest v3 with v8 coverage - Latest stable, excellent monorepo support
- Phase 2.1 Plan 01: MSW v2 for HTTP mocking - Industry standard, supports Node and browser
- Phase 2.1 Plan 01: PGlite for in-memory PostgreSQL - Real Postgres semantics without Docker
- Phase 2.1 Plan 01: 90% coverage threshold for slack-backend - High bar for production services
- Phase 2.1 Plan 02: vi.hoisted pattern for SDK mocks - enables mock references before import hoisting
- Phase 2.1 Plan 02: gen_random_uuid() for PGlite - uuid-ossp extension not available in PGlite
- Phase 2.1 Plan 02: Direct Anthropic SDK mocking vs MSW - SDK uses custom HTTP handling
- Phase 2.1 Plan 03: Mock limiter module for rate-limited code testing - Prevents test timeouts
- Phase 2.1 Plan 03: WebClient mock pattern for Slack API testing - Direct mock injection for unit tests
- Phase 2.1 Plan 04: gen_random_uuid() for PGlite - uuid-ossp extension not available, use built-in function
- Phase 2.1 Plan 04: vi.mock with getter for db injection - Dynamic test db injection pattern
- Phase 2.1 Plan 05: Handler callback testing pattern - Capture handlers via mock app.event/app.command for isolated testing
- Phase 2.1 Plan 06: Handler registration testing pattern - Mock App.action/view/shortcut to capture handler functions
- Phase 2.1 Plan 06: Service mocking for handlers - vi.mock at module level for refineSuggestion and queueAIResponse
- Phase 2.1 Plan 06: Metadata verification pattern - Parse private_metadata from views.open/update calls
- Phase 2.1 Plan 07: Processor simulation for job queue tests - Worker processor embedded in startWorkers() not exported
- Phase 2.1 Plan 07: Test encryption key as 32 bytes of zeros - Simple deterministic key for test reproducibility
- Phase 2.1 Plan 08: Handler callback capture for E2E - Register handlers with mock App to capture callbacks
- Phase 2.1 Plan 08: vi.hoisted for mock factory references - Enables mock functions to be accessible in mock factories
- Phase 2.1 Plan 10: Separate CI jobs for unit and integration tests - Integration tests require Redis service
- Phase 2.1 Plan 10: 14-day artifact retention for coverage reports - Balance storage cost and debugging capability
- Phase 2.1 Plan 10: vitest-coverage-report-action for PR comments - Industry standard coverage visualization
- Phase 3 Plan 01: Vector-as-text in ORM - Service layer handles vector serialization, Drizzle stores as text while PostgreSQL uses vector(1536)
- Phase 3 Plan 01: HNSW indexing - Fast approximate search over exact search for semantic similarity
- Phase 3 Plan 01: 1536 dimensions - OpenAI text-embedding-3-small standard for message embeddings
- Phase 3 Plan 02: Injection protection on preference fields - User phrases/guidance go into AI prompts, must block spotlighting markers
- Phase 3 Plan 02: Phrase limit of 20 items, 100 chars each - Prevents prompt bloat while allowing sufficient personalization
- Phase 3 Plan 02: Custom guidance limit of 500 chars - Balances user expressiveness with prompt token budget
- Phase 3 Plan 02: Enum validation for tone and formality - Controlled vocabulary ensures consistent AI behavior
- Phase 3 Plan 04: sql() for timestamp operations - Drizzle type safety with database-level precision for consent timestamps
- Phase 3 Plan 04: Upsert pattern for consent grants - Single onConflictDoUpdate operation handles initial grant and re-grant scenarios
- Phase 3 Plan 04: requireConsent() helper - Clean error handling for service layer consent enforcement
- Phase 3 Plan 04: ConsentType enum - Extensible design supports future consent types without schema changes
- Phase 3 Plan 03: 30-day window for pattern analysis - Balances freshness of user preferences with sufficient sample size
- Phase 3 Plan 03: 2+ occurrence threshold for pattern recognition - Prevents single anomalies from being treated as patterns
- Phase 3 Plan 03: Word-level diff for phrase extraction - Simple but effective Set-based comparison for identifying changes
- Phase 3 Plan 03: Heuristic-based refinement type detection - Length ratio, sentence count, and tone indicators auto-classify refinements
- Phase 3 Plan 05: Pseudo-embedding placeholder - Feature-based 1536-dim vectors until real embedding API integrated
- Phase 3 Plan 05: pgvector with fallback - Raw SQL for cosine similarity with Drizzle ORM fallback on failure
- Phase 3 Plan 05: 90-day window for history - Balance freshness with sufficient sample size for pattern analysis
- Phase 3 Plan 05: 3+ occurrence threshold - Greetings/signoffs must appear 3+ times to be considered patterns
- Phase 3 Plan 06: Explicit preferences override learned patterns - Priority order ensures user control
- Phase 3 Plan 06: History thresholds - 10 messages for similar search, 50 for patterns, 30 for characteristics
- Phase 3 Plan 06: Feedback threshold - 5 samples minimum before showing learned style adjustments
- Phase 3 Plan 06: XML-structured style context - Clear data/instruction separation for AI prompts
- Phase 3 Plan 07: Prompt caching with ephemeral type - Both base prompt and style context cached to reduce API costs
- Phase 3 Plan 07: Non-fatal tracking errors - Refinement succeeds even if feedback tracking fails
- Phase 3 Plan 07: Metadata propagation for refinements - workspaceId and userId passed through modal private_metadata
- Phase 4 Plan 01: Port 3001 for web-portal dev server - Avoids conflict with slack-backend on port 3000
- Phase 4 Plan 01: New York style for shadcn/ui - Professional appearance with neutral base color
- Phase 4 Plan 01: Sonner for toast notifications - Replaces deprecated toast component
- Phase 4 Plan 01: Database package exports compiled dist files - Enables Next.js Turbopack module resolution
- Phase 4 Plan 01: Standalone output mode - Prepares for Docker deployment in Phase 5
- Phase 4 Plan 03: Stateless JWT sessions with jose - Edge-compatible, no database session storage
- Phase 4 Plan 03: 7-day session expiration - Balance between convenience and security
- Phase 4 Plan 03: CSRF protection via OAuth state parameter - Security best practice prevents authorization code interception
- Phase 4 Plan 03: DAL security boundary pattern - Middleware optimistic, verifySession actual security per CVE-2025-29927
- Phase 4 Plan 03: HTTP-only, secure, SameSite=lax cookies - Protection against XSS and CSRF
- Phase 4 Plan 04: React cache() for query request deduplication - Prevents duplicate database calls during React render passes
- Phase 4 Plan 04: Learning phase thresholds - Early (<15), Building (<50), Personalized (<150), Highly Personalized (150+)
- Phase 4 Plan 04: Cached database queries pattern - verifySession() → cache() wrapper → Drizzle query for security and performance
- Phase 4 Plan 07: Schema destructure pattern - Import db and schema from lib/db, destructure tables from schema for Drizzle ORM compatibility

### Pending Todos

- Update existing tests for new SuggestionContext/RefinementContext interfaces (testing phase)

### Blockers/Concerns

**Research-identified risks to address:**
- ~~Phase 1: Prompt injection prevention must be architected from start (cannot retrofit)~~ ADDRESSED (01-04)
- ~~Phase 1: OAuth scopes must follow least privilege (changing post-launch requires workspace re-approval)~~ ADDRESSED (01-02)
- Phase 1: HTTP webhooks required for production (Socket Mode hits 10 workspace limit)
- Phase 2: AI response latency must stay under 3 seconds (async job processing + streaming)
- ~~Phase 3: GDPR compliance for message history access (RAG not fine-tuning, explicit consent)~~ ADDRESSED (03-04)
- Phase 3: pgvector extension required in production PostgreSQL (not available in all managed services)

## Session Continuity

Last session: 2026-01-27
Stopped at: Completed 04-07-PLAN.md (People Context Management)
Resume file: None

**Next action:** Continue Phase 04 web portal implementation with plan 04-08 (Feedback History Page).

---
*Last updated: 2026-01-27*
