import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/dal';
import { encrypt } from '@/lib/auth/session';
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

    // Upsert user record (handles case where user row doesn't exist yet)
    await db
      .insert(users)
      .values({
        workspaceId: session.workspaceId,
        slackUserId: session.userId,
        email: normalizedEmail,
        role: 'member',
      })
      .onConflictDoUpdate({
        target: [users.workspaceId, users.slackUserId],
        set: { email: normalizedEmail },
      });

    // Refresh session JWT with updated email and set on response directly
    // (can't use createSession() here — its cookies() API conflicts with NextResponse)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sessionToken = await encrypt({
      userId: session.userId,
      workspaceId: session.workspaceId,
      teamId: session.teamId,
      email: normalizedEmail,
      expiresAt,
    });

    const response = NextResponse.json({ success: true, email: normalizedEmail });
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      sameSite: 'lax',
      path: '/',
    });
    return response;
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
