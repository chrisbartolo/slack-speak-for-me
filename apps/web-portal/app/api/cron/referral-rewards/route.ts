import { NextRequest, NextResponse } from 'next/server';
import { processReferralRewards } from '@/lib/billing/referrals';

/**
 * Cron endpoint for processing referral rewards.
 * Call daily via external cron, Vercel Cron, or similar.
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processReferralRewards();

    console.log('Referral rewards processed:', result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Referral reward processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process referral rewards' },
      { status: 500 }
    );
  }
}
