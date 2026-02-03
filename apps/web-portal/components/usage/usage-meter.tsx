'use client';

import { Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { CURRENCY, formatOverageRate } from '@/lib/billing/plans.config';

interface UsageMeterProps {
  used: number;
  limit: number;
  planName: string;
  overageRate: number; // cents
  billingPeriodEnd: string; // ISO date string
}

export function UsageMeter({
  used,
  limit,
  planName,
  overageRate,
  billingPeriodEnd,
}: UsageMeterProps) {
  const percentUsed = limit > 0 ? (used / limit) * 100 : 0;
  const overage = Math.max(0, used - limit);
  const overageCost = overage * (overageRate / 100);

  // Calculate days remaining
  const endDate = new Date(billingPeriodEnd);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Determine color based on usage percentage
  const getProgressColor = () => {
    if (percentUsed >= 95) return 'bg-red-500';
    if (percentUsed >= 80) return 'bg-yellow-500';
    return 'bg-indigo-500';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-indigo-600" />
          <span className="font-medium text-gray-900">AI Suggestions</span>
        </div>
        <div className="text-sm font-semibold text-gray-900">
          {used.toLocaleString()} / {limit.toLocaleString()} used
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress
          value={Math.min(percentUsed, 100)}
          className="h-3"
          indicatorClassName={getProgressColor()}
        />
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{planName} Plan</span>
          <span>{daysRemaining} days remaining</span>
        </div>
      </div>

      {/* Overage information */}
      {overage > 0 && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
          <p className="text-sm text-orange-900">
            <strong>Overage:</strong> {overage} extra suggestion{overage !== 1 ? 's' : ''}
            {overageRate > 0 && (
              <> (est. {CURRENCY.symbol}{overageCost.toFixed(2)})</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
