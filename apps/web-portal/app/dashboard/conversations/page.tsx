import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConversationList } from '@/components/dashboard/conversation-list';
import { EmptyState } from '@/components/dashboard/empty-state';
import { HelpLink } from '@/components/help/help-link';
import { getWatchedConversations, getConversationContexts } from '@/lib/db/queries';

export default async function ConversationsPage() {
  const [conversations, contexts] = await Promise.all([
    getWatchedConversations(),
    getConversationContexts(),
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Conversations</h1>
          <HelpLink href="/docs/features/watching" label="Learn about watching conversations" />
        </div>
        <p className="text-muted-foreground mt-1">
          Channels where you receive AI response suggestions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Watched Channels</CardTitle>
          <CardDescription>
            {conversations.length === 0
              ? 'No channels are being monitored'
              : `${conversations.length} channel${conversations.length === 1 ? '' : 's'} being monitored`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No watched channels"
              description="Use /watch in any Slack channel to start receiving AI suggestions when you're mentioned or replied to."
            />
          ) : (
            <ConversationList conversations={conversations} contexts={contexts} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              1
            </div>
            <p>
              Use <code className="px-1 py-0.5 bg-muted rounded">/watch</code> in a Slack channel to start monitoring
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              2
            </div>
            <p>
              When someone mentions you or replies to your message, you will receive an AI-generated response suggestion
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              3
            </div>
            <p>
              The suggestion appears as a private message only you can see
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              4
            </div>
            <p>
              Copy, refine, or dismiss the suggestion as needed
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-medium">
              *
            </div>
            <p>
              <strong className="text-foreground">YOLO Mode:</strong> Enable auto-respond to let AI reply on your behalf automatically
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
