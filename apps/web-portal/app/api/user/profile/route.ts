import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/dal';
import { db, users } from '@slack-speak/database';
import { and, eq } from 'drizzle-orm';

export async function PATCH(request: NextRequest) {
  try {
    const session = await verifySession();

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Update user record
    await db
      .update(users)
      .set({ email: normalizedEmail })
      .where(
        and(
          eq(users.workspaceId, session.workspaceId),
          eq(users.slackUserId, session.userId)
        )
      );

    return NextResponse.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await verifySession();

    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.workspaceId, session.workspaceId),
          eq(users.slackUserId, session.userId)
        )
      )
      .limit(1);

    return NextResponse.json({ email: user?.email || null });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 }
    );
  }
}
