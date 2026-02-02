import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ExternalLink, CheckCircle, XCircle, AlertTriangle, Building2, User } from 'lucide-react';
import { verifySession } from '@/lib/auth/dal';
import { checkUserAccess, getIndividualSubscription } from '@/lib/billing/access-check';
import { getSubscription } from '@/lib/stripe';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

const { workspaces, organizations } = schema;

export default async function IndividualBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const session = await verifySession();
  const params = await searchParams;

  // Check user access to determine source
  const access = await checkUserAccess(session.email, session.workspaceId);

  // Get individual subscription details
  const individualSub = session.email
    ? await getIndividualSubscription(session.email)
    : null;

  // Get org details for comparison
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, session.workspaceId),
  });

  const org = workspace?.organizationId
    ? await db.query.organizations.findFirst({
        where: eq(organizations.id, workspace.organizationId),
      })
    : null;

  // Get Stripe subscription details if individual sub exists
  const stripeSubscription = individualSub?.stripeSubscriptionId
    ? await getSubscription(individualSub.stripeSubscriptionId)
    : null;

  const currentPeriodEnd = stripeSubscription?.items.data[0]?.current_period_end;

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    past_due: 'bg-yellow-100 text-yellow-700',
    canceled: 'bg-red-100 text-red-700',
    trialing: 'bg-blue-100 text-blue-700',
    paused: 'bg-gray-100 text-gray-700',
  };

  // Check if user has both individual and org coverage (potential overlap)
  const hasOrgAccess = org && ['active', 'trialing', 'past_due'].includes(org.subscriptionStatus || '');
  const hasIndividualAccess = individualSub && ['active', 'trialing', 'past_due'].includes(individualSub.subscriptionStatus || '');
  const hasOverlap = hasOrgAccess && hasIndividualAccess;

  const needsSubscription = !individualSub || ['canceled', 'paused'].includes(individualSub.subscriptionStatus || '');

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal subscription
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

      {/* Overlap Warning */}
      {hasOverlap && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-amber-800 font-medium">
                  You have both individual and organization coverage
                </p>
                <p className="text-amber-700 text-sm mt-1">
                  Your organization ({org?.name}) already provides access to Speak for Me.
                  You may want to cancel your individual subscription to avoid paying twice.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Access Source Banner */}
      {access.hasAccess && (
        <Card className={access.source === 'individual' ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {access.source === 'individual' ? (
                <User className="h-5 w-5 text-blue-600" />
              ) : (
                <Building2 className="h-5 w-5 text-purple-600" />
              )}
              <p className={access.source === 'individual' ? 'text-blue-800' : 'text-purple-800'}>
                {access.source === 'individual'
                  ? 'Your access is through your personal subscription'
                  : `Your access is through your organization (${org?.name})`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Individual Subscription Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Subscription
            </CardTitle>
            <CardDescription>Your individual subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {individualSub ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="font-medium">{individualSub.planId || 'Individual'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={statusColors[individualSub.subscriptionStatus || ''] || 'bg-gray-100 text-gray-700'}>
                    {individualSub.subscriptionStatus || 'Unknown'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="font-medium text-sm">{individualSub.email}</span>
                </div>
                {currentPeriodEnd && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Renews</span>
                    <span className="font-medium">
                      {new Date(currentPeriodEnd * 1000).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No personal subscription active
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manage Subscription Card */}
        <Card>
          <CardHeader>
            <CardTitle>Manage Subscription</CardTitle>
            <CardDescription>
              {needsSubscription
                ? 'Subscribe to unlock all features'
                : 'Update payment and subscription settings'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {needsSubscription ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Get your own subscription for personal access across any workspace.
                  </p>
                </div>
                <Link href="/pricing" className="block">
                  <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Subscribe Now
                  </Button>
                </Link>
              </div>
            ) : (
              <form action="/api/stripe/user-portal" method="POST">
                <Button type="submit" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Customer Portal
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organization Access Info */}
      {org && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Access
            </CardTitle>
            <CardDescription>Access provided by your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Organization</span>
              <span className="font-medium">{org.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={statusColors[org.subscriptionStatus || ''] || 'bg-gray-100 text-gray-700'}>
                {org.subscriptionStatus || 'No subscription'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="font-medium">{org.planId || 'Free'}</span>
            </div>
            {hasOrgAccess && (
              <p className="text-sm text-muted-foreground pt-2 border-t">
                Your organization provides access to Speak for Me. You don&apos;t need a personal
                subscription while covered by your organization.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Billing FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Billing FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">What&apos;s the difference between individual and organization subscriptions?</p>
            <p>Individual subscriptions are tied to your email and work across any workspace. Organization subscriptions cover all members of a specific workspace.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">What happens if I have both?</p>
            <p>Your individual subscription takes priority. Consider canceling one to avoid double payment.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">How do I cancel?</p>
            <p>Use the Customer Portal to cancel. You&apos;ll keep access until the end of your billing period.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
