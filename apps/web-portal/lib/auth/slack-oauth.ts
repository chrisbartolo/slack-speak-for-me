import { randomBytes } from 'crypto';

export function generateOAuthState(): string {
  return randomBytes(16).toString('hex');
}

export function getSlackOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    scope: '', // User scope for Sign in with Slack
    redirect_uri: process.env.SLACK_WEB_REDIRECT_URI!,
    state,
    // Use openid for Sign in with Slack - include email for individual billing
    user_scope: 'openid,profile,email',
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export interface OAuthTokenResponse {
  ok: boolean;
  error?: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    access_token?: string;
  };
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.SLACK_WEB_REDIRECT_URI!,
    }),
  });

  return response.json();
}

export interface UserInfoResponse {
  ok: boolean;
  error?: string;
  user?: {
    email?: string;
  };
}

/**
 * Fetch user email from Slack using the OpenID Connect userinfo endpoint
 * Requires 'email' user scope
 */
export async function fetchUserEmail(userAccessToken: string): Promise<string | null> {
  const response = await fetch('https://slack.com/api/openid.connect.userInfo', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
    },
  });

  const data: UserInfoResponse = await response.json();

  if (!data.ok || !data.user?.email) {
    console.warn('Could not fetch user email from Slack:', data.error);
    return null;
  }

  // Normalize email to lowercase for consistent lookup
  return data.user.email.toLowerCase();
}
