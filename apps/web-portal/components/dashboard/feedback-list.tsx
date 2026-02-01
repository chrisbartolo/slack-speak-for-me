'use client';

import { Check, RefreshCw, X, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface FeedbackItem {
  id: string;
  action?: string; // 'accepted' | 'refined' | 'dismissed'
  suggestionId?: string;
  originalText?: string | null;
  finalText?: string | null;
  modifiedText?: string | null; // For backward compatibility with refinementFeedback
  refinementType?: string | null;
  createdAt: Date | null;
}

interface FeedbackListProps {
  feedbackItems: FeedbackItem[];
}

function ActionBadge({ action }: { action: string }) {
  const badges: Record<string, { label: string; className: string; icon: LucideIcon }> = {
    accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700', icon: Check },
    refined: { label: 'Refined', className: 'bg-blue-100 text-blue-700', icon: RefreshCw },
    dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-600', icon: X },
  };

  const badge = badges[action] || badges.refined;
  const Icon = badge.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
      <Icon className="h-3 w-3" />
      {badge.label}
    </span>
  );
}

function FeedbackItemCard({ item }: { item: FeedbackItem }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const originalText = item.originalText || '';
  const finalText = item.finalText || item.modifiedText || '';
  const hasChanges = item.action === 'refined' && finalText && finalText !== originalText;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {item.action && <ActionBadge action={item.action} />}
              {item.createdAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">
              {originalText || 'N/A'}
            </p>
          </div>

          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {isExpanded && hasChanges && (
          <div className="mt-4 pt-4 border-t space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Original suggestion</p>
              <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                {originalText}
              </p>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Refined version</p>
              <p className="text-sm bg-green-50 dark:bg-green-950 p-3 rounded-md whitespace-pre-wrap">
                {finalText}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FeedbackList({ feedbackItems }: FeedbackListProps) {
  return (
    <div className="space-y-4">
      {feedbackItems.map((item) => (
        <FeedbackItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
