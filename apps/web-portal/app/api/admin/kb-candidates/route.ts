import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, and, desc, sql } from 'drizzle-orm';

const { kbCandidates } = schema;

/**
 * GET /api/admin/kb-candidates
 * List KB candidates with filtering and pagination
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
    const status = searchParams.get('status') || 'pending';
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sort = searchParams.get('sort') || 'quality_score';

    // Build WHERE clause
    const whereConditions = [
      eq(kbCandidates.organizationId, admin.organizationId),
      eq(kbCandidates.status, status),
    ];

    if (category) {
      whereConditions.push(eq(kbCandidates.category, category));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(kbCandidates)
      .where(and(...whereConditions));

    const total = countResult?.count || 0;

    // Get candidates
    let orderByColumn;
    switch (sort) {
      case 'acceptance_count':
        orderByColumn = desc(kbCandidates.acceptanceCount);
        break;
      case 'created_at':
        orderByColumn = desc(kbCandidates.createdAt);
        break;
      case 'quality_score':
      default:
        orderByColumn = desc(kbCandidates.qualityScore);
        break;
    }

    const candidates = await db
      .select()
      .from(kbCandidates)
      .where(and(...whereConditions))
      .orderBy(orderByColumn)
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      candidates,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get KB candidates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KB candidates' },
      { status: 500 }
    );
  }
}
