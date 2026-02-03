import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { assignPlan, grantBonusSuggestions, resetUsage } from '@/lib/billing/plan-management';

/**
 * PUT /api/admin/plan-management/[email]
 * Assign a plan to a user.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    const { email } = await params;
    const userEmail = decodeURIComponent(email);
    const body = await request.json();

    const { action } = body;

    if (action === 'assign-plan') {
      const { planId, reason } = body;
      if (!planId) {
        return NextResponse.json({ error: 'planId is required' }, { status: 400 });
      }

      const validPlans = ['free', 'starter', 'pro', 'team', 'business'];
      if (!validPlans.includes(planId)) {
        return NextResponse.json({ error: `Invalid plan: ${planId}` }, { status: 400 });
      }

      await assignPlan({
        email: userEmail,
        planId,
        reason: reason || 'Admin assignment',
        adminEmail: admin.email,
      });

      return NextResponse.json({ success: true, message: `Plan set to ${planId}` });
    }

    if (action === 'grant-usage') {
      const { amount } = body;
      if (!amount || typeof amount !== 'number' || amount < 1 || amount > 1000) {
        return NextResponse.json(
          { error: 'amount must be a number between 1 and 1000' },
          { status: 400 }
        );
      }

      const result = await grantBonusSuggestions({ email: userEmail, amount });
      return NextResponse.json({
        success: true,
        message: `Granted ${amount} bonus suggestions`,
        ...result,
      });
    }

    if (action === 'reset-usage') {
      await resetUsage(userEmail);
      return NextResponse.json({ success: true, message: 'Usage counter reset to 0' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('Plan management action error:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
