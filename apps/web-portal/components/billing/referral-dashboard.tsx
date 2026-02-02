'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Gift, Users, DollarSign, Copy, Check, Share2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  successfulReferrals: number;
  totalRewardsEarned: number;
  pendingRewards: number;
  recentReferrals: {
    email: string;
    status: string;
    signedUpAt: Date | null;
    subscribedAt: Date | null;
    rewardedAt: Date | null;
  }[];
}

interface ReferralDashboardProps {
  data: ReferralData;
}

export function ReferralDashboard({ data }: ReferralDashboardProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Get $3 off Speak For Me',
        text: 'Use my referral link to get 20% off your first month of Speak For Me - the AI assistant for Slack!',
        url: data.referralLink,
      });
    } else {
      copyLink();
    }
  };

  const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-blue-600" />
            Refer Friends, Earn Rewards
          </CardTitle>
          <CardDescription>
            Give friends 20% off their first month. Get $15 credit for each friend who subscribes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Referral Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Referral Link</label>
            <div className="flex gap-2">
              <Input
                value={data.referralLink}
                readOnly
                className="bg-white"
              />
              <Button onClick={copyLink} variant="outline" className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button onClick={shareLink} className="shrink-0">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Referral Code */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Or share your code:</span>
            <Badge variant="secondary" className="font-mono text-base">
              {data.referralCode}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalReferrals}</p>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.successfulReferrals}</p>
                <p className="text-sm text-muted-foreground">Converted</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatMoney(data.totalRewardsEarned)}</p>
                <p className="text-sm text-muted-foreground">Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatMoney(data.pendingRewards)}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Referrals */}
      {data.recentReferrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
            <CardDescription>Track your referral progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentReferrals.map((referral, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{referral.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {referral.signedUpAt
                        ? `Signed up ${new Date(referral.signedUpAt).toLocaleDateString()}`
                        : 'Invited'}
                    </p>
                  </div>
                  <StatusBadge status={referral.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              1
            </div>
            <p>
              <strong className="text-foreground">Share your link</strong> - Send your unique referral link to friends and colleagues
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              2
            </div>
            <p>
              <strong className="text-foreground">They get 20% off</strong> - Your friends save 20% on their first month
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              3
            </div>
            <p>
              <strong className="text-foreground">You earn $15</strong> - Once they stay subscribed for 14 days, you get $15 credit
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    invited: { label: 'Invited', className: 'bg-gray-100 text-gray-700' },
    signed_up: { label: 'Signed Up', className: 'bg-blue-100 text-blue-700' },
    subscribed: { label: 'Subscribed', className: 'bg-yellow-100 text-yellow-700' },
    rewarded: { label: 'Rewarded', className: 'bg-green-100 text-green-700' },
  };

  const { label, className } = config[status] || config.invited;

  return <Badge className={className}>{label}</Badge>;
}
