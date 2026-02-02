import { verifySession } from '@/lib/auth/dal';
import { getReferralDashboard } from '@/lib/billing/referrals';
import { ReferralDashboard } from '@/components/billing/referral-dashboard';

export default async function ReferralsPage() {
  const session = await verifySession();

  if (!session.email) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold">Referrals</h1>
          <p className="text-muted-foreground mt-1">
            Email required to access referral program
          </p>
        </div>
      </div>
    );
  }

  const referralData = await getReferralDashboard(session.email);

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
