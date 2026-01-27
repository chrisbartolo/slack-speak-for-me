'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface FeedbackCardProps {
  feedback: {
    id: string;
    originalText: string;
    modifiedText: string;
    refinementType: string | null;
    createdAt: Date | null;
  };
}

const refinementTypeLabels: Record<string, { label: string; color: string }> = {
  shortening: { label: 'Shortened', color: 'bg-blue-100 text-blue-800' },
  expanding: { label: 'Expanded', color: 'bg-green-100 text-green-800' },
  tone_shift: { label: 'Tone Change', color: 'bg-purple-100 text-purple-800' },
  restructuring: { label: 'Restructured', color: 'bg-orange-100 text-orange-800' },
  minor_edit: { label: 'Minor Edit', color: 'bg-gray-100 text-gray-800' },
};

export function FeedbackCard({ feedback }: FeedbackCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const typeInfo = feedback.refinementType
    ? refinementTypeLabels[feedback.refinementType] || { label: feedback.refinementType, color: 'bg-gray-100 text-gray-800' }
    : { label: 'Modified', color: 'bg-gray-100 text-gray-800' };

  // Calculate change summary
  const originalWords = feedback.originalText.split(/\s+/).length;
  const modifiedWords = feedback.modifiedText.split(/\s+/).length;
  const wordDiff = modifiedWords - originalWords;
  const percentChange = Math.round((Math.abs(wordDiff) / originalWords) * 100);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              {feedback.createdAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(feedback.createdAt, { addSuffix: true })}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {wordDiff === 0
                ? 'Same length, different wording'
                : wordDiff > 0
                ? `Added ${wordDiff} words (+${percentChange}%)`
                : `Removed ${Math.abs(wordDiff)} words (-${percentChange}%)`}
            </p>
          </div>

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
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Original suggestion</p>
              <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                {feedback.originalText}
              </p>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Your refined version</p>
              <p className="text-sm bg-green-50 dark:bg-green-950 p-3 rounded-md whitespace-pre-wrap">
                {feedback.modifiedText}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
