import {
  getStylePreferences,
  getMessageCount,
  getWatchedConversationCount,
  getRefinementCount,
  getPersonContextCount,
  getSuggestionFeedbackStats,
} from '@/lib/db/queries';
import { StatCard } from '@/components/dashboard/stat-card';
import { LearningSummary } from '@/components/dashboard/learning-summary';
import { GettingStarted } from '@/components/dashboard/getting-started';
import { AccountSetup } from '@/components/dashboard/account-setup';
import { MessageSquare, Eye, Edit3, Sliders } from 'lucide-react';
import { HelpLink } from '@/components/help/help-link';
import { verifySession } from '@/lib/auth/dal';
import { isAdmin } from '@/lib/auth/admin';
import { checkUserAccess } from '@/lib/billing/access-check';

export default async function DashboardPage() {
  const session = await verifySession();

  // Fetch data in parallel
  const [stylePrefs, messageCount, conversationCount, refinementCount, personContextCount, feedbackStats, adminStatus, access] = await Promise.all([
    getStylePreferences(),
    getMessageCount(),
    getWatchedConversationCount(),
    getRefinementCount(),
    getPersonContextCount(),
    getSuggestionFeedbackStats(),
    isAdmin(),
    checkUserAccess(session.email, session.workspaceId),
  ]);

  // Calculate onboarding progress
  const hasWatchedConversations = conversationCount > 0;
  const hasStylePreferences = !!(stylePrefs?.tone || stylePrefs?.formality);
  const hasPersonContext = personContextCount > 0;
  const hasFeedback = feedbackStats.length > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <HelpLink href="/docs/getting-started" label="Getting started guide" />
        </div>
        <p className="text-muted-foreground">
          Your AI learning progress and activity overview
        </p>
      </div>

      {/* Account Setup (prerequisite onboarding) */}
      <AccountSetup
        hasEmail={!!session.email}
        hasActiveSubscription={access.hasAccess}
        isAdmin={adminStatus}
        subscriptionSource={access.hasAccess ? access.source : null}
      />

      {/* Getting Started Guide */}
      <GettingStarted
        hasWatchedConversations={hasWatchedConversations}
        hasStylePreferences={hasStylePreferences}
        hasPersonContext={hasPersonContext}
        hasFeedback={hasFeedback}
      />

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
