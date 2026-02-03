import 'server-only';
import { db, schema } from '../db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getPlanFeatures } from './plan-features';

const { guardrailConfig, guardrailViolations, workspaces, organizations } = schema;

export const PREDEFINED_CATEGORIES = [
  {
    id: 'legal_advice',
    name: 'Legal Advice',
    description: 'Prevents AI from giving legal opinions or recommendations',
    keywords: ['hereby', 'pursuant', 'legally binding', 'sue', 'litigation', 'statute', 'liability'],
  },
  {
    id: 'pricing_commitments',
    name: 'Pricing Commitments',
    description: 'Blocks specific pricing quotes or discount promises',
    keywords: ['guarantee price', 'lock in rate', 'special discount', 'custom pricing', 'waive fee'],
  },
  {
    id: 'competitor_bashing',
    name: 'Competitor Mentions',
    description: 'Avoids negative competitor references',
    keywords: ['better than', 'unlike', 'competitor fails'],
  },
  {
    id: 'medical_advice',
    name: 'Medical Advice',
    description: 'Prevents health or medical recommendations',
    keywords: ['diagnose', 'prescribe', 'treatment plan', 'medical advice'],
  },
  {
    id: 'financial_advice',
    name: 'Financial Advice',
    description: 'Blocks investment or financial guidance',
    keywords: ['invest in', 'financial advice', 'guaranteed returns', 'buy recommendation', 'sell recommendation'],
  },
  {
    id: 'hr_decisions',
    name: 'HR Decisions',
    description: 'Prevents employment-related commitments',
    keywords: ['you are fired', 'terminated', 'promote you', 'salary increase guaranteed'],
  },
  {
    id: 'nda_confidential',
    name: 'Confidential Information',
    description: 'Blocks sharing of marked confidential content',
    keywords: ['confidential', 'proprietary', 'trade secret', 'under nda'],
  },
] as const;

export type GuardrailCategory = typeof PREDEFINED_CATEGORIES[number]['id'];

export interface GuardrailViolation {
  type: 'category' | 'keyword';
  rule: string;
  matchedText: string;
}

export interface GuardrailCheckResult {
  violated: boolean;
  violations: GuardrailViolation[];
}

/**
 * Get guardrail config for an organization
 * Returns defaults if none exists
 */
export async function getGuardrailConfig(organizationId: string) {
  const [config] = await db
    .select()
    .from(guardrailConfig)
    .where(eq(guardrailConfig.organizationId, organizationId))
    .limit(1);

  // Return defaults if no config exists
  if (!config) {
    return {
      id: undefined,
      organizationId,
      enabledCategories: ['legal_advice', 'pricing_commitments', 'competitor_bashing'],
      blockedKeywords: [],
      triggerMode: 'hard_block' as const,
      updatedAt: new Date(),
    };
  }

  return config;
}

/**
 * Upsert guardrail configuration
 */
export async function upsertGuardrailConfig(
  organizationId: string,
  data: {
    enabledCategories: string[];
    blockedKeywords: string[];
    triggerMode: 'hard_block' | 'regenerate' | 'soft_warning';
  }
) {
  // Validate enabled categories
  const validCategoryIds = PREDEFINED_CATEGORIES.map((c) => c.id as string);
  const invalidCategories = data.enabledCategories.filter(
    (cat) => !validCategoryIds.includes(cat)
  );
  if (invalidCategories.length > 0) {
    throw new Error(`Invalid categories: ${invalidCategories.join(', ')}`);
  }

  // Get plan features for keyword limit validation
  const [org] = await db
    .select({ planId: organizations.planId })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const planFeatures = getPlanFeatures(org?.planId);

  // Validate blocked keywords
  if (data.blockedKeywords.length > planFeatures.maxBlockedKeywords) {
    throw new Error(
      `Exceeded max blocked keywords limit (${planFeatures.maxBlockedKeywords} for your plan)`
    );
  }

  // Validate each keyword length
  const invalidKeywords = data.blockedKeywords.filter((kw) => kw.length > 100);
  if (invalidKeywords.length > 0) {
    throw new Error('Keywords must be 100 characters or less');
  }

  // Validate trigger mode
  const validTriggerModes = ['hard_block', 'regenerate', 'soft_warning'];
  if (!validTriggerModes.includes(data.triggerMode)) {
    throw new Error(`Invalid trigger mode: ${data.triggerMode}`);
  }

  // Upsert configuration
  const [updated] = await db
    .insert(guardrailConfig)
    .values({
      organizationId,
      enabledCategories: data.enabledCategories,
      blockedKeywords: data.blockedKeywords,
      triggerMode: data.triggerMode,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: guardrailConfig.organizationId,
      set: {
        enabledCategories: data.enabledCategories,
        blockedKeywords: data.blockedKeywords,
        triggerMode: data.triggerMode,
        updatedAt: new Date(),
      },
    })
    .returning();

  return updated;
}

/**
 * Check if text violates any guardrails
 * Returns all violations found
 */
export function checkGuardrails(
  text: string,
  config: Awaited<ReturnType<typeof getGuardrailConfig>>
): GuardrailCheckResult {
  const violations: GuardrailViolation[] = [];
  const lowerText = text.toLowerCase();

  // Check custom blocked keywords first
  for (const keyword of config.blockedKeywords || []) {
    const lowerKeyword = keyword.toLowerCase();
    // Use word boundary matching
    const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        violations.push({
          type: 'keyword',
          rule: keyword,
          matchedText: match,
        });
      }
    }
  }

  // Check enabled category keywords
  for (const categoryId of config.enabledCategories || []) {
    const category = PREDEFINED_CATEGORIES.find((c) => c.id === categoryId as GuardrailCategory);
    if (!category) continue;

    for (const keyword of category.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      // Use word boundary matching
      const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: 'category',
            rule: `${category.name} (${keyword})`,
            matchedText: match,
          });
        }
      }
    }
  }

  return {
    violated: violations.length > 0,
    violations,
  };
}

/**
 * Log a guardrail violation
 */
export async function logViolation(
  organizationId: string,
  workspaceId: string,
  userId: string,
  violation: GuardrailViolation,
  suggestionText: string,
  action: 'blocked' | 'regenerated' | 'warned'
) {
  await db.insert(guardrailViolations).values({
    organizationId,
    workspaceId,
    userId,
    violationType: violation.type,
    violatedRule: violation.rule,
    suggestionText,
    action,
    createdAt: new Date(),
  });
}

/**
 * Get violation statistics for an organization
 */
export async function getViolationStats(
  organizationId: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all violations in the period
  const violations = await db
    .select()
    .from(guardrailViolations)
    .where(
      and(
        eq(guardrailViolations.organizationId, organizationId),
        gte(guardrailViolations.createdAt, startDate)
      )
    );

  // Calculate statistics
  const totalCount = violations.length;

  // Count by violation type
  const byType = violations.reduce((acc, v) => {
    acc[v.violationType] = (acc[v.violationType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Count by violated rule
  const byRule = violations.reduce((acc, v) => {
    acc[v.violatedRule] = (acc[v.violatedRule] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Count by action
  const byAction = violations.reduce((acc, v) => {
    acc[v.action] = (acc[v.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Daily trend
  const dailyTrend = violations.reduce((acc, v) => {
    const date = v.createdAt?.toISOString().split('T')[0] || 'unknown';
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Convert daily trend to array sorted by date
  const trendArray = Object.entries(dailyTrend)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Most triggered rule
  const mostTriggeredRule = Object.entries(byRule).sort((a, b) => b[1] - a[1])[0] || ['None', 0];

  // Most common action
  const mostCommonAction = Object.entries(byAction).sort((a, b) => b[1] - a[1])[0] || ['None', 0];

  // Recent violations (last 50)
  const recentViolations = violations
    .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
    .slice(0, 50);

  return {
    totalCount,
    byType,
    byRule,
    byAction,
    dailyTrend: trendArray,
    mostTriggeredRule: mostTriggeredRule[0],
    mostCommonAction: mostCommonAction[0],
    recentViolations,
  };
}
