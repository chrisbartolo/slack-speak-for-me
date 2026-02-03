import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, and, desc, sql } from 'drizzle-orm';

const { escalationAlerts } = schema;

/**
 * GET /api/admin/escalations
 * List escalation alerts for admin's organization
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build conditions
    const conditions = [eq(escalationAlerts.organizationId, admin.organizationId)];

    if (status) {
      conditions.push(eq(escalationAlerts.status, status));
    }

    if (severity) {
      conditions.push(eq(escalationAlerts.severity, severity));
    }

    // Fetch alerts
    const alerts = await db
      .select()
      .from(escalationAlerts)
      .where(and(...conditions))
      .orderBy(desc(escalationAlerts.createdAt))
      .limit(limit);

    // Get stats
    const statsResults = await db
      .select({
        status: escalationAlerts.status,
        count: sql<number>`count(*)`,
      })
      .from(escalationAlerts)
      .where(eq(escalationAlerts.organizationId, admin.organizationId))
      .groupBy(escalationAlerts.status);

    const stats = {
      open: 0,
      acknowledged: 0,
      resolved: 0,
      falsePositive: 0,
    };

    for (const row of statsResults) {
      const count = Number(row.count);
      switch (row.status) {
        case 'open':
          stats.open = count;
          break;
        case 'acknowledged':
          stats.acknowledged = count;
          break;
        case 'resolved':
          stats.resolved = count;
          break;
        case 'false_positive':
          stats.falsePositive = count;
          break;
      }
    }

    return NextResponse.json({ alerts, stats });
  } catch (error) {
    console.error('Get escalation alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch escalation alerts' },
      { status: 500 }
    );
  }
}
