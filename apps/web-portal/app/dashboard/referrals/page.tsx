import { verifySession } from '@/lib/auth/dal';
import { getReferralDashboard } from '@/lib/billing/referrals';
import { ReferralDashboard } from '@/components/billing/referral-dashboard';
import { db, users } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

async function getUserEmail(workspaceId: string, slackUserId: string): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        eq(users.workspaceId, workspaceId),
        eq(users.slackUserId, slackUserId)
      )
    )
    .limit(1);
  return user?.email || null;
}

export default async function ReferralsPage() {
  const session = await verifySession();

  // Try session email first, then fetch from database
  let email: string | null = session.email || null;
  if (!email && session.workspaceId && session.userId) {
    email = await getUserEmail(session.workspaceId, session.userId);
  }

  if (!email) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold">Referrals</h1>
          <p className="text-muted-foreground mt-1">
            Invite friends and earn rewards
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5" />
              Email Required
            </CardTitle>
            <CardDescription className="text-amber-700">
              We need your email to track referrals and credit rewards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-amber-700">
              Your Slack account doesn&apos;t have an email address linked. This can happen if:
            </p>
            <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
              <li>You signed in before we added email support</li>
              <li>Your Slack workspace doesn&apos;t share email addresses</li>
            </ul>
            <div className="flex gap-3">
              <Link href="/login?reauth=true">
                <Button variant="outline" className="border-amber-300 hover:bg-amber-100">
                  Re-authenticate with Slack
                </Button>
              </Link>
              <Link href="/dashboard/settings">
                <Button variant="ghost">
                  Update in Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const referralData = await getReferralDashboard(email);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">Referrals</h1>
        <p className="text-muted-foreground mt-1">
          Invite friends and earn rewards
        </p>
      </div>

      <ReferralDashboard data={referralData} />
    </div>
  );
}
