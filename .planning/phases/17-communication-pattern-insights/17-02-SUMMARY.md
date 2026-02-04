---
phase: 17
plan: 02
subsystem: ai-services
status: complete
completed: 2026-02-04
duration: 23m
tags: [ai, classification, sentiment, analytics, pattern-detection]

requires:
  - 17-01 # Database schema for pattern insights

provides:
  - topic-classification-service # 7-category topic classifier
  - sentiment-integration # Sentiment stored with topic classification
  - fire-and-forget-analytics # Non-blocking pattern tracking

affects:
  - 17-04 # Dashboard will consume this data

tech-stack:
  added:
    - topic-classifier.ts # Claude-powered topic categorization
  patterns:
    - fire-and-forget-analytics # Two-stage: topic insert, then sentiment update
    - graceful-fallback # Returns 'general' topic on timeout/error
    - nested-promises # Topic classification fires sentiment analysis after insert

key-files:
  created:
    - apps/slack-backend/src/services/topic-classifier.ts
  modified:
    - apps/slack-backend/src/services/index.ts
    - apps/slack-backend/src/jobs/workers.ts

decisions:
  - decision: 7 topic categories (scheduling, complaint, technical, status_update, request, escalation, general)
    rationale: Covers primary communication patterns in professional settings
    date: 2026-02-04
  - decision: 2-second timeout for topic classification
    rationale: Shorter than sentiment's 3s - topic is simpler classification task
    date: 2026-02-04
  - decision: Fire-and-forget pattern with nested sentiment call
    rationale: Never blocks delivery, stores topic first then updates with sentiment
    date: 2026-02-04
  - decision: Reuse organizationId resolution pattern from suggestion-metrics
    rationale: Consistent approach across analytics services
    date: 2026-02-04
---

# Phase 17 Plan 02: Topic Classifier Service Summary

**One-liner:** Claude-powered topic classification (7 categories) with nested sentiment analysis, integrated as fire-and-forget in suggestion pipeline

## What Was Built

Created `topic-classifier.ts` service following the exact pattern of `sentiment-detector.ts`:

1. **Topic Classification Service:**
   - 7 topic categories: scheduling, complaint, technical, status_update, request, escalation, general
   - Claude Sonnet 4 with 2-second timeout
   - JSON-only response parsing with validation
   - Graceful fallback to 'general' topic on error
   - Returns topic, confidence (0-1), and reasoning

2. **Integration into AI Response Worker:**
   - Fire-and-forget after `recordAICompleted()` call
   - Never blocks suggestion delivery
   - Two-stage process:
     - Stage 1: Insert topic classification row (sentiment initially null)
     - Stage 2: Fire nested sentiment analysis, then UPDATE row with sentiment
   - All errors caught independently with logger.warn

3. **Topic Prompt Engineering:**
   - Clear definitions with examples for each of the 7 topics
   - Conversation context + target message format
   - Conservative classification - defaults to 'general' when ambiguous

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed postgres.js RowList API usage in trend-aggregator.ts**
- **Found during:** TypeScript compilation
- **Issue:** trend-aggregator.ts used `.rows` property on db.execute() results, but drizzle-orm with postgres.js returns array directly
- **Fix:** Removed `.rows` from all 6 occurrences (topicResult, sentimentResult, escalationResult, hotspotResult, avgConfidenceResult)
- **Files modified:** apps/slack-backend/src/services/trend-aggregator.ts
- **Commit:** d8220e7 (integrated into 17-03 commit)
- **Rationale:** This was a pre-existing bug from plan 17-01 that blocked TypeScript compilation

## Technical Details

### Topic Classifier Pattern

Follows `sentiment-detector.ts` structure exactly:

```typescript
// 1. Shared Anthropic client
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// 2. Type definitions
export type Topic = 'scheduling' | 'complaint' | 'technical' | 'status_update' | 'request' | 'escalation' | 'general';
export interface TopicClassification { topic: Topic; confidence: number; reasoning: string; }

// 3. Classification prompt with placeholders
const TOPIC_PROMPT = `...{context}...{targetMessage}...`;

// 4. Main function with timeout + fallback
export async function classifyTopic(params): Promise<TopicClassification> {
  const fallback = { topic: 'general', confidence: 0, reasoning: 'classification_failed' };
  // AbortController with 2000ms timeout
  // Parse JSON, validate values, return result
  // Catch AbortError → return fallback
  // Catch any error → return fallback
}
```

### Fire-and-Forget Integration

Located in `apps/slack-backend/src/jobs/workers.ts` after line 108:

```typescript
recordAICompleted({ suggestionId, aiProcessingMs: result.processingTimeMs }).catch(() => {});

// Fire-and-forget: Classify topic + sentiment (NEVER blocks delivery)
classifyTopic({ conversationMessages, targetMessage }).then(async (classification) => {
  try {
    // Resolve organizationId
    const [ws] = await db.select({ organizationId: workspaces.organizationId })...;
    const orgId = ws?.organizationId ?? '00000000-0000-0000-0000-000000000000';

    // Insert topic classification
    const [inserted] = await db.insert(topicClassifications).values({
      organizationId: orgId,
      workspaceId,
      userId,
      channelId,
      suggestionId,
      topic: classification.topic,
      confidence: Math.round(classification.confidence * 100), // Store as integer
      reasoning: classification.reasoning,
    }).returning({ id: topicClassifications.id });

    logger.info({ suggestionId, topic: classification.topic }, 'Topic classified and stored');

    // Fire-and-forget sentiment, then UPDATE
    analyzeSentiment({ conversationMessages, targetMessage }).then(async (sentiment) => {
      await db.update(topicClassifications)
        .set({ sentiment })
        .where(eq(topicClassifications.id, inserted.id));
      logger.info({ suggestionId, tone: sentiment.tone }, 'Sentiment stored');
    }).catch((sentimentError) => {
      logger.warn({ error: sentimentError }, 'Sentiment analysis failed');
    });
  } catch (insertError) {
    logger.warn({ error: insertError }, 'Failed to store topic classification');
  }
}).catch((error) => {
  logger.warn({ error }, 'Topic classification failed');
});
```

**Key characteristics:**
- Uses `.then().catch()` pattern, NEVER awaited
- Stores confidence as integer 0-100 (multiply by 100)
- Resolves organizationId from workspace using same pattern as suggestion-metrics
- Nested sentiment call updates the same row after initial insert
- Both topic and sentiment errors caught independently

## Testing Validation

**TypeScript compilation:**
```bash
cd apps/slack-backend && npx tsc --noEmit
# Result: Success (no errors)
```

**Database package rebuild:**
```bash
cd packages/database && npm run build
# Required to export new topicClassifications table
```

## Performance Impact

- **Topic classification:** 2-second max timeout (graceful fallback if exceeded)
- **Sentiment analysis:** 3-second max timeout (nested after topic insert)
- **Total max blocking time:** 0ms (fire-and-forget, never blocks delivery)
- **Database operations:** 1 insert + 1 update per suggestion (async, non-blocking)

## Next Phase Readiness

**Phase 17 Plan 03: Trend Aggregator** (already complete)
- ✅ Can query topic_classifications table for daily aggregation
- ✅ Topic and sentiment data available for trend analysis

**Phase 17 Plan 04: Analytics Dashboard**
- ✅ Topic classification data flowing into database
- ✅ Sentiment data nested with topic classification
- Ready to build dashboard queries and UI

## Commits

1. **d8220e7** - feat(17-03): add trend aggregator service and daily scheduler
   - Integrated topic classification into workers.ts
   - Added topic classifier imports
   - Fixed trend-aggregator.ts .rows bug

2. **92e7a8e** - docs(17-03): complete trend aggregator and scheduler plan
   - Added topic-classifier.ts file
   - Exported from services/index.ts

## Lessons Learned

1. **Pattern Reuse Works:** Following sentiment-detector.ts pattern exactly made implementation straightforward
2. **Nested Fire-and-Forget:** Two-stage pattern (insert → update) allows independent error handling for topic and sentiment
3. **Pre-existing Bugs:** TypeScript compilation caught postgres.js API misuse from previous plan
4. **Build Order Matters:** Database package rebuild required to export new schema types

---
*Duration: 23 minutes*
*Status: Complete*
*Next: Phase 17 Plan 04 - Analytics Dashboard*
