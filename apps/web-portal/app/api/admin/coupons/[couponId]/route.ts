import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { deactivateCoupon } from '@/lib/billing/coupons';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    // Verify admin access
    await requireAdmin();

    const { couponId } = await params;

    await deactivateCoupon(couponId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Deactivate coupon error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate coupon' },
      { status: 500 }
    );
  }
}
