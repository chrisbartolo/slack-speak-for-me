'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Gift,
  Users,
  Copy,
  Check,
  Share2,
  Clock,
  Trophy,
  Zap,
  Rocket,
  Star,
  Target,
  PartyPopper,
} from 'lucide-react';
import { toast } from 'sonner';
import { CURRENCY, formatPrice } from '@/lib/billing/plans.config';

// Social share icons as inline SVGs for better control
const TwitterIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const TelegramIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const EmailIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

// Milestones configuration (matches backend)
const MILESTONES = [
  { count: 1, name: 'First Blood', reward: 1500, emoji: '🩸' },
  { count: 3, name: 'Hat Trick', reward: 4500, emoji: '🎩' },
  { count: 5, name: 'High Five', reward: 7500, emoji: '🖐️' },
  { count: 10, name: 'Double Digits', reward: 15000, emoji: '🔥' },
  { count: 25, name: 'Quarter Century', reward: 37500, emoji: '💎' },
  { count: 50, name: 'Legend', reward: 75000, emoji: '👑' },
  { count: 100, name: 'Centurion', reward: 150000, emoji: '🏆' },
];

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
    toast.success('Link copied! Now go spam your friends 🚀');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(data.referralCode);
    toast.success('Code copied!');
  };

  const shareNative = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Get 20% off Speak For Me',
        text: 'Use my link to get 20% off your first month! AI that writes your Slack messages. Game changer.',
        url: data.referralLink,
      });
    } else {
      copyLink();
    }
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(
      `🔥 This AI writes my difficult Slack messages for me. Absolutely based.\n\nUse my link for 20% off 👇`
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(data.referralLink)}`,
      '_blank'
    );
    toast.success('Sharing to X...');
  };

  const shareLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data.referralLink)}`,
      '_blank'
    );
    toast.success('Sharing to LinkedIn...');
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Yo, check this out 🔥\n\nThis AI writes your difficult Slack messages for you. I use it daily.\n\nUse my link for 20% off: ${data.referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
    toast.success('Opening WhatsApp...');
  };

  const shareTelegram = () => {
    const text = encodeURIComponent(
      `This AI writes your difficult Slack messages. Absolute game changer. Use my link for 20% off 🔥`
    );
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(data.referralLink)}&text=${text}`,
      '_blank'
    );
    toast.success('Opening Telegram...');
  };

  const shareEmail = () => {
    const subject = encodeURIComponent('You need this AI for Slack');
    const body = encodeURIComponent(
      `Hey!\n\nI've been using this AI that writes my difficult Slack messages. It's genuinely saved me hours.\n\nUse my link to get 20% off your first month:\n${data.referralLink}\n\nTrust me on this one.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    toast.success('Opening email...');
  };

  // Find current and next milestone
  const currentMilestone = MILESTONES.filter(m => m.count <= data.successfulReferrals).pop();
  const nextMilestone = MILESTONES.find(m => m.count > data.successfulReferrals);
  const progressToNext = nextMilestone
    ? (data.successfulReferrals / nextMilestone.count) * 100
    : 100;

  const formatMoney = (cents: number) => formatPrice(cents);

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-48 w-48 rounded-full bg-purple-400/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Rocket className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Spread the Word. Stack the Cash.</h2>
              <p className="text-purple-100">
                {CURRENCY.symbol}15 for you, 20% off for them. Win-win.
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold">{data.totalReferrals}</div>
              <div className="text-purple-200 text-sm">Total Referrals</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold">{data.successfulReferrals}</div>
              <div className="text-purple-200 text-sm">Converted</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold">{formatMoney(data.totalRewardsEarned)}</div>
              <div className="text-purple-200 text-sm">Earned</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold">{formatMoney(data.pendingRewards)}</div>
              <div className="text-purple-200 text-sm flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pending
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Section */}
      <Card className="border-2 border-dashed border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-violet-900">
            <Share2 className="h-5 w-5" />
            Share & Earn
          </CardTitle>
          <CardDescription>
            Every friend who subscribes = {CURRENCY.symbol}15 in your pocket
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Referral Link */}
          <div className="flex gap-2">
            <Input
              value={data.referralLink}
              readOnly
              className="bg-white font-mono text-sm"
            />
            <Button
              onClick={copyLink}
              variant={copied ? 'default' : 'outline'}
              className="shrink-0 min-w-[100px]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </>
              )}
            </Button>
          </div>

          {/* Code badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Or use code:</span>
            <Badge
              variant="secondary"
              className="font-mono text-base cursor-pointer hover:bg-violet-100 transition-colors"
              onClick={copyCode}
            >
              {data.referralCode}
            </Badge>
          </div>

          {/* Social Share Buttons */}
          <div className="pt-2">
            <p className="text-sm font-medium text-gray-700 mb-3">Share everywhere:</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={shareWhatsApp}
                className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
              >
                <WhatsAppIcon />
                <span className="ml-2">WhatsApp</span>
              </Button>
              <Button
                onClick={shareTelegram}
                className="bg-[#0088cc] hover:bg-[#0077b5] text-white"
              >
                <TelegramIcon />
                <span className="ml-2">Telegram</span>
              </Button>
              <Button
                onClick={shareTwitter}
                className="bg-black hover:bg-gray-800 text-white"
              >
                <TwitterIcon />
                <span className="ml-2">X / Twitter</span>
              </Button>
              <Button
                onClick={shareLinkedIn}
                className="bg-[#0A66C2] hover:bg-[#004182] text-white"
              >
                <LinkedInIcon />
                <span className="ml-2">LinkedIn</span>
              </Button>
              <Button
                onClick={shareEmail}
                variant="outline"
                className="border-gray-300"
              >
                <EmailIcon />
                <span className="ml-2">Email</span>
              </Button>
              <Button
                onClick={shareNative}
                variant="outline"
                className="border-violet-300 text-violet-700 hover:bg-violet-50"
              >
                <Share2 className="h-4 w-4" />
                <span className="ml-2">More...</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Milestones
          </CardTitle>
          <CardDescription>
            Unlock achievements as you refer more friends
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress to next milestone */}
          {nextMilestone && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-600" />
                  <span className="font-medium">
                    Next: {nextMilestone.emoji} {nextMilestone.name}
                  </span>
                </div>
                <span className="text-sm text-amber-700">
                  {data.successfulReferrals}/{nextMilestone.count} referrals
                </span>
              </div>
              <Progress value={progressToNext} className="h-3 bg-amber-100" />
              <p className="text-xs text-amber-600 mt-2">
                {nextMilestone.count - data.successfulReferrals} more to unlock{' '}
                {formatMoney(nextMilestone.reward)} in rewards!
              </p>
            </div>
          )}

          {/* Milestone badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MILESTONES.slice(0, 8).map((milestone) => {
              const achieved = data.successfulReferrals >= milestone.count;
              return (
                <div
                  key={milestone.count}
                  className={`relative p-4 rounded-xl border-2 text-center transition-all ${
                    achieved
                      ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="text-3xl mb-1">{milestone.emoji}</div>
                  <div className="font-semibold text-sm">{milestone.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {milestone.count} referral{milestone.count > 1 ? 's' : ''}
                  </div>
                  <div
                    className={`text-xs font-medium mt-1 ${
                      achieved ? 'text-amber-600' : 'text-gray-400'
                    }`}
                  >
                    {formatMoney(milestone.reward)}
                  </div>
                  {achieved && (
                    <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Referrals */}
      {data.recentReferrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Referrals
            </CardTitle>
            <CardDescription>Track your referral progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentReferrals.map((referral, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg bg-gray-50/50"
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

      {/* How It Works - More Engaging */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 font-bold">
              1
            </div>
            <div>
              <p className="font-semibold">Share your link</p>
              <p className="text-slate-400 text-sm">
                Drop it in DMs, group chats, or blast it on socials. The more you share, the more
                you earn.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-300 font-bold">
              2
            </div>
            <div>
              <p className="font-semibold">They get 20% off</p>
              <p className="text-slate-400 text-sm">
                Your friend saves money on their first month. You&apos;re basically a hero.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold">
              3
            </div>
            <div>
              <p className="font-semibold">
                You get {CURRENCY.symbol}15{' '}
                <span className="text-amber-400">per friend</span>
              </p>
              <p className="text-slate-400 text-sm">
                Once they stay subscribed for 14 days, you get {CURRENCY.symbol}15 credit. Refer 10
                friends = {CURRENCY.symbol}150. Math.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <div className="text-center py-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-800 rounded-full text-sm font-medium">
          <PartyPopper className="h-4 w-4" />
          No limits. Refer as many as you want.
          <Star className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    invited: {
      label: 'Invited',
      className: 'bg-gray-100 text-gray-700',
      icon: <Clock className="h-3 w-3" />,
    },
    signed_up: {
      label: 'Signed Up',
      className: 'bg-blue-100 text-blue-700',
      icon: <Users className="h-3 w-3" />,
    },
    subscribed: {
      label: 'Subscribed',
      className: 'bg-yellow-100 text-yellow-700',
      icon: <Zap className="h-3 w-3" />,
    },
    rewarded: {
      label: 'Rewarded!',
      className: 'bg-green-100 text-green-700',
      icon: <Gift className="h-3 w-3" />,
    },
  };

  const { label, className, icon } = config[status] || config.invited;

  return (
    <Badge className={`${className} flex items-center gap-1`}>
      {icon}
      {label}
    </Badge>
  );
}
