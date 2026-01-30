import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConversationList } from '@/components/dashboard/conversation-list';
import { EmptyState } from '@/components/dashboard/empty-state';
import { getWatchedConversations } from '@/lib/db/queries';

export default async function ConversationsPage() {
  const conversations = await getWatchedConversations();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
        <p className="text-gray-600 mt-1">
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
            <ConversationList conversations={conversations} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              1
            </div>
            <p>
              Use <code className="px-1 py-0.5 bg-gray-100 rounded">/watch</code> in a Slack channel to start monitoring
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              2
            </div>
            <p>
              When someone mentions you or replies to your message, you will receive an AI-generated response suggestion
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              3
            </div>
            <p>
              The suggestion appears as a private message only you can see
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              4
            </div>
            <p>
              Copy, refine, or dismiss the suggestion as needed
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
