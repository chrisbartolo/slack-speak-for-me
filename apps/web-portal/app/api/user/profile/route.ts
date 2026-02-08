import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth/dal';
import { encrypt } from '@/lib/auth/session';
import { db, users } from '@slack-speak/database';
import { and, eq } from 'drizzle-orm';

export async function PATCH(request: NextRequest) {
  try {
    // Use getOptionalSession (not verifySession) in API routes —
    // verifySession calls redirect() which throws inside try/catch
    const session = await getOptionalSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Update or create user record with email
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.workspaceId, session.workspaceId),
          eq(users.slackUserId, session.userId)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(users)
        .set({ email: normalizedEmail })
        .where(eq(users.id, existing.id));
    } else {
      await db
        .insert(users)
        .values({
          workspaceId: session.workspaceId,
          slackUserId: session.userId,
          email: normalizedEmail,
          role: 'member',
        });
    }

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
    const message = error instanceof Error ? error.message : String(error);
    console.error('Update profile error:', message, error);
    return NextResponse.json(
      { error: 'Failed to update profile', detail: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getOptionalSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

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
    const message = error instanceof Error ? error.message : String(error);
    console.error('Get profile error:', message, error);
    return NextResponse.json(
      { error: 'Failed to get profile', detail: message },
      { status: 500 }
    );
  }
}
