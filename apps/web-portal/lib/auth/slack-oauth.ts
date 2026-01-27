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
    // Use openid for Sign in with Slack
    user_scope: 'openid,profile',
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
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
