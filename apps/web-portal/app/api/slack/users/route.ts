import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { installations, workspaces } from '@slack-speak/database';
import { eq } from 'drizzle-orm';
import { decrypt } from '@slack-speak/database';

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  return Buffer.from(key, 'hex');
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // Get the installation for this workspace
    const [installation] = await db
      .select({
        botToken: installations.botToken,
      })
      .from(installations)
      .innerJoin(workspaces, eq(installations.workspaceId, workspaces.id))
      .where(eq(workspaces.id, session.workspaceId))
      .limit(1);

    if (!installation?.botToken) {
      return NextResponse.json({ error: 'App not installed' }, { status: 400 });
    }

    // Decrypt the bot token
    const botToken = decrypt(installation.botToken, getEncryptionKey());

    // Fetch users from Slack
    const response = await fetch('https://slack.com/api/users.list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack API error:', data.error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Filter and map users
    let users = data.members
      .filter((user: any) =>
        !user.deleted &&
        !user.is_bot &&
        user.id !== 'USLACKBOT' &&
        user.name !== 'slackbot'
      )
      .map((user: any) => ({
        id: user.id,
        name: user.real_name || user.name,
        displayName: user.profile?.display_name || user.real_name || user.name,
        avatar: user.profile?.image_48 || user.profile?.image_24,
        email: user.profile?.email,
      }));

    // Filter by search query if provided
    if (query) {
      const lowerQuery = query.toLowerCase();
      users = users.filter((user: any) =>
        user.name.toLowerCase().includes(lowerQuery) ||
        user.displayName.toLowerCase().includes(lowerQuery) ||
        user.id.toLowerCase().includes(lowerQuery)
      );
    }

    // Limit results
    users = users.slice(0, 50);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching Slack users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
