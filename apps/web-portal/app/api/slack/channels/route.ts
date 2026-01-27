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
    const channelIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];

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

    // If specific channel IDs are requested, fetch info for each
    if (channelIds.length > 0) {
      const channels: Record<string, { id: string; name: string; isPrivate: boolean }> = {};

      // Fetch info for each channel (Slack doesn't have a bulk endpoint)
      await Promise.all(
        channelIds.map(async (channelId) => {
          try {
            const response = await fetch(
              `https://slack.com/api/conversations.info?channel=${channelId}`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${botToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            const data = await response.json();

            if (data.ok && data.channel) {
              channels[channelId] = {
                id: data.channel.id,
                name: data.channel.name,
                isPrivate: data.channel.is_private || false,
              };
            }
          } catch (error) {
            console.error(`Error fetching channel ${channelId}:`, error);
          }
        })
      );

      return NextResponse.json({ channels });
    }

    // Otherwise, list all channels the bot is in
    const response = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack API error:', data.error);
      return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
    }

    const channels = data.channels.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      isPrivate: channel.is_private || false,
    }));

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
