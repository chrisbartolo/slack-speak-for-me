import {
  getStylePreferences,
  getMessageCount,
  getWatchedConversationCount,
  getRefinementCount,
} from '@/lib/db/queries';
import { StatCard } from '@/components/dashboard/stat-card';
import { LearningSummary } from '@/components/dashboard/learning-summary';
import { MessageSquare, Eye, Edit3, Sliders } from 'lucide-react';

export default async function DashboardPage() {
  // Fetch data in parallel
  const [stylePrefs, messageCount, conversationCount, refinementCount] = await Promise.all([
    getStylePreferences(),
    getMessageCount(),
    getWatchedConversationCount(),
    getRefinementCount(),
  ]);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Your AI learning progress and activity overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Messages Analyzed"
          value={messageCount}
          description="Used for learning your style"
          icon={MessageSquare}
        />
        <StatCard
          title="Watched Conversations"
          value={conversationCount}
          description="Active monitoring"
          icon={Eye}
        />
        <StatCard
          title="Refinements"
          value={refinementCount}
          description="Feedback provided"
          icon={Edit3}
        />
        <StatCard
          title="Style Preferences"
          value={stylePrefs ? 'Configured' : 'Not Set'}
          description={stylePrefs?.tone || stylePrefs?.formality ? `${stylePrefs.tone || 'Any'} tone` : 'Configure your style'}
          icon={Sliders}
        />
      </div>

      {/* Learning Summary */}
      <LearningSummary
        messageCount={messageCount}
        refinementCount={refinementCount}
        tone={stylePrefs?.tone}
        formality={stylePrefs?.formality}
      />
    </div>
  );
}
