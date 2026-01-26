---
phase: 02-core-slack-response-suggestions
plan: 02
subsystem: ai
tags: [anthropic, claude, ai-generation, bullmq, worker]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: BullMQ worker infrastructure and job types
  - phase: 01-foundation-infrastructure
    provides: Environment validation with Zod
  - phase: 01-foundation-infrastructure
    provides: Security layer with input sanitization and output filtering
provides:
  - AI service with Claude Sonnet 4 integration for response suggestions
  - BullMQ worker configured to process suggestion jobs using AI service
  - Input sanitization and output filtering applied to AI interactions
affects: [02-03, 02-04, 02-05, 02-06, personality-learning, ai-optimization]

# Tech tracking
tech-stack:
  added: [@anthropic-ai/sdk v0.71.2]
  patterns: [AI service abstraction, prompt engineering with system/user separation, token usage logging]

key-files:
  created: 
    - apps/slack-backend/src/services/ai.ts
  modified:
    - apps/slack-backend/src/services/index.ts
    - apps/slack-backend/src/jobs/workers.ts
    - apps/slack-backend/package.json

key-decisions:
  - "Claude Sonnet 4 (claude-sonnet-4-20250514) for response generation - balance of quality and speed"
  - "1024 max tokens for suggestions - concise professional responses"
  - "prepareForAI for input sanitization with spotlighting markers"
  - "sanitizeAIOutput for filtering leaked system content"

patterns-established:
  - "AI service returns both suggestion and processingTimeMs for monitoring"
  - "Worker generates suggestionId for ephemeral message tracking"
  - "Token usage logged for cost monitoring (input/output tokens)"

# Metrics
duration: 3min
completed: 2026-01-26
---

# Phase 02 Plan 02: AI Suggestion Generation Summary

**Claude Sonnet 4 integration with BullMQ worker processing, input sanitization via prepareForAI, and output filtering via sanitizeAIOutput**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-26T17:38:27Z
- **Completed:** 2026-01-26T17:41:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Integrated Anthropic SDK for Claude AI response generation
- AI service generates professional, context-aware response suggestions
- BullMQ worker processes jobs using real AI instead of placeholders
- Input sanitization and output filtering protect against prompt injection
- Token usage monitoring for cost tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Anthropic SDK and create AI suggestion service** - `1e9253f` (feat)
2. **Task 2: Update BullMQ worker to call AI service and return results** - `7fc4eb2` (feat)

## Files Created/Modified
- `apps/slack-backend/src/services/ai.ts` - AI service with generateSuggestion function using Claude Sonnet 4
- `apps/slack-backend/src/services/index.ts` - Export AI service alongside watch service
- `apps/slack-backend/src/jobs/workers.ts` - Worker calls AI service, generates suggestionId, logs results
- `apps/slack-backend/package.json` - Added @anthropic-ai/sdk dependency

## Decisions Made

1. **Model Selection: Claude Sonnet 4 (claude-sonnet-4-20250514)**
   - Rationale: Latest Sonnet model provides best balance of response quality and latency
   - Max tokens: 1024 (sufficient for professional response suggestions)

2. **Input Sanitization Pattern**
   - Use prepareForAI from validation package (adds spotlighting markers)
   - Sanitize both trigger message and context messages
   - Prevents prompt injection attacks

3. **Output Filtering Pattern**
   - Use sanitizeAIOutput to filter system content leakage
   - Ensures clean suggestions sent to users

4. **Monitoring Strategy**
   - Log input/output token counts for cost monitoring
   - Track processingTimeMs for latency monitoring
   - Generate suggestionId for ephemeral message tracking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - installation and integration proceeded smoothly.

## User Setup Required

**External services require manual configuration.** 

### Anthropic API Setup

1. **Create API Key:**
   - Visit https://console.anthropic.com/
   - Navigate to API Keys section
   - Click "Create Key"
   - Copy the key (starts with `sk-ant-`)

2. **Add to Environment:**
   ```bash
   # Add to .env file in repository root
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

3. **Verify Configuration:**
   ```bash
   # Start the app - env.ts will validate the key is present
   npm run dev
   # Should start without "ANTHROPIC_API_KEY is required" error
   ```

**Why needed:** AI suggestion generation requires Claude API access for response generation.

## Next Phase Readiness

**Ready for:**
- Plan 02-03: Trigger detection (mention, reply, thread, message action)
- Plan 02-04: Context gathering from Slack conversations
- Plan 02-05: Job orchestration to wire triggers → context → AI
- Plan 02-06: Ephemeral message delivery with suggestions

**Provides:**
- AI service that accepts SuggestionContext and returns professional responses
- Worker that processes AIResponseJobData and returns AIResponseJobResult
- Security layer protecting against prompt injection

**No blockers or concerns.**

---
*Phase: 02-core-slack-response-suggestions*
*Completed: 2026-01-26*
