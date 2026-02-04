import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const VALID_PLANS = ['free', 'starter', 'pro', 'team', 'business'];
const VALID_STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'paused', null];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireSuperAdmin();
    const { orgId } = await params;

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'assign-plan': {
        const { planId, subscriptionStatus, seatCount, reason } = body;

        if (!VALID_PLANS.includes(planId)) {
          return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
        }

        const updates: Record<string, unknown> = {
          planId,
          updatedAt: new Date(),
        };

        if (subscriptionStatus !== undefined) {
          if (!VALID_STATUSES.includes(subscriptionStatus)) {
            return NextResponse.json({ error: 'Invalid subscription status' }, { status: 400 });
          }
          updates.subscriptionStatus = subscriptionStatus;
        }

        if (seatCount !== undefined) {
          const seats = parseInt(seatCount, 10);
          if (isNaN(seats) || seats < 1) {
            return NextResponse.json({ error: 'Invalid seat count' }, { status: 400 });
          }
          updates.seatCount = seats;
        }

        await db
          .update(schema.organizations)
          .set(updates)
          .where(eq(schema.organizations.id, orgId));

        return NextResponse.json({
          message: `Organization plan updated to ${planId}${reason ? ` (${reason})` : ''}`,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Organization update error:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}
