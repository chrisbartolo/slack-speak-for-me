/**
 * Pricing Plans Configuration
 *
 * Single source of truth for all pricing tiers.
 * Change values here to adjust pricing without code changes.
 *
 * Pricing Model: Fair Usage + Top-up
 * - Each plan includes a monthly suggestion allowance
 * - Overage billed per suggestion beyond allowance
 * - No volume discounts (protects margin)
 */

export interface PlanConfig {
  id: string;
  name: string;
  description: string;
  type: 'individual' | 'team';

  // Pricing
  basePrice: number; // Monthly base in cents
  pricePerSeat?: number; // Per seat for team plans (cents)

  // Usage limits
  includedSuggestions: number; // Per user per month
  overageRate: number; // Cents per suggestion over limit

  // Stripe IDs (set via env vars)
  stripePriceId: string;
  stripeOveragePriceId: string;

  // Features
  features: string[];

  // Display
  popular?: boolean;
  cta: string;
}

// Individual Plans
export const INDIVIDUAL_PLANS: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'For occasional use',
    type: 'individual',
    basePrice: 900, // $9/mo
    includedSuggestions: 25,
    overageRate: 35, // $0.35 per extra suggestion
    stripePriceId: process.env.STRIPE_PRICE_STARTER || '',
    stripeOveragePriceId: process.env.STRIPE_OVERAGE_STARTER || '',
    features: [
      '25 AI suggestions/month',
      'Style learning',
      'Conversation context',
      'Refinement modal',
      'Email support',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For daily communicators',
    type: 'individual',
    basePrice: 1500, // $15/mo
    includedSuggestions: 75,
    overageRate: 30, // $0.30 per extra suggestion
    stripePriceId: process.env.STRIPE_PRICE_PRO || '',
    stripeOveragePriceId: process.env.STRIPE_OVERAGE_PRO || '',
    features: [
      '75 AI suggestions/month',
      'Style learning',
      'Conversation context',
      'Person context notes',
      'Refinement modal',
      'Priority support',
    ],
    popular: true,
    cta: 'Start Free Trial',
  },
];

// Team Plans
export const TEAM_PLANS: PlanConfig[] = [
  {
    id: 'team',
    name: 'Team',
    description: 'For small teams',
    type: 'team',
    basePrice: 0, // No base fee
    pricePerSeat: 1200, // $12/seat/mo
    includedSuggestions: 50, // Per seat
    overageRate: 25, // $0.25 per extra suggestion
    stripePriceId: process.env.STRIPE_PRICE_TEAM || '',
    stripeOveragePriceId: process.env.STRIPE_OVERAGE_TEAM || '',
    features: [
      '50 AI suggestions/seat/month',
      'Everything in Pro',
      'Team admin dashboard',
      'Usage analytics',
      'Shared style guides',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For growing organizations',
    type: 'team',
    basePrice: 0,
    pricePerSeat: 1800, // $18/seat/mo
    includedSuggestions: 100, // Per seat
    overageRate: 20, // $0.20 per extra suggestion
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS || '',
    stripeOveragePriceId: process.env.STRIPE_OVERAGE_BUSINESS || '',
    features: [
      '100 AI suggestions/seat/month',
      'Everything in Team',
      'SSO/SAML',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
    ],
    popular: true,
    cta: 'Start Free Trial',
  },
];

// All plans
export const ALL_PLANS = [...INDIVIDUAL_PLANS, ...TEAM_PLANS];

// Helper to get plan by ID
export function getPlanById(planId: string): PlanConfig | undefined {
  return ALL_PLANS.find(p => p.id === planId);
}

// Helper to get included suggestions for a plan
export function getIncludedSuggestions(planId: string, seatCount: number = 1): number {
  const plan = getPlanById(planId);
  if (!plan) return 0;

  if (plan.type === 'team') {
    return plan.includedSuggestions * seatCount;
  }
  return plan.includedSuggestions;
}

// Helper to calculate overage cost
export function calculateOverageCost(planId: string, overageCount: number): number {
  const plan = getPlanById(planId);
  if (!plan || overageCount <= 0) return 0;
  return plan.overageRate * overageCount;
}

// Usage thresholds for warnings
export const USAGE_THRESHOLDS = {
  WARNING: 0.8, // 80% - show warning
  CRITICAL: 0.95, // 95% - show critical warning
  HARD_CAP: 1.0, // 100% - block new suggestions
};

// Format price for display
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// Format overage rate for display
export function formatOverageRate(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
