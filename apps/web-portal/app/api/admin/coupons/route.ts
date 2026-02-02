import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { createCoupon } from '@/lib/billing/coupons';

export async function POST(request: NextRequest) {
  try {
    // Verify super admin access (platform-wide, not org admin)
    await requireSuperAdmin();

    const body = await request.json();
    const {
      code,
      description,
      discountType,
      discountValue,
      maxRedemptions,
      validDays,
      firstTimeOnly,
    } = body;

    if (!code || !discountType || discountValue === undefined) {
      return NextResponse.json(
        { error: 'Code, discount type, and discount value are required' },
        { status: 400 }
      );
    }

    // Calculate validUntil date if validDays provided
    let validUntil: Date | undefined;
    if (validDays) {
      validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validDays);
    }

    const coupon = await createCoupon({
      code,
      description,
      discountType,
      discountValue,
      maxRedemptions: maxRedemptions || undefined,
      validUntil,
      firstTimeOnly: firstTimeOnly ?? true,
    });

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error('Create coupon error:', error);

    if (error instanceof Error && error.message === 'Coupon code already exists') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to create coupon' },
      { status: 500 }
    );
  }
}
