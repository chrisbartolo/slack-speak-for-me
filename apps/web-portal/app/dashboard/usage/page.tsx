import { verifySession } from '@/lib/auth/dal';
import { getCurrentUsage, getUsageHistory } from '@/lib/billing/usage-queries';
import { getPlanById, USAGE_THRESHOLDS, CURRENCY, formatOverageRate } from '@/lib/billing/plans.config';
import { checkUserAccess } from '@/lib/billing/access-check';
import { UsageMeter } from '@/components/usage/usage-meter';
import { UsageAlert } from '@/components/usage/usage-alert';
import { HelpLink } from '@/components/help/help-link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'Usage',
};

export default async function UsagePage() {
  const session = await verifySession();
  const access = await checkUserAccess(session.email, session.workspaceId);
  const usage = session.email ? await getCurrentUsage(session.email) : null;
  const history = session.email ? await getUsageHistory(session.email, 6) : [];

  // Determine plan info
  const planId = access.hasAccess ? (access.planId || 'free') : 'free';
  const plan = getPlanById(planId);

  // Compute usage values (default to free tier if no record)
  const used = usage?.suggestionsUsed ?? 0;
  const limit = usage?.suggestionsIncluded ?? (plan?.includedSuggestions ?? 5);
  const percentUsed = limit > 0 ? (used / limit) * 100 : 0;
  const billingPeriodEnd = usage?.billingPeriodEnd ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  const billingPeriodStart = usage?.billingPeriodStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const daysRemaining = Math.max(0, Math.ceil((new Date(billingPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  // Compute warning level
  let warningLevel: 'safe' | 'warning' | 'critical' | 'exceeded' = 'safe';
  if (percentUsed >= 100) warningLevel = 'exceeded';
  else if (percentUsed >= USAGE_THRESHOLDS.CRITICAL * 100) warningLevel = 'critical';
  else if (percentUsed >= USAGE_THRESHOLDS.WARNING * 100) warningLevel = 'warning';

  // Format dates for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const formatMonth = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Usage</h1>
          <HelpLink href="/docs/admin/billing" label="Learn about usage and billing" />
        </div>
        <p className="text-gray-600 mt-2">
          Track your AI suggestion usage for the current billing period
        </p>
      </div>

      {/* Usage alert */}
      <UsageAlert
        warningLevel={warningLevel}
        used={used}
        limit={limit}
        planId={planId}
        daysRemaining={daysRemaining}
      />

      {/* Usage meter card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Usage</CardTitle>
          <CardDescription>
            Your usage for this billing period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsageMeter
            used={used}
            limit={limit}
            planName={plan?.name ?? 'Free'}
            overageRate={plan?.overageRate ?? 0}
            billingPeriodEnd={billingPeriodEnd.toISOString()}
          />
        </CardContent>
      </Card>

      {/* Billing period card */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Period</CardTitle>
          <CardDescription>
            Your current billing cycle information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Start Date</span>
              <span className="text-sm font-medium text-gray-900">
                {formatDate(billingPeriodStart)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">End Date</span>
              <span className="text-sm font-medium text-gray-900">
                {formatDate(billingPeriodEnd)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Days Remaining</span>
              <span className="text-sm font-medium text-gray-900">
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Plan</span>
              <span className="text-sm font-medium text-gray-900">
                {plan?.name ?? 'Free'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage history card */}
      <Card>
        <CardHeader>
          <CardTitle>Usage History</CardTitle>
          <CardDescription>
            Your usage for the past 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No usage history yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Month</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Used</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Included</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Overage</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => {
                    const overage = Math.max(0, record.suggestionsUsed - record.suggestionsIncluded);
                    return (
                      <tr key={record.billingPeriodStart.toISOString()} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-gray-900">
                          {formatMonth(record.billingPeriodStart)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900">
                          {record.suggestionsUsed.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {record.suggestionsIncluded.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900">
                          {overage > 0 ? (
                            <span className="text-orange-600 font-medium">
                              +{overage.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
