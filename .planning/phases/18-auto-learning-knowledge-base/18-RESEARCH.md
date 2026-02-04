# Phase 18: Auto-Learning Knowledge Base - Research

**Researched:** 2026-02-04
**Domain:** Knowledge base auto-learning, effectiveness tracking, candidate review workflows
**Confidence:** MEDIUM

## Summary

Phase 18 builds an auto-learning system that mines accepted AI suggestions for reusable knowledge patterns, proposes candidates for admin review, tracks which KB documents impact acceptance rates, and provides a learning loop dashboard showing KB growth and effectiveness trends.

The research reveals that modern AI knowledge bases in 2026 emphasize "retrieval-first" architectures with vector embeddings, continuous learning from user interactions, and human-in-the-loop approval workflows for quality control. Key patterns include semantic similarity ranking for candidate quality scoring, fire-and-forget async processing to avoid blocking main suggestion flows, and comprehensive effectiveness metrics tracking usage, impact, and ROI.

**Primary recommendation:** Build a background job that evaluates accepted suggestions for reusability patterns using Claude prompting, store candidates with quality scores based on acceptance frequency and semantic relevance, require admin approval before publishing to prevent low-quality content, and track effectiveness by linking KB document usage to suggestion outcomes via the existing suggestionFeedback table.

**User question answer (third-party KB integrations):** Defer third-party integrations (Notion, Confluence, GitBook) to post-Phase 18. The existing manual CRUD interface (Phase 12) is sufficient for Phase 18's auto-learning focus. Third-party sync adds significant complexity (OAuth flows, API rate limits, bi-directional sync, conflict resolution) that would distract from the core learning loop. Once the auto-learning system proves valuable with internal KB content, consider adding import-only integrations (not bi-directional sync) as a separate phase if customers request it. All three platforms have mature REST APIs that could support future one-way imports.

## Standard Stack

The established libraries/tools for auto-learning knowledge bases:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Current | Database queries with type safety | Already used in codebase for all DB operations |
| BullMQ | Current | Background job scheduling | Already used for async processing (Phase 1) |
| pgvector | 0.7+ | Vector similarity search | Already installed (Phase 12) for semantic KB search |
| Claude API | 3.5+ | Pattern extraction via prompting | Already integrated (Phase 2) for AI operations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | 9.0+ | Generate suggestion IDs | Already used throughout codebase |
| Tremor | 3.x | Dashboard charts | Already used (Phase 13) for analytics visualization |
| TanStack Table | 8.x | Candidate review table | Already used (Phase 13) for admin data tables |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude prompting | Specialized ML model | Claude is already integrated and can extract patterns via prompting; custom ML would require training data, infrastructure, and maintenance |
| Fire-and-forget jobs | Synchronous processing | Fire-and-forget avoids blocking suggestion delivery; sync would add latency to user-facing flows |
| Manual quality scoring | Automated scoring | Manual scoring requires admin time for every candidate; automated scoring with admin review provides best balance |

**Installation:**
No new dependencies required — all libraries already in package.json from prior phases.

## Architecture Patterns

### Recommended Project Structure
```
apps/slack-backend/src/
├── services/
│   ├── kb-learner.ts           # Extract patterns from accepted suggestions
│   ├── kb-effectiveness.ts     # Track which KB docs are used and their impact
│   └── kb-candidate-scorer.ts  # Score candidates by quality metrics
├── jobs/
│   └── kb-learning.ts          # Background job triggered on acceptance
apps/web-portal/app/
├── api/admin/kb-candidates/
│   ├── route.ts                # List candidates with filters
│   └── [id]/
│       └── route.ts            # Approve/reject/merge actions
├── api/admin/kb-effectiveness/
│   └── route.ts                # Effectiveness metrics API
└── admin/learning-loop/
    └── page.tsx                # Dashboard with candidates table and charts
```

### Pattern 1: Fire-and-Forget Learning Job
**What:** Trigger async KB learning job after suggestion acceptance without blocking user flow
**When to use:** Any time an accepted suggestion might contain reusable knowledge
**Example:**
```typescript
// In feedback-tracker.ts after recording acceptance
export async function trackAcceptance(
  workspaceId: string,
  userId: string,
  suggestionId: string,
  suggestionText: string,
  channelId?: string
): Promise<void> {
  await trackFeedback({
    workspaceId,
    userId,
    suggestionId,
    action: 'accepted',
    originalText: suggestionText,
    finalText: suggestionText,
    channelId,
  });

  // Fire-and-forget KB learning job
  queueKBLearningJob({
    organizationId,
    suggestionId,
    suggestionText,
    triggerContext,
  }).catch(() => {}); // Don't block on job queueing failure
}
```

### Pattern 2: Claude-Powered Pattern Extraction
**What:** Use Claude prompting to evaluate if suggestion contains reusable knowledge
**When to use:** In background job processing accepted suggestions
**Example:**
```typescript
// Source: AI knowledge base pattern extraction (industry standard 2026)
async function evaluateForKnowledge(params: {
  suggestionText: string;
  triggerContext: string;
  acceptanceCount: number;
}): Promise<{ shouldCreate: boolean; title?: string; category?: string; reasoning: string }> {
  const prompt = `Evaluate if this AI-generated suggestion contains reusable knowledge that could help future suggestions.

Suggestion: "${params.suggestionText}"
Context: "${params.triggerContext}"
Times accepted: ${params.acceptanceCount}

Determine:
1. Does this contain a reusable pattern (de-escalation technique, phrasing approach, domain knowledge)?
2. Would storing this help generate better suggestions in similar situations?
3. Is it general enough to apply beyond this specific message?

If yes, suggest:
- Title: Brief descriptive title
- Category: Which KB category (de_escalation, phrasing_patterns, domain_knowledge, etc.)
- Excerpt: Key reusable part (1-2 sentences)

Respond in JSON: { shouldCreate: boolean, title?: string, category?: string, excerpt?: string, reasoning: string }`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(response.content[0].text);
}
```

### Pattern 3: Quality Score Ranking
**What:** Rank KB candidates by composite quality score for admin review prioritization
**When to use:** When listing candidates in admin UI
**Example:**
```typescript
// Source: Knowledge base ranking algorithms (industry standard)
function calculateQualityScore(candidate: {
  acceptanceCount: number;
  avgSimilarity: number;
  uniqueUsersCount: number;
  daysSinceCreation: number;
}): number {
  // Weighted scoring formula
  const acceptanceWeight = 0.4;  // Most important: proven value
  const similarityWeight = 0.3;  // Second: semantic relevance
  const diversityWeight = 0.2;   // Third: multiple users accepted
  const recencyWeight = 0.1;     // Fourth: recent patterns prioritized

  const acceptanceScore = Math.min(candidate.acceptanceCount / 10, 1); // Cap at 10
  const similarityScore = candidate.avgSimilarity; // Already 0-1
  const diversityScore = Math.min(candidate.uniqueUsersCount / 5, 1); // Cap at 5
  const recencyScore = Math.max(0, 1 - candidate.daysSinceCreation / 30); // Decay over 30 days

  return (
    acceptanceScore * acceptanceWeight +
    similarityScore * similarityWeight +
    diversityScore * diversityWeight +
    recencyScore * recencyWeight
  ) * 100; // Scale to 0-100
}
```

### Pattern 4: Effectiveness Attribution
**What:** Link KB document usage to suggestion outcomes via existing tables
**When to use:** When KB search returns results during suggestion generation
**Example:**
```typescript
// In ai.ts during suggestion generation
const kbResults = await searchKnowledgeBase({
  organizationId,
  query: context.triggerMessage,
  limit: 3,
  timeout: 500,
});

if (kbResults.length > 0 && kbResults[0].similarity > 0.7) {
  // Track which KB docs were used
  await recordKBUsage({
    suggestionId: context.suggestionId,
    kbDocumentIds: kbResults.map(r => r.id),
    similarities: kbResults.map(r => r.similarity),
  }).catch(() => {}); // Fire-and-forget

  // Include KB content in prompt
  kbContext = `\n\n<knowledge_base>\nRelevant guidance:\n${kbResults[0].content}\n</knowledge_base>\n`;
}

// Later: join kb_usage with suggestionFeedback to calculate impact
// SELECT kb_document_id,
//        COUNT(*) as used_count,
//        SUM(CASE WHEN sf.action = 'accepted' THEN 1 ELSE 0 END) as acceptance_count,
//        (SUM(CASE WHEN sf.action = 'accepted' THEN 1 ELSE 0 END)::float / COUNT(*)) as acceptance_rate
// FROM kb_usage ku
// JOIN suggestion_feedback sf ON ku.suggestion_id = sf.suggestion_id
// GROUP BY kb_document_id
```

### Anti-Patterns to Avoid
- **Auto-publishing candidates:** Auto-publishing risks low-quality content polluting KB. Always require human review before making candidates visible to AI.
- **Synchronous learning jobs:** Running learning analysis during suggestion delivery adds latency. Use fire-and-forget background jobs.
- **No deduplication:** Multiple similar suggestions create duplicate candidates. Use vector similarity to merge/deduplicate candidates before admin review.
- **Ignoring negative signals:** Don't only track acceptances. Track which KB docs were used in dismissed suggestions to identify low-quality content.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Semantic similarity search | Custom vector distance calculations | pgvector `<=>` operator | Already installed and battle-tested; handles high-dimensional vectors efficiently |
| Quality scoring algorithm | Simple acceptance count | Composite score (acceptance, similarity, diversity, recency) | Research shows multi-factor ranking outperforms single metrics |
| Pattern extraction | Regex or keyword matching | Claude API prompting | LLMs excel at nuanced pattern recognition; regex misses semantic meaning |
| Dashboard charts | Custom D3.js/Chart.js | Tremor components | Already installed (Phase 13); handles responsive design, loading states, accessibility |
| Candidate review table | Custom table with pagination | TanStack Table | Already installed (Phase 13); handles sorting, filtering, selection out of the box |

**Key insight:** Every "don't hand-roll" item above is already integrated in the codebase from prior phases. Phase 18 should reuse these battle-tested solutions rather than building custom alternatives.

## Common Pitfalls

### Pitfall 1: Blocking Main Flow with Learning
**What goes wrong:** Running KB candidate evaluation synchronously during suggestion acceptance adds latency to user feedback
**Why it happens:** Developer instinct to process related operations together in same transaction
**How to avoid:** Use BullMQ background jobs with fire-and-forget queueing. Track acceptance immediately, queue learning job asynchronously.
**Warning signs:** Increased latency on "Copy" button clicks; timeout errors in feedback tracking

### Pitfall 2: Low-Quality Candidate Spam
**What goes wrong:** Every accepted suggestion creates a KB candidate, overwhelming admins with noise
**Why it happens:** No filtering criteria before candidate creation; trying to learn from everything
**How to avoid:** Apply filters before candidate creation: (1) minimum acceptance count (e.g., 3+), (2) Claude confidence threshold, (3) semantic similarity to avoid duplicates
**Warning signs:** Admin dashboard shows hundreds of candidates; admin ignores the feature entirely

### Pitfall 3: No Feedback Loop on KB Effectiveness
**What goes wrong:** KB grows but nobody knows if documents actually improve suggestions
**Why it happens:** Tracking KB document creation but not measuring impact on acceptance rates
**How to avoid:** Join kb_usage with suggestionFeedback to calculate per-document acceptance rates. Surface low-performing docs for admin review/removal.
**Warning signs:** KB grows to hundreds of docs but acceptance rates don't improve; admins don't know which docs are valuable

### Pitfall 4: Duplicate Candidate Accumulation
**What goes wrong:** Similar suggestions create near-duplicate KB candidates
**Why it happens:** No deduplication logic; treating each accepted suggestion independently
**How to avoid:** Before creating candidate, search existing candidates with vector similarity. If similarity > 0.9, increment existing candidate's acceptance count instead of creating new one.
**Warning signs:** Candidate list shows multiple nearly-identical entries; admin spends time merging manually

### Pitfall 5: Forgetting Negative Signals
**What goes wrong:** Tracking which KB docs are used in accepted suggestions but not in dismissed suggestions
**Why it happens:** Optimizing for "what works" without checking "what doesn't work"
**How to avoid:** Track KB usage for all suggestions (accepted, refined, dismissed). Calculate acceptance rate per KB doc. Flag docs with <50% acceptance for review.
**Warning signs:** KB contains documents that consistently appear in dismissed suggestions; overall acceptance rate decreases after KB content added

## Code Examples

Verified patterns from research and existing codebase:

### Candidate Creation with Deduplication
```typescript
// Source: Vector similarity deduplication (Phase 12 knowledge-base.ts pattern)
async function createOrUpdateCandidate(params: {
  organizationId: string;
  suggestionId: string;
  title: string;
  content: string;
  category: string;
  reasoning: string;
}): Promise<string> {
  // Generate embedding for candidate
  const embedding = await embedText(params.content);

  // Check for near-duplicates
  const duplicates = await db.execute(sql`
    SELECT id, acceptance_count
    FROM kb_candidates
    WHERE organization_id = ${params.organizationId}
      AND status = 'pending'
      AND 1 - (embedding::vector <=> ${JSON.stringify(embedding)}::vector) > 0.9
    LIMIT 1
  `);

  if (duplicates.length > 0) {
    // Increment existing candidate
    await db.update(kbCandidates)
      .set({
        acceptanceCount: sql`acceptance_count + 1`,
        lastSeenAt: new Date(),
      })
      .where(eq(kbCandidates.id, duplicates[0].id));

    return duplicates[0].id;
  }

  // Create new candidate
  const [candidate] = await db.insert(kbCandidates).values({
    organizationId: params.organizationId,
    title: params.title,
    content: params.content,
    category: params.category,
    embedding: JSON.stringify(embedding),
    reasoning: params.reasoning,
    acceptanceCount: 1,
    status: 'pending',
  }).returning({ id: kbCandidates.id });

  return candidate.id;
}
```

### Effectiveness Tracking with Attribution
```typescript
// Source: Existing suggestionMetrics and suggestionFeedback pattern (Phase 16/17)
async function recordKBUsage(params: {
  suggestionId: string;
  kbDocumentIds: string[];
  similarities: number[];
}): Promise<void> {
  // Fire-and-forget insert
  await db.insert(kbUsage).values(
    params.kbDocumentIds.map((docId, idx) => ({
      suggestionId: params.suggestionId,
      kbDocumentId: docId,
      similarity: params.similarities[idx],
    }))
  ).catch(err => {
    logger.warn({ error: err, suggestionId: params.suggestionId }, 'KB usage tracking failed');
  });
}

// Query effectiveness
async function getKBEffectiveness(organizationId: string) {
  const results = await db.execute(sql`
    SELECT
      kd.id,
      kd.title,
      kd.category,
      COUNT(ku.id) as times_used,
      COUNT(DISTINCT ku.suggestion_id) as unique_suggestions,
      SUM(CASE WHEN sf.action = 'accepted' THEN 1 ELSE 0 END) as acceptance_count,
      (SUM(CASE WHEN sf.action = 'accepted' THEN 1 ELSE 0 END)::float /
       NULLIF(COUNT(ku.id), 0)) as acceptance_rate,
      AVG(ku.similarity) as avg_similarity
    FROM knowledge_base_documents kd
    LEFT JOIN kb_usage ku ON kd.id = ku.kb_document_id
    LEFT JOIN suggestion_feedback sf ON ku.suggestion_id = sf.suggestion_id
    WHERE kd.organization_id = ${organizationId}
      AND kd.is_active = true
    GROUP BY kd.id, kd.title, kd.category
    ORDER BY times_used DESC
  `);

  return results;
}
```

### Admin Candidate Review Actions
```typescript
// Source: Existing admin patterns (Phase 13 response templates approval)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminSession(req);
  const { action, rejectionReason, mergeWithId } = await req.json();

  if (action === 'approve') {
    // Move candidate to published KB
    const candidate = await getCandidateById(params.id);

    const docId = await indexDocument({
      organizationId: candidate.organizationId,
      title: candidate.title,
      content: candidate.content,
      category: candidate.category,
      tags: candidate.tags,
    });

    // Mark candidate as approved
    await db.update(kbCandidates)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: session.userId,
        publishedDocumentId: docId,
      })
      .where(eq(kbCandidates.id, params.id));

    return Response.json({ success: true, documentId: docId });
  }

  if (action === 'reject') {
    await db.update(kbCandidates)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: session.userId,
        rejectionReason,
      })
      .where(eq(kbCandidates.id, params.id));

    return Response.json({ success: true });
  }

  if (action === 'merge' && mergeWithId) {
    // Merge this candidate into existing one
    await db.execute(sql`
      UPDATE kb_candidates
      SET acceptance_count = acceptance_count + (
        SELECT acceptance_count FROM kb_candidates WHERE id = ${params.id}
      )
      WHERE id = ${mergeWithId}
    `);

    await db.update(kbCandidates)
      .set({ status: 'merged', mergedIntoId: mergeWithId })
      .where(eq(kbCandidates.id, params.id));

    return Response.json({ success: true });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual KB curation | Auto-learning from interactions | 2024-2025 | AI knowledge bases now learn continuously; 2026 is "retrieval-first" year |
| Simple keyword search | Vector semantic search + reranking | 2023-2024 | Embedding-based similarity replaced keyword matching as default |
| Auto-publish everything | Human-in-the-loop review | 2025-2026 | Quality control critical; AI proposes, humans approve |
| Single acceptance metric | Composite quality scores | 2024-2025 | Research shows multi-factor ranking (acceptance, similarity, diversity, recency) outperforms single metrics |
| Knowledge graph structures | Vector embeddings | 2023-2024 | Embedding-first architectures replaced traditional knowledge graphs for most use cases |

**Deprecated/outdated:**
- Manual-only KB management: 2026 standards expect auto-learning capabilities with human oversight
- Keyword-based search: Vector similarity search is now baseline for AI knowledge bases
- Auto-publishing without review: Quality control via human-in-the-loop is industry standard

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal acceptance threshold for candidate creation**
   - What we know: Research suggests filtering low-frequency patterns; industry uses 2-5 acceptances minimum
   - What's unclear: Optimal threshold depends on organization size, suggestion volume, and KB growth rate
   - Recommendation: Start with 3 acceptances minimum, make configurable per org, monitor candidate quality in dashboard

2. **KB document lifecycle management**
   - What we know: KB effectiveness tracking can identify low-performing docs
   - What's unclear: When to auto-archive vs. flag for review; how to handle outdated content
   - Recommendation: Flag docs with <30% acceptance rate for admin review; implement "last reviewed" field for manual refresh cycles

3. **Third-party integration scope (user question)**
   - What we know: Notion, Confluence, GitBook all have mature REST APIs; sync adds significant complexity
   - What's unclear: Customer demand for import vs. bi-directional sync; whether manual CRUD is sufficient
   - Recommendation: Defer to post-Phase 18; validate auto-learning value first, then consider import-only (not sync) if requested

4. **Candidate staleness handling**
   - What we know: Communication patterns evolve; candidates from 6+ months ago may be outdated
   - What's unclear: Automatic expiration policy vs. manual review trigger
   - Recommendation: Add "created_at" decay to quality score formula; surface oldest pending candidates in admin dashboard

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns:
  - `apps/slack-backend/src/services/knowledge-base.ts` - Vector similarity search, embedText(), chunking
  - `apps/slack-backend/src/services/feedback-tracker.ts` - Acceptance tracking, fire-and-forget pattern
  - `packages/database/src/schema.ts` - suggestionFeedback, knowledgeBaseDocuments tables
  - Phase 12 implementation - pgvector RAG with semantic search
  - Phase 16 implementation - suggestionMetrics with fire-and-forget recording
  - Phase 17 implementation - topicClassifications with async Claude processing

### Secondary (MEDIUM confidence)
- [AI Knowledge Base: The Complete Guide for 2026 | Slack](https://slack.com/blog/productivity/what-is-an-ai-knowledge-base-tools-features-and-best-practices) - Auto-learning capabilities, continuous improvement from interactions
- [AI-Driven Knowledge Base Optimization | Cobbai Blog](https://cobbai.com/blog/ai-driven-knowledge-optimization) - Pattern recognition, behavioral learning
- [10 Actionable Knowledge Base Metrics | Help Scout](https://www.helpscout.com/blog/knowledge-base-metrics/) - Effectiveness tracking metrics
- [6 Useful Knowledge Management Metrics | Archbee](https://www.archbee.com/blog/knowledge-management-metrics) - Self-service resolution, ticket deflection
- [How to Leverage AI Feedback Loops | Sampling Labs](https://www.samplinglabs.com/blog/how-to-leverage-ai-feedback-loops-for-continuous-improvement-in-knowledge-management) - Continuous improvement, learning loops
- [Notion API Documentation](https://developers.notion.com) - Notion integration capabilities
- [Confluence API Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/confluence-data-source-connector.html) - Confluence sync patterns
- [GitBook API Reference](https://gitbook.com/docs/developers/gitbook-api/api-reference) - GitBook integration options

### Tertiary (LOW confidence - WebSearch only)
- [Ranking vs. Classifying: Measuring Knowledge Base Completion Quality](https://arxiv.org/abs/2102.06145) - Quality ranking algorithms
- [Discovering interesting patterns through user's interactive feedback](https://dl.acm.org/doi/10.1145/1150402.1150502) - Pattern extraction research
- [How ZBrain enhances knowledge retrieval with reranking](https://zbrain.ai/how-zbrain-enhances-knowledge-retrieval-with-reranking/) - Reranking approaches
- [RAG evaluation metrics | Evidently AI](https://www.evidentlyai.com/llm-guide/rag-evaluation) - RAG quality metrics

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already integrated in codebase
- Architecture: HIGH - Fire-and-forget pattern proven in Phase 16/17; pgvector search proven in Phase 12
- Pitfalls: MEDIUM - Based on general AI/ML best practices and research; specific thresholds need validation
- Third-party integrations: MEDIUM - API documentation reviewed but implementation complexity estimated from general integration experience

**Research date:** 2026-02-04
**Valid until:** ~2026-03-04 (30 days for stable domain - knowledge base patterns evolve slowly)
