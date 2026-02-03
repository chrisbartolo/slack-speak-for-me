import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { requireAdmin } from '@/lib/auth/admin';
import { getTeamMetrics, getUserMetrics } from '@/lib/admin/analytics';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format');
    const view = searchParams.get('view');

    // Determine what data to return
    if (view === 'users') {
      // Per-user metrics
      const userMetrics = await getUserMetrics(
        session.organizationId,
        session.workspaceId
      );

      if (format === 'csv') {
        // Convert to CSV
        const csv = Papa.unparse(userMetrics, {
          header: true,
          columns: ['userId', 'email', 'suggestionCount', 'acceptedCount', 'refinedCount', 'dismissedCount', 'lastActive'],
        });

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="user-metrics-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });
      }

      return NextResponse.json(userMetrics);
    }

    // Default: team metrics
    const teamMetrics = await getTeamMetrics(
      session.organizationId,
      session.workspaceId
    );

    if (format === 'csv') {
      // Convert to CSV
      const csv = Papa.unparse([teamMetrics], {
        header: true,
      });

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="team-analytics-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(teamMetrics);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
