import { Sparkles, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FeedbackList } from '@/components/dashboard/feedback-list';
import { EmptyState } from '@/components/dashboard/empty-state';
import { StatCard } from '@/components/dashboard/stat-card';
import { getRefinementFeedback, getFeedbackStats, getMessageCount } from '@/lib/db/queries';

const refinementTypeLabels: Record<string, string> = {
  shortening: 'Shortened',
  expanding: 'Expanded',
  tone_shift: 'Tone Changes',
  restructuring: 'Restructured',
  minor_edit: 'Minor Edits',
};

export default async function FeedbackPage() {
  const [feedbackItems, feedbackStats, messageCount] = await Promise.all([
    getRefinementFeedback(),
    getFeedbackStats(),
    getMessageCount(),
  ]);

  // Calculate total refinements
  const totalRefinements = feedbackStats.reduce((sum, stat) => sum + (stat.count || 0), 0);

  // Find most common refinement type
  const mostCommon = feedbackStats.reduce(
    (max, stat) => (stat.count > (max?.count || 0) ? stat : max),
    feedbackStats[0]
  );

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Learning</h1>
        <p className="text-muted-foreground mt-1">
          See how AI has learned from your feedback and message history
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Messages Analyzed"
          value={messageCount}
          description="For style learning"
          icon={Sparkles}
        />
        <StatCard
          title="Refinements Made"
          value={totalRefinements}
          description="Feedback provided"
          icon={TrendingUp}
        />
        <StatCard
          title="Common Pattern"
          value={mostCommon ? refinementTypeLabels[mostCommon.refinementType ?? ''] || 'None' : 'None'}
          description={mostCommon ? `${mostCommon.count} occurrences` : 'Start refining suggestions'}
          icon={Sparkles}
        />
      </div>

      {feedbackStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Refinement Patterns</CardTitle>
            <CardDescription>
              How you typically modify AI suggestions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedbackStats.map((stat) => {
                const percentage = Math.round((stat.count / totalRefinements) * 100);
                const label = refinementTypeLabels[stat.refinementType ?? ''] || stat.refinementType;

                return (
                  <div key={stat.refinementType} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-muted-foreground">{label}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-12 text-sm text-muted-foreground text-right">{percentage}%</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Refinements</CardTitle>
          <CardDescription>
            {feedbackItems.length === 0
              ? 'No refinements yet'
              : `${feedbackItems.length} refinements recorded`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackItems.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No refinements yet"
              description="When you refine AI suggestions in Slack, they'll appear here. This helps AI learn your preferences."
            />
          ) : (
            <FeedbackList feedbackItems={feedbackItems} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How AI learns from you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              1
            </div>
            <p>
              <strong className="text-foreground">Message history analysis:</strong>{' '}
              AI analyzes {messageCount} of your messages to understand your vocabulary, phrasing patterns, and communication style.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              2
            </div>
            <p>
              <strong className="text-foreground">Explicit preferences:</strong>{' '}
              Your style settings (tone, formality, phrases) are applied to every suggestion.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              3
            </div>
            <p>
              <strong className="text-foreground">Refinement feedback:</strong>{' '}
              When you refine suggestions, AI learns what changes you prefer (shown above).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
