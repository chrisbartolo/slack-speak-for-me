import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Plan {
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  cta: string;
  ctaHref: string;
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    price: 10,
    description: 'Perfect for individuals and small teams',
    features: [
      'AI response suggestions',
      'Watch up to 5 channels',
      'Copy to clipboard',
      'Basic refinement',
      'Email support',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/login?plan=starter',
  },
  {
    name: 'Pro',
    price: 15,
    description: 'For teams who need the full power',
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
    ctaHref: '/login?plan=pro',
  },
];

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-green-500 flex-shrink-0"
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

function PricingCard({ plan }: { plan: Plan }) {
  return (
    <Card
      className={`relative flex flex-col ${
        plan.popular
          ? 'border-[#4A154B] border-2 shadow-lg scale-105'
          : 'border-gray-200'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#4A154B] text-white text-xs font-semibold px-3 py-1 rounded-full">
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
            <span className="text-gray-500 ml-1">/seat/month</span>
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

        <Link href={plan.ctaHref} className="block">
          <Button
            className={`w-full ${
              plan.popular
                ? 'bg-[#4A154B] hover:bg-[#3d1140]'
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
  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {PLANS.map((plan) => (
        <PricingCard key={plan.name} plan={plan} />
      ))}
    </div>
  );
}
