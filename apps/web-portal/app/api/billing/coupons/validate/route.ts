import { NextRequest, NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/billing/coupons';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, email, planId } = body;

    if (!code) {
      return NextResponse.json(
        { valid: false, error: 'Coupon code is required' },
        { status: 400 }
      );
    }

    // Email is optional for initial validation
    const result = await validateCoupon(
      code,
      email || 'anonymous@validation.check',
      planId
    );

    // Don't expose full coupon details to client
    return NextResponse.json({
      valid: result.valid,
      error: result.error,
      discount: result.discount,
    });
  } catch (error) {
    console.error('Coupon validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate coupon' },
      { status: 500 }
    );
  }
}
