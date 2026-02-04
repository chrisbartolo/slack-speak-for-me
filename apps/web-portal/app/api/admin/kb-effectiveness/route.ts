import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, sql, and, gte } from 'drizzle-orm';

const { kbEffectiveness, knowledgeBaseDocuments, suggestionFeedback, kbCandidates } = schema;

interface DocumentEffectiveness {
  documentId: string;
  title: string;
  category: string | null;
  timesUsed: number;
  acceptedCount: number;
  dismissedCount: number;
  acceptanceRate: number;
  avgSimilarity: number;
}

interface CandidateStats {
  pending: number;
  approved: number;
  rejected: number;
  merged: number;
}

interface GrowthTrendPoint {
  week: string;
  created: number;
  approved: number;
  rejected: number;
}

/**
 * GET /api/admin/kb-effectiveness
 * Get KB effectiveness metrics and learning loop stats
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Query 1: Per-document effectiveness
    // Join kbEffectiveness with knowledgeBaseDocuments and LEFT JOIN suggestionFeedback
    const documentEffectivenessResults = await db.execute<{
      document_id: string;
      title: string;
      category: string | null;
      times_used: string;
      accepted_count: string;
      dismissed_count: string;
      acceptance_rate: string;
      avg_similarity: string;
    }>(sql`
      SELECT
        kbe.kb_document_id as document_id,
        kbd.title,
        kbd.category,
        COUNT(DISTINCT kbe.suggestion_id)::text as times_used,
        COUNT(DISTINCT CASE WHEN sf.action = 'accepted' THEN kbe.suggestion_id END)::text as accepted_count,
        COUNT(DISTINCT CASE WHEN sf.action = 'dismissed' THEN kbe.suggestion_id END)::text as dismissed_count,
        CASE
          WHEN COUNT(DISTINCT kbe.suggestion_id) > 0
          THEN (COUNT(DISTINCT CASE WHEN sf.action = 'accepted' THEN kbe.suggestion_id END)::float / COUNT(DISTINCT kbe.suggestion_id)::float * 100)
          ELSE 0
        END as acceptance_rate,
        AVG(kbe.similarity)::text as avg_similarity
      FROM kb_effectiveness kbe
      INNER JOIN knowledge_base_documents kbd ON kbe.kb_document_id = kbd.id
      LEFT JOIN suggestion_feedback sf ON kbe.suggestion_id = sf.suggestion_id
      WHERE kbe.organization_id = ${admin.organizationId}
        AND kbe.created_at >= ${dateThreshold.toISOString()}
      GROUP BY kbe.kb_document_id, kbd.title, kbd.category
      ORDER BY times_used DESC
      LIMIT 50
    `);

    const documentEffectiveness: DocumentEffectiveness[] = documentEffectivenessResults.map(row => ({
      documentId: row.document_id,
      title: row.title,
      category: row.category,
      timesUsed: parseInt(row.times_used, 10),
      acceptedCount: parseInt(row.accepted_count, 10),
      dismissedCount: parseInt(row.dismissed_count, 10),
      acceptanceRate: parseFloat(row.acceptance_rate),
      avgSimilarity: parseFloat(row.avg_similarity) || 0,
    }));

    // Query 2: Learning loop stats (candidate counts by status)
    const candidateStatsResults = await db.execute<{
      status: string;
      count: string;
    }>(sql`
      SELECT status, COUNT(*)::text as count
      FROM kb_candidates
      WHERE organization_id = ${admin.organizationId}
      GROUP BY status
    `);

    const candidateStats: CandidateStats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      merged: 0,
    };

    for (const row of candidateStatsResults) {
      if (row.status === 'pending') candidateStats.pending = parseInt(row.count, 10);
      else if (row.status === 'approved') candidateStats.approved = parseInt(row.count, 10);
      else if (row.status === 'rejected') candidateStats.rejected = parseInt(row.count, 10);
      else if (row.status === 'merged') candidateStats.merged = parseInt(row.count, 10);
    }

    // Query 3: KB growth over time (last 12 weeks)
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 weeks

    const growthTrendResults = await db.execute<{
      week_start: string;
      created: string;
      approved: string;
      rejected: string;
    }>(sql`
      SELECT
        DATE_TRUNC('week', created_at)::date as week_start,
        COUNT(*)::text as created,
        COUNT(CASE WHEN status = 'approved' THEN 1 END)::text as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END)::text as rejected
      FROM kb_candidates
      WHERE organization_id = ${admin.organizationId}
        AND created_at >= ${twelveWeeksAgo.toISOString()}
      GROUP BY week_start
      ORDER BY week_start ASC
    `);

    const growthTrend: GrowthTrendPoint[] = growthTrendResults.map(row => ({
      week: row.week_start,
      created: parseInt(row.created, 10),
      approved: parseInt(row.approved, 10),
      rejected: parseInt(row.rejected, 10),
    }));

    return NextResponse.json({
      documentEffectiveness,
      candidateStats,
      growthTrend,
    });
  } catch (error) {
    console.error('Get KB effectiveness error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KB effectiveness data' },
      { status: 500 }
    );
  }
}
