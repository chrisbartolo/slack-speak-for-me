'use client';

import { useState, useTransition } from 'react';
import { Trash2, Hash, Lock, MessageSquare, FileText, Zap, ZapOff, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { unwatchConversation, toggleAutoRespond, saveConversationContext } from '@/app/dashboard/conversations/actions';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ConversationContext {
  id: string;
  channelId: string;
  contextText: string;
}

interface Conversation {
  id: string;
  channelId: string;
  channelName?: string | null;
  channelType?: string | null;
  autoRespond?: boolean | null;
  watchedAt: Date | null;
}

interface ConversationListProps {
  conversations: Conversation[];
  contexts: ConversationContext[];
}

export function ConversationList({ conversations, contexts }: ConversationListProps) {
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingContext, setEditingContext] = useState<string | null>(null);
  const [contextText, setContextText] = useState('');
  const [savingContext, setSavingContext] = useState(false);

  // Create a map of channel contexts for quick lookup
  const contextMap = new Map(contexts.map(c => [c.channelId, c]));

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

  const handleToggleAutoRespond = async (conversation: Conversation) => {
    setTogglingId(conversation.id);
    const newValue = !conversation.autoRespond;

    startTransition(async () => {
      const result = await toggleAutoRespond(conversation.id, newValue);

      if (result.success) {
        toast.success(newValue ? 'YOLO mode enabled' : 'YOLO mode disabled', {
          description: newValue
            ? 'AI will now auto-respond on your behalf in this conversation.'
            : 'AI will offer suggestions instead of auto-responding.',
        });
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to update setting',
        });
      }
      setTogglingId(null);
    });
  };

  const handleOpenContextDialog = (conversation: Conversation) => {
    const existing = contextMap.get(conversation.channelId);
    setContextText(existing?.contextText || '');
    setEditingContext(conversation.channelId);
  };

  const handleSaveContext = async (conversation: Conversation) => {
    setSavingContext(true);
    const result = await saveConversationContext(
      conversation.channelId,
      conversation.channelName || null,
      conversation.channelType || null,
      contextText
    );

    if (result.success) {
      toast.success('Context saved', {
        description: 'AI will use this context when generating suggestions.',
      });
      setEditingContext(null);
    } else {
      toast.error('Error', {
        description: result.error || 'Failed to save context',
      });
    }
    setSavingContext(false);
  };

  // Helper to determine channel icon based on type
  const getChannelIcon = (channelType?: string | null) => {
    const isDM = channelType === 'im' || channelType === 'mpim';
    const isPrivate = channelType === 'group';

    if (isDM) {
      return <MessageSquare className="h-5 w-5 text-muted-foreground" />;
    } else if (isPrivate) {
      return <Lock className="h-5 w-5 text-muted-foreground" />;
    } else {
      return <Hash className="h-5 w-5 text-muted-foreground" />;
    }
  };

  // Helper to format display name
  const getDisplayName = (conversation: Conversation) => {
    if (conversation.channelName) {
      const isDM = conversation.channelType === 'im' || conversation.channelType === 'mpim';
      return isDM ? conversation.channelName : `#${conversation.channelName}`;
    }
    return conversation.channelId;
  };

  // Helper to get channel type label
  const getTypeLabel = (channelType?: string | null) => {
    switch (channelType) {
      case 'im': return 'Direct Message';
      case 'mpim': return 'Group DM';
      case 'group': return 'Private Channel';
      default: return 'Channel';
    }
  };

  return (
    <div className="space-y-4">
      {conversations.map((conversation) => {
        const hasContext = contextMap.has(conversation.channelId);

        return (
          <Card key={conversation.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-muted rounded-lg shrink-0">
                    {getChannelIcon(conversation.channelType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">
                        {getDisplayName(conversation)}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getTypeLabel(conversation.channelType)}
                      </Badge>
                      {hasContext && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <FileText className="h-3 w-3 mr-1" />
                          Has Context
                        </Badge>
                      )}
                      {conversation.autoRespond && (
                        <Badge className="text-xs bg-amber-500 hover:bg-amber-600 shrink-0">
                          <Zap className="h-3 w-3 mr-1" />
                          YOLO
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {conversation.watchedAt
                        ? `Added ${formatDistanceToNow(conversation.watchedAt, { addSuffix: true })}`
                        : 'Recently added'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* YOLO Mode Toggle */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`yolo-${conversation.id}`} className="text-xs text-muted-foreground cursor-pointer">
                      {conversation.autoRespond ? <Zap className="h-4 w-4 text-amber-500" /> : <ZapOff className="h-4 w-4" />}
                    </Label>
                    <Switch
                      id={`yolo-${conversation.id}`}
                      checked={conversation.autoRespond || false}
                      onCheckedChange={() => handleToggleAutoRespond(conversation)}
                      disabled={isPending && togglingId === conversation.id}
                    />
                  </div>

                  {/* Add/Edit Context Button */}
                  <Dialog open={editingContext === conversation.channelId} onOpenChange={(open) => !open && setEditingContext(null)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenContextDialog(conversation)}
                      >
                        {hasContext ? (
                          <>
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit Context
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-1" />
                            Add Context
                          </>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Context for {getDisplayName(conversation)}
                        </DialogTitle>
                        <DialogDescription>
                          Add context to help AI generate better suggestions for this conversation.
                          This could include the purpose of the channel, typical discussions, or how you prefer to communicate here.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Textarea
                          value={contextText}
                          onChange={(e) => setContextText(e.target.value)}
                          placeholder="e.g., This is the engineering team channel. We discuss technical issues and prefer detailed, specific responses. Keep it professional but friendly."
                          rows={5}
                          maxLength={2000}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          {contextText.length}/2000 characters
                        </p>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingContext(null)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleSaveContext(conversation)}
                          disabled={savingContext || !contextText.trim()}
                        >
                          {savingContext ? 'Saving...' : 'Save Context'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Remove Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending && removingId === conversation.id}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
