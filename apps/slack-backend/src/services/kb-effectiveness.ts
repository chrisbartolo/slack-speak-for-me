import { db, kbEffectiveness, knowledgeBaseDocuments, suggestionFeedback } from '@slack-speak/database';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

/**
 * Record KB document usage for a suggestion (fire-and-forget)
 *
 * Tracks which KB documents were used during suggestion generation.
 * Links to suggestion outcomes via suggestionId for effectiveness measurement.
 */
export async function recordKBUsage(params: {
  suggestionId: string;
  organizationId: string;
  kbDocumentIds: string[];
  similarities: number[];
}): Promise<void> {
  try {
    if (params.kbDocumentIds.length === 0) {
      return;
    }

    // Build records for batch insert
    const records = params.kbDocumentIds.map((docId, idx) => ({
      suggestionId: params.suggestionId,
      kbDocumentId: docId,
      organizationId: params.organizationId,
      similarity: Math.round((params.similarities[idx] || 0) * 100), // Convert 0-1 float to 0-100 integer
    }));

    // Batch insert
    await db.insert(kbEffectiveness).values(records);

    logger.debug({
      suggestionId: params.suggestionId,
      organizationId: params.organizationId,
      documentsTracked: records.length,
    }, 'KB usage recorded');
  } catch (error) {
    // Fire-and-forget - log warning but never throw
    logger.warn({
      error,
      suggestionId: params.suggestionId,
      organizationId: params.organizationId,
    }, 'Failed to record KB usage');
  }
}

/**
 * Get KB document effectiveness by joining with suggestion feedback
 *
 * Returns per-document stats:
 * - Times used in suggestions
 * - Accepted/dismissed counts
 * - Acceptance rate
 * - Average similarity score
 */
export async function getKBEffectiveness(
  organizationId: string,
  options?: { days?: number }
): Promise<Array<{
  documentId: string;
  title: string;
  category: string | null;
  timesUsed: number;
  acceptedCount: number;
  dismissedCount: number;
  acceptanceRate: number;
  avgSimilarity: number;
}>> {
  const days = options?.days || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  try {
    // Raw SQL for complex join and aggregation
    const results = await db.execute(sql`
      SELECT
        kb.kb_document_id as document_id,
        doc.title,
        doc.category,
        COUNT(DISTINCT kb.suggestion_id) as times_used,
        COUNT(CASE WHEN sf.action = 'accepted' THEN 1 END) as accepted_count,
        COUNT(CASE WHEN sf.action = 'dismissed' THEN 1 END) as dismissed_count,
        CASE
          WHEN COUNT(CASE WHEN sf.action IN ('accepted', 'dismissed') THEN 1 END) > 0
          THEN ROUND(
            100.0 * COUNT(CASE WHEN sf.action = 'accepted' THEN 1 END)::numeric /
            COUNT(CASE WHEN sf.action IN ('accepted', 'dismissed') THEN 1 END)::numeric
          )
          ELSE 0
        END as acceptance_rate,
        ROUND(AVG(kb.similarity)) as avg_similarity
      FROM kb_effectiveness kb
      INNER JOIN knowledge_base_documents doc ON doc.id = kb.kb_document_id
      LEFT JOIN suggestion_feedback sf ON sf.suggestion_id = kb.suggestion_id
      WHERE kb.organization_id = ${organizationId}
        AND kb.created_at >= ${cutoffDate.toISOString()}
      GROUP BY kb.kb_document_id, doc.title, doc.category
      ORDER BY times_used DESC
    `);

    const rows = results as unknown as Array<{
      document_id: string;
      title: string;
      category: string | null;
      times_used: string;
      accepted_count: string;
      dismissed_count: string;
      acceptance_rate: string;
      avg_similarity: string;
    }>;

    return rows.map(row => ({
      documentId: row.document_id,
      title: row.title,
      category: row.category,
      timesUsed: parseInt(row.times_used, 10),
      acceptedCount: parseInt(row.accepted_count, 10),
      dismissedCount: parseInt(row.dismissed_count, 10),
      acceptanceRate: parseInt(row.acceptance_rate, 10),
      avgSimilarity: parseInt(row.avg_similarity, 10),
    }));
  } catch (error) {
    logger.error({
      error,
      organizationId,
      days,
    }, 'Failed to get KB effectiveness');
    throw error;
  }
}

/**
 * Get low-performing KB documents
 *
 * Returns documents with:
 * - Acceptance rate < 30%
 * - Minimum 5 times used (to filter out noise)
 */
export async function getLowPerformingDocs(organizationId: string): Promise<Array<{
  documentId: string;
  title: string;
  category: string | null;
  timesUsed: number;
  acceptedCount: number;
  dismissedCount: number;
  acceptanceRate: number;
  avgSimilarity: number;
}>> {
  const allDocs = await getKBEffectiveness(organizationId);

  // Filter to low performers
  return allDocs.filter(doc =>
    doc.timesUsed >= 5 &&
    doc.acceptanceRate < 30
  );
}
