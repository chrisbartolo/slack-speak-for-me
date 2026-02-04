import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { requireAdmin } from '@/lib/auth/admin';
import { getDetailedMetrics } from '@/lib/admin/response-time-analytics';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format');
    const days = parseInt(searchParams.get('days') || '90');

    const metrics = await getDetailedMetrics(session.organizationId, session.workspaceId, days);

    if (format === 'csv') {
      const csv = Papa.unparse(metrics, { header: true });
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="response-times-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Response times API error:', error);
    return NextResponse.json({ error: 'Failed to fetch response times' }, { status: 500 });
  }
}
