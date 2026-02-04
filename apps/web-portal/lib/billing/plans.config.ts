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

// Free Plan (no Stripe integration)
export const FREE_PLAN: PlanConfig = {
  id: 'free',
  name: 'Free',
  description: 'Limited free tier for evaluation',
  type: 'individual',
  basePrice: 0,
  includedSuggestions: 5,
  overageRate: 0, // Hard cap - no overage allowed
  stripePriceId: '',
  stripeOveragePriceId: '',
  features: [
    'Up to 5 suggestions per month',
    'AI learns YOUR writing style',
    'Understands conversation context',
  ],
  cta: 'Get Started Free',
};

// Individual Plans
export const INDIVIDUAL_PLANS: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for occasional difficult conversations',
    type: 'individual',
    basePrice: 900, // €9/mo
    includedSuggestions: 25,
    overageRate: 35, // €0.35 per extra suggestion
    stripePriceId: process.env.STRIPE_PRICE_STARTER || '',
    stripeOveragePriceId: process.env.STRIPE_OVERAGE_STARTER || '',
    features: [
      'Handle ~1 difficult message per day',
      'AI learns YOUR writing style',
      'Understands conversation context',
      'Refine suggestions until perfect',
      'Save hours on crafting responses',
    ],
    cta: 'Start 14-Day Free Trial',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For professionals who communicate daily',
    type: 'individual',
    basePrice: 1500, // €15/mo
    includedSuggestions: 75,
    overageRate: 30, // €0.30 per extra suggestion
    stripePriceId: process.env.STRIPE_PRICE_PRO || '',
    stripeOveragePriceId: process.env.STRIPE_OVERAGE_PRO || '',
    features: [
      'Handle 3+ messages per day',
      'AI learns YOUR writing style',
      'Notes about people you message',
      'Never miss important context',
      'Unlimited refinements',
      'Priority support',
    ],
    popular: true,
    cta: 'Start 14-Day Free Trial',
  },
];

// Team Plans
export const TEAM_PLANS: PlanConfig[] = [
  {
    id: 'team',
    name: 'Team',
    description: 'Empower your whole team',
    type: 'team',
    basePrice: 0, // No base fee
    pricePerSeat: 1200, // €12/seat/mo
    includedSuggestions: 50, // Per seat
    overageRate: 25, // €0.25 per extra suggestion
    stripePriceId: process.env.STRIPE_PRICE_TEAM || '',
    stripeOveragePriceId: process.env.STRIPE_OVERAGE_TEAM || '',
    features: [
      '~2 messages/day per person',
      'All Pro features for everyone',
      'See team usage & engagement',
      'Communication insights dashboard',
      'Consistent team voice',
    ],
    cta: 'Start 14-Day Free Trial',
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For high-volume communication teams',
    type: 'team',
    basePrice: 0,
    pricePerSeat: 1800, // €18/seat/mo
    includedSuggestions: 100, // Per seat
    overageRate: 20, // €0.20 per extra suggestion
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS || '',
    stripeOveragePriceId: process.env.STRIPE_OVERAGE_BUSINESS || '',
    features: [
      '~4+ messages/day per person',
      'Advanced communication analytics',
      'Enterprise SSO/SAML',
      'Custom API integrations',
      'Dedicated account manager',
      '99.9% uptime SLA',
    ],
    popular: true,
    cta: 'Start 14-Day Free Trial',
  },
];

// All plans
export const ALL_PLANS = [FREE_PLAN, ...INDIVIDUAL_PLANS, ...TEAM_PLANS];

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

// Currency configuration
export const CURRENCY = {
  code: 'EUR',
  symbol: '€',
  locale: 'en-EU',
};

// Format price for display
export function formatPrice(cents: number): string {
  return `${CURRENCY.symbol}${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// Format overage rate for display
export function formatOverageRate(cents: number): string {
  return `${CURRENCY.symbol}${(cents / 100).toFixed(2)}`;
}
