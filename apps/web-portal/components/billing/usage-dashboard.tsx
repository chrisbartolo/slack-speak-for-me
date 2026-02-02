'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Zap, TrendingUp } from 'lucide-react';
import { formatPrice, formatOverageRate } from '@/lib/billing/plans.config';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface UsageStatus {
  used: number;
  included: number;
  remaining: number;
  percentUsed: number;
  isOverLimit: boolean;
  isWarning: boolean;
  isCritical: boolean;
  overage: number;
}

interface UsageDashboardProps {
  usage: UsageStatus | null;
  planName: string;
  overageRate: number; // cents
}

export function UsageDashboard({ usage, planName, overageRate }: UsageDashboardProps) {
  if (!usage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Usage
          </CardTitle>
          <CardDescription>No subscription active</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Subscribe to start using AI suggestions.
          </p>
          <Link href="/pricing">
            <Button>View Plans</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const percentDisplay = Math.min(100, Math.round(usage.percentUsed * 100));

  return (
    <Card className={usage.isCritical ? 'border-red-200' : usage.isWarning ? 'border-yellow-200' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Usage This Month
            </CardTitle>
            <CardDescription>{planName} Plan</CardDescription>
          </div>
          {usage.isCritical && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Limit Reached
            </Badge>
          )}
          {usage.isWarning && !usage.isCritical && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
              <AlertTriangle className="h-3 w-3 mr-1" />
              80% Used
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">AI Suggestions</span>
            <span className="font-medium">
              {usage.used} / {usage.included}
            </span>
          </div>
          <Progress
            value={percentDisplay}
            className={
              usage.isCritical
                ? '[&>div]:bg-red-500'
                : usage.isWarning
                ? '[&>div]:bg-yellow-500'
                : ''
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{percentDisplay}% used</span>
            <span>{usage.remaining} remaining</span>
          </div>
        </div>

        {/* Overage info */}
        {usage.overage > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">Overage: {usage.overage} suggestions</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              Additional usage billed at {formatOverageRate(overageRate)} each
            </p>
            <p className="text-sm font-medium text-red-700 mt-1">
              Estimated overage charge: {formatPrice(usage.overage * overageRate)}
            </p>
          </div>
        )}

        {/* Warning message */}
        {usage.isWarning && !usage.isCritical && !usage.overage && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700">
              You&apos;ve used 80% of your monthly allowance. Consider upgrading to avoid overage charges.
            </p>
            <Link href="/pricing" className="text-sm text-yellow-800 underline mt-1 inline-block">
              View upgrade options
            </Link>
          </div>
        )}

        {/* Hard limit message */}
        {usage.isOverLimit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">
              Monthly limit reached. Additional suggestions will be billed at {formatOverageRate(overageRate)} each.
            </p>
            <Link href="/pricing" className="text-sm text-red-800 underline mt-1 inline-block">
              Upgrade for more suggestions
            </Link>
          </div>
        )}

        {/* Overage rate info */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Overage rate: {formatOverageRate(overageRate)}/suggestion beyond included allowance
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact usage indicator for sidebar/header
 */
export function UsageIndicator({ usage }: { usage: UsageStatus | null }) {
  if (!usage) return null;

  const percentDisplay = Math.min(100, Math.round(usage.percentUsed * 100));

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16">
        <div
          className={`h-full rounded-full transition-all ${
            usage.isCritical
              ? 'bg-red-500'
              : usage.isWarning
              ? 'bg-yellow-500'
              : 'bg-primary'
          }`}
          style={{ width: `${percentDisplay}%` }}
        />
      </div>
      <span className={`${usage.isCritical ? 'text-red-600' : usage.isWarning ? 'text-yellow-600' : 'text-muted-foreground'}`}>
        {usage.remaining} left
      </span>
    </div>
  );
}
