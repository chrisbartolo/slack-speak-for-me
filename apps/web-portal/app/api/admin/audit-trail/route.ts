import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { getAuditTrail } from '@/lib/admin/audit-trail';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const { workspaces } = schema;

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const action = searchParams.get('action') as 'accepted' | 'refined' | 'dismissed' | 'sent' | null;
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    // Get workspace to retrieve plan ID
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, session.workspaceId))
      .limit(1);

    // Get organization plan ID for feature gating
    let planId: string | null = null;
    if (workspace?.organizationId && session.organizationId) {
      const { organizations } = schema;
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, session.organizationId))
        .limit(1);

      planId = org?.planId ?? null;
    }

    const result = await getAuditTrail(
      session.organizationId,
      session.workspaceId,
      planId,
      {
        page,
        pageSize,
        action: action ?? undefined,
        userId: userId ?? undefined,
        startDate,
        endDate,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit trail' },
      { status: 500 }
    );
  }
}
