'use client';

import { useState, useTransition } from 'react';
import { Trash2, Hash } from 'lucide-react';
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
import { unwatchConversation } from '@/app/(dashboard)/conversations/actions';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  channelId: string;
  watchedAt: Date | null;
}

interface ConversationListProps {
  conversations: Conversation[];
}

export function ConversationList({ conversations }: ConversationListProps) {
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

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
                <Hash className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{conversation.channelId}</p>
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
