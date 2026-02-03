import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { requireAdmin, getOrganization } from '@/lib/auth/admin';
import { getSubscription } from '@/lib/stripe';
import { UpgradeButton } from '@/components/admin/upgrade-button';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;

  if (!session.organizationId) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold">Organization Billing</h1>
          <p className="text-muted-foreground mt-1">
            Subscription and payment settings
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">No Organization</h2>
              <p className="text-muted-foreground mb-4">
                Billing is managed at the organization level.
                Contact support to set up your organization.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const org = await getOrganization(session.organizationId);
  const subscription = org?.stripeSubscriptionId
    ? await getSubscription(org.stripeSubscriptionId)
    : null;

  // Get current period end from first subscription item (Stripe v20 API)
  const currentPeriodEnd = subscription?.items.data[0]?.current_period_end;

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    past_due: 'bg-yellow-100 text-yellow-700',
    canceled: 'bg-red-100 text-red-700',
    trialing: 'bg-blue-100 text-blue-700',
  };

  const needsUpgrade = !org?.stripeSubscriptionId || org?.subscriptionStatus === 'canceled';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">Organization Billing</h1>
        <p className="text-muted-foreground mt-1">
          Subscription and payment settings for {org?.name}
        </p>
      </div>

      {params.success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-green-800">
                Payment successful! Your subscription is now active.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {params.canceled && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-yellow-800">
                Payment was canceled. You can try again when ready.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="font-medium">{org?.planId || 'Free'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={statusColors[org?.subscriptionStatus || ''] || 'bg-gray-100 text-gray-700'}>
                {org?.subscriptionStatus || 'No subscription'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Seats</span>
              <span className="font-medium">{org?.seatCount || 1}</span>
            </div>
            {currentPeriodEnd && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Renews</span>
                <span className="font-medium">
                  {new Date(currentPeriodEnd * 1000).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage Subscription</CardTitle>
            <CardDescription>Update payment and subscription settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {needsUpgrade ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Upgrade to Pro to unlock all features and support development.
                  </p>
                </div>
                <UpgradeButton />
              </div>
            ) : (
              <form action="/api/stripe/portal" method="POST">
                <Button type="submit" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Customer Portal
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">How does per-seat pricing work?</p>
            <p>You pay for each active user in your workspace. Seats are prorated when added mid-cycle.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">How do I add more seats?</p>
            <p>Use the Customer Portal to update your subscription quantity, or new users are automatically added.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">How do I cancel?</p>
            <p>Use the Customer Portal to cancel your subscription. You&apos;ll have access until the end of your billing period.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
