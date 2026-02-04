import Anthropic from '@anthropic-ai/sdk';
import { db, kbCandidates } from '@slack-speak/database';
import { eq, and, sql } from 'drizzle-orm';
import { env } from '../env.js';
import { logger } from '../utils/logger.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

/**
 * Result from evaluating a suggestion for reusable knowledge
 */
export interface KnowledgeEvaluation {
  shouldCreate: boolean;
  title?: string;
  category?: string;
  excerpt?: string;
  reasoning: string;
}

interface EvaluateForKnowledgeParams {
  suggestionText: string;
  triggerContext: string;
  organizationId: string;
}

/**
 * Generate embedding for text (same approach as knowledge-base.ts)
 *
 * Uses hash-based pseudo-embedding that captures basic text characteristics.
 * Dimension: 1536 to match schema
 */
async function embedText(text: string): Promise<number[]> {
  const embedding = new Array(1536).fill(0);

  // Hash various text features into the embedding
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const chars = normalizedText.split('');

  // Feature 1-100: Character frequency
  for (const char of chars) {
    const idx = char.charCodeAt(0) % 100;
    embedding[idx] += 1 / chars.length;
  }

  // Feature 100-200: Word length distribution
  for (const word of words) {
    const idx = 100 + Math.min(word.length, 20) * 5;
    embedding[idx] += 1 / words.length;
  }

  // Feature 200-300: Common word presence
  const commonWords = ['the', 'a', 'is', 'are', 'was', 'were', 'have', 'has',
    'do', 'does', 'will', 'would', 'could', 'should', 'please', 'thanks',
    'hi', 'hey', 'hello', 'best', 'regards', 'sincerely'];
  for (let i = 0; i < commonWords.length; i++) {
    if (normalizedText.includes(commonWords[i])) {
      embedding[200 + i * 4] = 1;
    }
  }

  // Feature 300-400: Punctuation patterns
  const punctuation = ['!', '?', '.', ',', ';', ':', '-', '...'];
  for (let i = 0; i < punctuation.length; i++) {
    const count = (normalizedText.match(new RegExp('\\' + punctuation[i], 'g')) || []).length;
    embedding[300 + i * 10] = count / Math.max(text.length / 50, 1);
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

const EVALUATION_PROMPT = `Evaluate whether this accepted AI suggestion contains reusable knowledge patterns that could help generate better suggestions in similar future situations.

Trigger context: {triggerContext}

Accepted suggestion: "{suggestionText}"

Determine:
1. Does this contain a reusable pattern (de-escalation technique, phrasing approach, domain knowledge)?
2. Would storing this help generate better suggestions in similar future situations?
3. Is it specific enough to be useful but general enough to apply beyond this exact message?

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "shouldCreate": true/false,
  "title": "short descriptive title (if shouldCreate=true)",
  "category": "de_escalation|phrasing_patterns|domain_knowledge|best_practices (if shouldCreate=true)",
  "excerpt": "the reusable part of the suggestion (if shouldCreate=true)",
  "reasoning": "brief explanation of your decision"
}`;

/**
 * Evaluate whether an accepted suggestion contains reusable knowledge
 *
 * Uses Claude API to determine if the suggestion should be added to KB candidates.
 * Returns false on any error to prevent blocking (fire-and-forget pattern).
 */
export async function evaluateForKnowledge(
  params: EvaluateForKnowledgeParams
): Promise<KnowledgeEvaluation> {
  const startTime = Date.now();

  // Fallback for any error condition
  const fallback: KnowledgeEvaluation = {
    shouldCreate: false,
    reasoning: 'evaluation_failed',
  };

  try {
    // Build prompt with suggestion and context
    const prompt = EVALUATION_PROMPT
      .replace('{triggerContext}', params.triggerContext)
      .replace('{suggestionText}', params.suggestionText);

    // Create AbortController for 5-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }, {
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      const rawContent = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      // Parse JSON response
      const parsed = JSON.parse(rawContent.trim());

      // Validate parsed values
      if (typeof parsed.shouldCreate !== 'boolean') {
        logger.warn({ parsedShouldCreate: parsed.shouldCreate }, 'Invalid shouldCreate value, using fallback');
        return fallback;
      }

      if (typeof parsed.reasoning !== 'string') {
        logger.warn({ parsedReasoning: parsed.reasoning }, 'Invalid reasoning, using fallback');
        return fallback;
      }

      // If shouldCreate is true, validate required fields
      if (parsed.shouldCreate) {
        if (typeof parsed.title !== 'string' || !parsed.title.trim()) {
          logger.warn({ parsedTitle: parsed.title }, 'Invalid title for shouldCreate=true, using fallback');
          return fallback;
        }

        const validCategories = ['de_escalation', 'phrasing_patterns', 'domain_knowledge', 'best_practices'];
        if (!validCategories.includes(parsed.category)) {
          logger.warn({ parsedCategory: parsed.category }, 'Invalid category value, using fallback');
          return fallback;
        }

        if (typeof parsed.excerpt !== 'string' || !parsed.excerpt.trim()) {
          logger.warn({ parsedExcerpt: parsed.excerpt }, 'Invalid excerpt for shouldCreate=true, using fallback');
          return fallback;
        }
      }

      const result: KnowledgeEvaluation = {
        shouldCreate: parsed.shouldCreate,
        title: parsed.title,
        category: parsed.category,
        excerpt: parsed.excerpt,
        reasoning: parsed.reasoning,
      };

      const processingTimeMs = Date.now() - startTime;

      logger.info({
        organizationId: params.organizationId,
        shouldCreate: result.shouldCreate,
        processingTimeMs,
      }, 'KB evaluation complete');

      return result;
    } catch (abortError) {
      if ((abortError as any).name === 'AbortError') {
        logger.warn({ timeoutMs: 5000 }, 'KB evaluation timed out, using fallback');
        return fallback;
      }
      throw abortError; // Re-throw non-timeout errors
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    logger.warn({
      error,
      processingTimeMs,
    }, 'KB evaluation failed, using fallback');

    return fallback;
  }
}

interface CreateOrUpdateCandidateParams {
  organizationId: string;
  title: string;
  content: string;
  category: string;
  reasoning: string;
  sourceSuggestionId?: string;
}

/**
 * Create or update a KB candidate
 *
 * Checks for near-duplicates using vector similarity. If a duplicate is found (similarity > 0.9),
 * increments the existing candidate's metrics. Otherwise, creates a new candidate.
 *
 * @returns The candidate ID (string)
 */
export async function createOrUpdateCandidate(
  params: CreateOrUpdateCandidateParams
): Promise<string> {
  try {
    // Generate embedding for content
    const embedding = await embedText(params.content);
    const embeddingStr = JSON.stringify(embedding);

    // Check for near-duplicates using vector similarity
    const duplicates = await db.execute(sql`
      SELECT
        id,
        acceptance_count,
        unique_users_count,
        avg_similarity,
        created_at
      FROM kb_candidates
      WHERE organization_id = ${params.organizationId}
        AND status = 'pending'
        AND 1 - (embedding::vector <=> ${embeddingStr}::vector) > 0.9
      LIMIT 1
    `);

    const rows = duplicates as unknown as Array<{
      id: string;
      acceptance_count: number;
      unique_users_count: number;
      avg_similarity: number;
      created_at: Date;
    }>;

    if (rows.length > 0) {
      // Duplicate found - update existing candidate
      const duplicate = rows[0];

      // Increment acceptance count and unique users
      const newAcceptanceCount = duplicate.acceptance_count + 1;
      const newUniqueUsersCount = duplicate.unique_users_count + 1;

      // Recalculate quality score
      const daysSinceCreation = Math.floor((Date.now() - duplicate.created_at.getTime()) / (1000 * 60 * 60 * 24));
      const newQualityScore = calculateQualityScore({
        acceptanceCount: newAcceptanceCount,
        avgSimilarity: duplicate.avg_similarity,
        uniqueUsersCount: newUniqueUsersCount,
        daysSinceCreation,
      });

      await db
        .update(kbCandidates)
        .set({
          acceptanceCount: newAcceptanceCount,
          uniqueUsersCount: newUniqueUsersCount,
          qualityScore: newQualityScore,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(kbCandidates.id, duplicate.id));

      logger.info({
        organizationId: params.organizationId,
        candidateId: duplicate.id,
        newAcceptanceCount,
        newQualityScore,
      }, 'Updated existing KB candidate (duplicate detected)');

      return duplicate.id;
    } else {
      // No duplicate - create new candidate
      const [inserted] = await db.insert(kbCandidates).values({
        organizationId: params.organizationId,
        title: params.title,
        content: params.content,
        category: params.category,
        embedding: embeddingStr,
        reasoning: params.reasoning,
        sourceSuggestionId: params.sourceSuggestionId,
        acceptanceCount: 1,
        uniqueUsersCount: 1,
        avgSimilarity: 0, // Will be computed when comparing to other suggestions
        qualityScore: calculateQualityScore({
          acceptanceCount: 1,
          avgSimilarity: 0,
          uniqueUsersCount: 1,
          daysSinceCreation: 0,
        }),
        status: 'pending',
      }).returning({ id: kbCandidates.id });

      logger.info({
        organizationId: params.organizationId,
        candidateId: inserted.id,
        category: params.category,
      }, 'Created new KB candidate');

      return inserted.id;
    }
  } catch (error) {
    logger.warn({
      error,
      organizationId: params.organizationId,
    }, 'Failed to create or update KB candidate');
    throw error; // Let caller handle
  }
}

interface CalculateQualityScoreParams {
  acceptanceCount: number;
  avgSimilarity: number;
  uniqueUsersCount: number;
  daysSinceCreation: number;
}

/**
 * Calculate quality score for a KB candidate
 *
 * Uses composite formula:
 * - Acceptance: 40% weight (normalized by 10 acceptances)
 * - Similarity: 30% weight (0-100 scale)
 * - Diversity: 20% weight (normalized by 5 users)
 * - Recency: 10% weight (decays over 30 days)
 *
 * @returns Integer 0-100
 */
export function calculateQualityScore(params: CalculateQualityScoreParams): number {
  const acceptanceWeight = 0.4;
  const acceptanceScore = Math.min(params.acceptanceCount / 10, 1);

  const similarityWeight = 0.3;
  const similarityScore = params.avgSimilarity / 100;

  const diversityWeight = 0.2;
  const diversityScore = Math.min(params.uniqueUsersCount / 5, 1);

  const recencyWeight = 0.1;
  const recencyScore = Math.max(0, 1 - params.daysSinceCreation / 30);

  const totalScore =
    acceptanceScore * acceptanceWeight +
    similarityScore * similarityWeight +
    diversityScore * diversityWeight +
    recencyScore * recencyWeight;

  // Scale to 0-100 and round to integer
  return Math.round(totalScore * 100);
}
