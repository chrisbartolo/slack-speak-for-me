'use client';

import Link from 'next/link';
import { AlertTriangle, XCircle, TrendingUp } from 'lucide-react';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface UsageAlertProps {
  warningLevel: 'safe' | 'warning' | 'critical' | 'exceeded';
  used: number;
  limit: number;
  planId: string;
  daysRemaining: number;
}

export function UsageAlert({
  warningLevel,
  used,
  limit,
  planId,
  daysRemaining,
}: UsageAlertProps) {
  // No alert for safe usage
  if (warningLevel === 'safe') {
    return null;
  }

  const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const remaining = Math.max(0, limit - used);

  // Warning level (80-95%)
  if (warningLevel === 'warning') {
    return (
      <Alert variant="default" className="border-blue-200 bg-blue-50">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900">Usage Warning</AlertTitle>
        <AlertDescription className="text-blue-800">
          You've used {percentUsed}% of your monthly suggestions. Your allowance resets in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.
        </AlertDescription>
      </Alert>
    );
  }

  // Critical level (95-100%)
  if (warningLevel === 'critical') {
    return (
      <Alert variant="default" className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-900">Critical: Low on Suggestions</AlertTitle>
        <AlertDescription className="text-yellow-800">
          Only {remaining} suggestion{remaining !== 1 ? 's' : ''} remaining this month! Consider upgrading to avoid interruptions.
        </AlertDescription>
      </Alert>
    );
  }

  // Exceeded limit (100%+)
  if (warningLevel === 'exceeded') {
    const isFree = planId === 'free';

    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>
          {isFree ? 'Monthly Limit Reached' : 'Usage Limit Exceeded'}
        </AlertTitle>
        <AlertDescription className="space-y-3">
          {isFree ? (
            <>
              <p>
                You've reached your monthly limit of {limit} suggestions. Upgrade to continue using AI suggestions.
              </p>
              <Link href="/pricing">
                <Button size="sm" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Upgrade Now
                </Button>
              </Link>
            </>
          ) : (
            <p>
              You've exceeded your included suggestions. Additional usage will be billed at the overage rate shown below.
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
