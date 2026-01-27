import { NextRequest, NextResponse } from 'next/server';
import { generateOAuthState, getSlackOAuthUrl } from '@/lib/auth/slack-oauth';

export async function GET(request: NextRequest) {
  const state = generateOAuthState();
  const returnUrl = request.nextUrl.searchParams.get('return') || '/';

  const response = NextResponse.redirect(getSlackOAuthUrl(state));

  // Store state and return URL in cookies for verification
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  response.cookies.set('oauth_return', returnUrl, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
  });

  return response;
}
