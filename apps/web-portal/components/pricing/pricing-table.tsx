'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Gift, Zap, Tag } from 'lucide-react';
import {
  INDIVIDUAL_PLANS as CONFIG_INDIVIDUAL_PLANS,
  TEAM_PLANS as CONFIG_TEAM_PLANS,
  formatPrice,
  formatOverageRate,
  type PlanConfig,
} from '@/lib/billing/plans.config';

type BillingMode = 'individual' | 'team';

function CheckIcon() {
  return (
    <Check className="w-5 h-5 text-indigo-500 flex-shrink-0" />
  );
}

function BillingModeToggle({
  mode,
  onChange,
}: {
  mode: BillingMode;
  onChange: (mode: BillingMode) => void;
}) {
  return (
    <div className="flex justify-center mb-12">
      <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
        <button
          onClick={() => onChange('individual')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
            mode === 'individual'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          For Myself
        </button>
        <button
          onClick={() => onChange('team')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
            mode === 'team'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          For My Team
        </button>
      </div>
    </div>
  );
}

function PricingCard({
  plan,
  mode,
  referralCode,
  couponCode,
  referralDiscount,
}: {
  plan: PlanConfig;
  mode: BillingMode;
  referralCode: string | null;
  couponCode: string | null;
  referralDiscount: number;
}) {
  const price = plan.type === 'team' ? (plan.pricePerSeat || 0) : plan.basePrice;
  const priceLabel = mode === 'individual' ? '/month' : '/seat/month';

  // Build CTA URL with any referral/coupon codes
  let ctaHref = `/login?plan=${plan.id}&mode=${mode}`;
  if (referralCode) ctaHref += `&ref=${referralCode}`;
  if (couponCode) ctaHref += `&coupon=${couponCode}`;

  // Calculate discounted price for display
  const displayPrice = referralDiscount > 0
    ? Math.round(price * (1 - referralDiscount / 100))
    : price;

  return (
    <Card
      className={`relative flex flex-col bg-white ${
        plan.popular
          ? 'border-indigo-500 border-2 shadow-xl shadow-indigo-500/10 scale-105'
          : 'border-gray-200 shadow-sm'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
      </CardHeader>

      <CardContent className="flex flex-col flex-grow">
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center">
            {referralDiscount > 0 && (
              <span className="text-xl text-gray-400 line-through mr-2">
                {formatPrice(price)}
              </span>
            )}
            <span className="text-4xl font-bold">{formatPrice(displayPrice)}</span>
            <span className="text-gray-500 ml-1">{priceLabel}</span>
          </div>
          {referralDiscount > 0 && (
            <Badge className="mt-2 bg-green-100 text-green-700">
              <Gift className="w-3 h-3 mr-1" />
              {referralDiscount}% off first month
            </Badge>
          )}
        </div>

        {/* Usage info */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span className="font-medium">
              {plan.includedSuggestions} AI suggestions{plan.type === 'team' ? '/seat' : ''}/month
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Then {formatOverageRate(plan.overageRate)} per additional suggestion
          </p>
        </div>

        <ul className="space-y-3 mb-8 flex-grow">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckIcon />
              <span className="text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>

        <Link href={ctaHref} className="block">
          <Button
            className={`w-full ${
              plan.popular
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-indigo-500/25'
                : 'bg-gray-900 hover:bg-gray-800'
            }`}
            size="lg"
          >
            {plan.cta}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function CouponInput({
  value,
  onChange,
  applied,
  discount,
}: {
  value: string;
  onChange: (value: string) => void;
  applied: boolean;
  discount: string | null;
}) {
  return (
    <div className="max-w-md mx-auto mb-8">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder="Have a coupon code?"
            className="pl-10"
            disabled={applied}
          />
        </div>
        {!applied && (
          <Button variant="outline" onClick={() => onChange(value)}>
            Apply
          </Button>
        )}
      </div>
      {applied && discount && (
        <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
          <Check className="w-4 h-4" />
          Coupon applied: {discount}
        </p>
      )}
    </div>
  );
}

export function PricingTable() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<BillingMode>('individual');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState<string | null>(null);

  // Get referral code from URL
  const referralCode = searchParams.get('ref');
  const referralDiscount = referralCode ? 20 : 0; // 20% off for referrals

  // Check for coupon in URL
  useEffect(() => {
    const urlCoupon = searchParams.get('coupon');
    if (urlCoupon) {
      setCouponCode(urlCoupon);
      // In a real app, validate the coupon via API
      setCouponApplied(true);
      setCouponDiscount('10% off');
    }
  }, [searchParams]);

  const plans = mode === 'individual' ? CONFIG_INDIVIDUAL_PLANS : CONFIG_TEAM_PLANS;

  return (
    <div>
      {/* Referral banner */}
      {referralCode && (
        <div className="max-w-2xl mx-auto mb-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <div className="flex items-center justify-center gap-2 text-green-700">
            <Gift className="w-5 h-5" />
            <span className="font-medium">You&apos;ve been referred! Get 20% off your first month.</span>
          </div>
        </div>
      )}

      <BillingModeToggle mode={mode} onChange={setMode} />

      {/* Coupon input */}
      <CouponInput
        value={couponCode}
        onChange={setCouponCode}
        applied={couponApplied}
        discount={couponDiscount}
      />

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            mode={mode}
            referralCode={referralCode}
            couponCode={couponApplied ? couponCode : null}
            referralDiscount={referralDiscount}
          />
        ))}
      </div>

      {/* Enterprise CTA */}
      <div className="text-center mt-12">
        <p className="text-gray-600 mb-4">
          Need more than 50 seats or custom features?
        </p>
        <Link href="mailto:enterprise@speakforme.app">
          <Button variant="outline" size="lg">
            Contact Sales
          </Button>
        </Link>
      </div>
    </div>
  );
}
