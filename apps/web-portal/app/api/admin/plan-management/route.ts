import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { getWorkspaceUserPlans } from '@/lib/billing/plan-management';

export async function GET() {
  try {
    const session = await requireAdmin();
    const superAdmin = await isSuperAdmin();

    if (!superAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const users = await getWorkspaceUserPlans(session.workspaceId);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Plan management GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch user plans' }, { status: 500 });
  }
}
