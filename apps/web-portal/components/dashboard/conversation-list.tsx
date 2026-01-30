'use client';

import { useState, useTransition, useEffect } from 'react';
import { Trash2, Hash, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { unwatchConversation } from '@/app/dashboard/conversations/actions';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  channelId: string;
  watchedAt: Date | null;
}

interface ChannelInfo {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface ConversationListProps {
  conversations: Conversation[];
}

export function ConversationList({ conversations }: ConversationListProps) {
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [channelNames, setChannelNames] = useState<Record<string, ChannelInfo>>({});
  const [loadingChannels, setLoadingChannels] = useState(true);

  useEffect(() => {
    async function fetchChannelNames() {
      if (conversations.length === 0) {
        setLoadingChannels(false);
        return;
      }

      try {
        const channelIds = conversations.map((c) => c.channelId).join(',');
        const response = await fetch(`/api/slack/channels?ids=${channelIds}`);
        const data = await response.json();

        if (data.channels) {
          setChannelNames(data.channels);
        }
      } catch (error) {
        console.error('Failed to fetch channel names:', error);
      } finally {
        setLoadingChannels(false);
      }
    }

    fetchChannelNames();
  }, [conversations]);

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    startTransition(async () => {
      const result = await unwatchConversation(id);

      if (result.success) {
        toast.success('Channel removed', {
          description: 'You will no longer receive suggestions for this channel.',
        });
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to remove channel',
        });
      }
      setRemovingId(null);
    });
  };

  return (
    <div className="space-y-4">
      {conversations.map((conversation) => (
        <Card key={conversation.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                {channelNames[conversation.channelId]?.isPrivate ? (
                  <Lock className="h-5 w-5 text-gray-600" />
                ) : (
                  <Hash className="h-5 w-5 text-gray-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {loadingChannels ? (
                    <span className="text-gray-400">Loading...</span>
                  ) : channelNames[conversation.channelId]?.name ? (
                    `#${channelNames[conversation.channelId].name}`
                  ) : (
                    conversation.channelId
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {conversation.watchedAt
                    ? `Added ${formatDistanceToNow(conversation.watchedAt, { addSuffix: true })}`
                    : 'Recently added'}
                </p>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending && removingId === conversation.id}
                >
                  <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove channel?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will no longer receive AI suggestions for messages in this channel.
                    You can add it back anytime using /watch in Slack.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleRemove(conversation.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
