import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { requireAdmin } from '@/lib/auth/admin';
import { getHealthScoreTrend, getUserHealthScores, getSurveyStats, getNPSDistribution } from '@/lib/admin/satisfaction-analytics';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format');
    const type = searchParams.get('type') || 'health-scores'; // 'health-scores' | 'surveys' | 'users'

    if (format === 'csv') {
      let data: any[];
      let filename: string;

      switch (type) {
        case 'users':
          data = await getUserHealthScores(session.organizationId, session.workspaceId);
          filename = 'user-health-scores';
          break;
        case 'surveys':
          // Return survey stats as single row
          const stats = await getSurveyStats(session.organizationId);
          const nps = await getNPSDistribution(session.organizationId);
          data = [{ ...stats, ...nps }];
          filename = 'satisfaction-surveys';
          break;
        default:
          data = await getHealthScoreTrend(session.organizationId, session.workspaceId, 52);
          filename = 'health-score-trends';
      }

      const csv = Papa.unparse(data, { header: true });
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default JSON: return all data
    const [healthScoreTrend, userScores, surveyStats, npsDistribution] = await Promise.all([
      getHealthScoreTrend(session.organizationId, session.workspaceId),
      getUserHealthScores(session.organizationId, session.workspaceId),
      getSurveyStats(session.organizationId),
      getNPSDistribution(session.organizationId),
    ]);

    return NextResponse.json({ healthScoreTrend, userScores, surveyStats, npsDistribution });
  } catch (error) {
    console.error('Satisfaction API error:', error);
    return NextResponse.json({ error: 'Failed to fetch satisfaction data' }, { status: 500 });
  }
}
