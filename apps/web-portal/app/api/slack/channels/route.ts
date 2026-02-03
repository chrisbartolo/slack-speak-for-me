import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { installations, workspaces, watchedConversations } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
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
    const refresh = searchParams.get('refresh') === 'true';

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
      const channels: Record<string, { id: string; name: string; type: string; isPrivate: boolean }> = {};

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

            // Log errors for debugging (e.g., missing scopes)
            if (!data.ok) {
              console.error(`Slack API error for channel ${channelId}:`, data.error);
              // Still add entry with channel ID as fallback name
              channels[channelId] = {
                id: channelId,
                name: channelId.startsWith('D') ? 'DM' : channelId,
                type: channelId.startsWith('D') ? 'im' : 'channel',
                isPrivate: channelId.startsWith('D') || channelId.startsWith('G'),
              };
              return;
            }

            if (data.ok && data.channel) {
              const channel = data.channel;
              let name = channel.name;
              let type = 'channel';

              // Handle DMs - fetch user info for display name
              if (channel.is_im && channel.user) {
                type = 'im';
                try {
                  const userResponse = await fetch(
                    `https://slack.com/api/users.info?user=${channel.user}`,
                    {
                      method: 'GET',
                      headers: {
                        Authorization: `Bearer ${botToken}`,
                        'Content-Type': 'application/json',
                      },
                    }
                  );
                  const userData = await userResponse.json();
                  if (userData.ok && userData.user) {
                    // display_name can be empty string, so check for truthy non-empty values
                    const profile = userData.user.profile;
                    name = (profile?.display_name && profile.display_name.trim()) ||
                           (profile?.real_name && profile.real_name.trim()) ||
                           userData.user.name ||
                           channel.user;
                  }
                } catch (userError) {
                  console.error(`Error fetching user ${channel.user}:`, userError);
                }
              } else if (channel.is_mpim) {
                type = 'mpim';
                // For group DMs, use the purpose or name
                name = channel.purpose?.value || channel.name || 'Group DM';
              } else if (channel.is_group || channel.is_private) {
                type = 'group';
              }

              channels[channelId] = {
                id: channel.id,
                name: name,
                type: type,
                isPrivate: channel.is_private || channel.is_im || channel.is_mpim || false,
              };
            }
          } catch (error) {
            console.error(`Error fetching channel ${channelId}:`, error);
          }
        })
      );

      // If refresh=true, update channel names in watchedConversations table
      // This backfills legacy data that was added before channel caching
      if (refresh && Object.keys(channels).length > 0) {
        await Promise.all(
          Object.entries(channels).map(async ([channelId, info]) => {
            try {
              await db
                .update(watchedConversations)
                .set({
                  channelName: info.name,
                  channelType: info.type,
                })
                .where(
                  and(
                    eq(watchedConversations.channelId, channelId),
                    eq(watchedConversations.workspaceId, session.workspaceId)
                  )
                );
            } catch (error) {
              console.error(`Error updating channel ${channelId} in database:`, error);
            }
          })
        );
      }

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
