import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';
import { exchangeCodeForTokens, fetchUserEmail } from '@/lib/auth/slack-oauth';
import { db, workspaces, users } from '@slack-speak/database';
import { eq } from 'drizzle-orm';

// Get the base URL for redirects (handles proxy/tunnel scenarios)
function getBaseUrl(request: NextRequest): string {
  // Use env var if set, otherwise try to infer from headers
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const baseUrl = getBaseUrl(request);

  const storedState = request.cookies.get('oauth_state')?.value;
  const returnUrl = request.cookies.get('oauth_return')?.value || '/dashboard';

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${error}`, baseUrl));
  }

  // Verify state parameter (CSRF protection)
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      new URL('/login?error=invalid_state', baseUrl)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', baseUrl)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.ok) {
      console.error('Slack OAuth error:', tokens.error);
      return NextResponse.redirect(
        new URL('/login?error=oauth_failed', baseUrl)
      );
    }

    // Look up workspace UUID from team_id
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.teamId, tokens.team.id))
      .limit(1);

    if (!workspace) {
      // Workspace not found - user needs to install app first
      return NextResponse.redirect(
        new URL('/login?error=workspace_not_found', baseUrl)
      );
    }

    // Fetch user email from Slack OpenID endpoint
    const email = tokens.authed_user.access_token
      ? await fetchUserEmail(tokens.authed_user.access_token)
      : null;

    // Create session with workspace and user info
    await createSession({
      teamId: tokens.team.id,
      userId: tokens.authed_user.id,
      workspaceId: workspace.id,
      email: email ?? '',
    });

    // Upsert user record - ensures user exists with email
    // Installation store creates admin users WITHOUT email;
    // this fills in the email while preserving their admin role
    if (email) {
      await db
        .insert(users)
        .values({
          workspaceId: workspace.id,
          slackUserId: tokens.authed_user.id,
          email: email,
          role: 'member',
        })
        .onConflictDoUpdate({
          target: [users.workspaceId, users.slackUserId],
          set: { email: email },
        });
    } else {
      await db
        .insert(users)
        .values({
          workspaceId: workspace.id,
          slackUserId: tokens.authed_user.id,
          role: 'member',
        })
        .onConflictDoNothing();
    }

    // Clear OAuth cookies and redirect
    const response = NextResponse.redirect(new URL(returnUrl, baseUrl));
    response.cookies.delete('oauth_state');
    response.cookies.delete('oauth_return');

    return response;
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      new URL('/login?error=oauth_failed', baseUrl)
    );
  }
}
