import { db, orgStyleSettings, userStylePreferences } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

export interface StyleContext {
  tone?: string | null;
  formality?: string | null;
  preferredPhrases?: string[] | null;
  avoidPhrases?: string[] | null;
  customGuidance?: string | null;
}

/**
 * Resolve style context by combining org and user preferences based on styleMode
 */
export async function resolveStyleContext(
  organizationId: string,
  workspaceId: string,
  userId: string
): Promise<StyleContext> {
  try {
    // Fetch org settings
    const [orgSettings] = await db
      .select()
      .from(orgStyleSettings)
      .where(eq(orgStyleSettings.organizationId, organizationId))
      .limit(1);

    // Fetch user preferences
    const [userPrefs] = await db
      .select()
      .from(userStylePreferences)
      .where(
        and(
          eq(userStylePreferences.workspaceId, workspaceId),
          eq(userStylePreferences.userId, userId)
        )
      )
      .limit(1);

    // If no org settings, return user preferences only
    if (!orgSettings) {
      if (!userPrefs) {
        return {};
      }
      return {
        tone: userPrefs.tone,
        formality: userPrefs.formality,
        preferredPhrases: userPrefs.preferredPhrases || null,
        avoidPhrases: userPrefs.avoidPhrases || null,
        customGuidance: userPrefs.customGuidance,
      };
    }

    // Org settings exist - apply based on styleMode
    const styleMode = orgSettings.styleMode || 'fallback';

    if (styleMode === 'override') {
      // Org settings override user preferences completely
      return {
        tone: orgSettings.tone,
        formality: orgSettings.formality,
        preferredPhrases: orgSettings.preferredPhrases || null,
        avoidPhrases: orgSettings.avoidPhrases || null,
        customGuidance: orgSettings.customGuidance,
      };
    }

    if (styleMode === 'layer') {
      // Org provides base, user overrides where set (non-null user values win)
      return {
        tone: userPrefs?.tone ?? orgSettings.tone,
        formality: userPrefs?.formality ?? orgSettings.formality,
        preferredPhrases: userPrefs?.preferredPhrases ?? orgSettings.preferredPhrases ?? null,
        avoidPhrases: userPrefs?.avoidPhrases ?? orgSettings.avoidPhrases ?? null,
        customGuidance: userPrefs?.customGuidance ?? orgSettings.customGuidance,
      };
    }

    if (styleMode === 'fallback') {
      // User preferences first, org fills null gaps
      return {
        tone: userPrefs?.tone ?? orgSettings.tone,
        formality: userPrefs?.formality ?? orgSettings.formality,
        preferredPhrases: userPrefs?.preferredPhrases ?? orgSettings.preferredPhrases ?? null,
        avoidPhrases: userPrefs?.avoidPhrases ?? orgSettings.avoidPhrases ?? null,
        customGuidance: userPrefs?.customGuidance ?? orgSettings.customGuidance,
      };
    }

    // Default: fallback behavior
    return {
      tone: userPrefs?.tone ?? orgSettings.tone,
      formality: userPrefs?.formality ?? orgSettings.formality,
      preferredPhrases: userPrefs?.preferredPhrases ?? orgSettings.preferredPhrases ?? null,
      avoidPhrases: userPrefs?.avoidPhrases ?? orgSettings.avoidPhrases ?? null,
      customGuidance: userPrefs?.customGuidance ?? orgSettings.customGuidance,
    };
  } catch (error) {
    logger.warn({ error, organizationId, workspaceId, userId }, 'Failed to resolve style context');
    return {};
  }
}

/**
 * Check if YOLO mode (auto-send) is allowed for a user
 */
export async function checkYoloPermission(
  organizationId: string,
  userId: string
): Promise<boolean> {
  try {
    // Fetch org settings
    const [orgSettings] = await db
      .select()
      .from(orgStyleSettings)
      .where(eq(orgStyleSettings.organizationId, organizationId))
      .limit(1);

    if (!orgSettings) {
      return false; // Default: YOLO disabled if no settings exist
    }

    // Check for user-specific override
    const userOverrides = orgSettings.yoloModeUserOverrides as Record<string, boolean> | null;
    if (userOverrides && userId in userOverrides) {
      return userOverrides[userId];
    }

    // Fall back to global setting
    return orgSettings.yoloModeGlobal ?? false;
  } catch (error) {
    logger.warn({ error, organizationId, userId }, 'Failed to check YOLO permission');
    return false; // Default: disabled on error
  }
}
