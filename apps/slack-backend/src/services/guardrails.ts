import { db, guardrailConfig, guardrailViolations } from '@slack-speak/database';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// Predefined category keywords (duplicated from web-portal for independence)
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

export interface GuardrailEnforcementResult {
  text: string | null;
  blocked: boolean;
  blockReason?: string;
  shouldRegenerate?: boolean;
  avoidTopics?: string[];
  warnings?: string[];
}

/**
 * Get guardrail config for an organization (cache-friendly, no mutations)
 */
export async function getGuardrailConfig(organizationId: string) {
  try {
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
        enabledCategories: ['legal_advice', 'pricing_commitments', 'competitor_bashing'] as string[],
        blockedKeywords: [] as string[],
        triggerMode: 'hard_block' as const,
        updatedAt: new Date(),
      };
    }

    return {
      ...config,
      enabledCategories: config.enabledCategories || [],
      blockedKeywords: config.blockedKeywords || [],
    };
  } catch (error) {
    logger.warn({ error, organizationId }, 'Failed to fetch guardrail config');
    // Return safe defaults on error
    return {
      id: undefined,
      organizationId,
      enabledCategories: [] as string[],
      blockedKeywords: [] as string[],
      triggerMode: 'hard_block' as const,
      updatedAt: new Date(),
    };
  }
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
 * Log a guardrail violation (fire-and-forget, wrapped in try/catch)
 */
async function logViolation(
  organizationId: string,
  workspaceId: string,
  userId: string,
  violation: GuardrailViolation,
  suggestionText: string,
  action: 'blocked' | 'regenerated' | 'warned'
): Promise<void> {
  try {
    await db.insert(guardrailViolations).values({
      organizationId,
      workspaceId,
      userId,
      violationType: violation.type,
      violatedRule: violation.rule,
      suggestionText, // Plan-gated visibility enforced at read time in web-portal
      action,
      createdAt: new Date(),
    });
  } catch (error) {
    // Fire-and-forget - don't fail suggestion generation if logging fails
    logger.warn({ error, organizationId, violation }, 'Failed to log guardrail violation');
  }
}

/**
 * Check and enforce guardrails for a suggestion
 * Full enforcement with violation logging and trigger mode handling
 */
export async function checkAndEnforceGuardrails(
  organizationId: string,
  workspaceId: string,
  userId: string,
  suggestionText: string,
  channelId?: string
): Promise<GuardrailEnforcementResult> {
  try {
    // Fetch guardrail config
    const config = await getGuardrailConfig(organizationId);

    // If no config exists or no rules enabled, pass through
    if (!config.id && config.enabledCategories.length === 0 && config.blockedKeywords.length === 0) {
      return {
        text: suggestionText,
        blocked: false,
      };
    }

    // Run guardrail checks
    const checkResult = checkGuardrails(suggestionText, config);

    // If no violations, return text unchanged
    if (!checkResult.violated) {
      return {
        text: suggestionText,
        blocked: false,
      };
    }

    // Violations found - handle based on trigger mode
    const triggerMode = config.triggerMode || 'hard_block';

    if (triggerMode === 'hard_block') {
      // Log violations
      for (const violation of checkResult.violations) {
        await logViolation(organizationId, workspaceId, userId, violation, suggestionText, 'blocked');
      }

      return {
        text: null,
        blocked: true,
        blockReason: checkResult.violations[0].rule,
      };
    }

    if (triggerMode === 'regenerate') {
      // Log violations
      for (const violation of checkResult.violations) {
        await logViolation(organizationId, workspaceId, userId, violation, suggestionText, 'regenerated');
      }

      // Extract unique topics to avoid
      const avoidTopics = [...new Set(checkResult.violations.map(v => v.rule))];

      return {
        text: null,
        blocked: false,
        shouldRegenerate: true,
        avoidTopics,
      };
    }

    if (triggerMode === 'soft_warning') {
      // Log violations
      for (const violation of checkResult.violations) {
        await logViolation(organizationId, workspaceId, userId, violation, suggestionText, 'warned');
      }

      // Return text with warnings
      const warnings = checkResult.violations.map(v => `Contains ${v.rule}`);

      return {
        text: suggestionText,
        blocked: false,
        warnings,
      };
    }

    // Fallback: pass through (shouldn't reach here)
    return {
      text: suggestionText,
      blocked: false,
    };
  } catch (error) {
    // Fail open - don't block suggestions if guardrail check fails
    logger.error({ error, organizationId, workspaceId, userId }, 'Guardrail enforcement failed, allowing suggestion');
    return {
      text: suggestionText,
      blocked: false,
    };
  }
}
