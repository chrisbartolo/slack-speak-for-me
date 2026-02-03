import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { getViolationStats } from '@/lib/admin/guardrails';

/**
 * GET /api/admin/guardrails/violations
 * Returns violation statistics
 * Query params: ?days=30
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Validate days parameter
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'days must be between 1 and 365' },
        { status: 400 }
      );
    }

    const stats = await getViolationStats(session.organizationId, days);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching violation stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch violation statistics' },
      { status: 500 }
    );
  }
}
