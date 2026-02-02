'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type BillingMode = 'individual' | 'team';

interface Plan {
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  cta: string;
  planId: string;
}

const INDIVIDUAL_PLANS: Plan[] = [
  {
    name: 'Starter',
    price: 10,
    description: 'Perfect for individual professionals',
    features: [
      'AI response suggestions',
      'Watch up to 5 channels',
      'Copy to clipboard',
      'Basic refinement',
      'Email support',
    ],
    cta: 'Start Free Trial',
    planId: 'starter',
  },
  {
    name: 'Pro',
    price: 15,
    description: 'For power users who need the full suite',
    features: [
      'Everything in Starter',
      'Unlimited channels',
      'Style learning',
      'Weekly reports',
      'Google Sheets integration',
      'Priority support',
    ],
    popular: true,
    cta: 'Start Free Trial',
    planId: 'pro',
  },
];

const TEAM_PLANS: Plan[] = [
  {
    name: 'Team Starter',
    price: 10,
    description: 'Perfect for small teams getting started',
    features: [
      'AI response suggestions',
      'Watch up to 5 channels per user',
      'Copy to clipboard',
      'Basic refinement',
      'Email support',
      'Centralized billing',
    ],
    cta: 'Start Free Trial',
    planId: 'team-starter',
  },
  {
    name: 'Team Pro',
    price: 15,
    description: 'For teams who need the full power',
    features: [
      'Everything in Team Starter',
      'Unlimited channels per user',
      'Style learning',
      'Weekly reports',
      'Google Sheets integration',
      'Priority support',
      'Admin dashboard',
    ],
    popular: true,
    cta: 'Start Free Trial',
    planId: 'team-pro',
  },
];

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-indigo-500 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
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

function PricingCard({ plan, mode }: { plan: Plan; mode: BillingMode }) {
  const priceLabel = mode === 'individual' ? '/month' : '/seat/month';
  const ctaHref = `/login?plan=${plan.planId}&mode=${mode}`;

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
            <span className="text-4xl font-bold">${plan.price}</span>
            <span className="text-gray-500 ml-1">{priceLabel}</span>
          </div>
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

export function PricingTable() {
  const [mode, setMode] = useState<BillingMode>('individual');
  const plans = mode === 'individual' ? INDIVIDUAL_PLANS : TEAM_PLANS;

  return (
    <div>
      <BillingModeToggle mode={mode} onChange={setMode} />
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <PricingCard key={plan.name} plan={plan} mode={mode} />
        ))}
      </div>
    </div>
  );
}
