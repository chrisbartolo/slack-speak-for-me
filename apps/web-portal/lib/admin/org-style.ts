import 'server-only';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

const { orgStyleSettings } = schema;

// Validation schemas
const orgStyleSchema = z.object({
  styleMode: z.enum(['override', 'layer', 'fallback']),
  tone: z.string().max(50).nullable().optional(),
  formality: z.string().max(50).nullable().optional(),
  preferredPhrases: z.array(z.string().max(100)).max(20).nullable().optional(),
  avoidPhrases: z.array(z.string().max(100)).max(20).nullable().optional(),
  customGuidance: z.string().max(2000).nullable().optional(),
});

export type OrgStyleData = z.infer<typeof orgStyleSchema>;

/**
 * Get org style settings for organization
 */
export async function getOrgStyleSettings(organizationId: string) {
  const [settings] = await db
    .select()
    .from(orgStyleSettings)
    .where(eq(orgStyleSettings.organizationId, organizationId))
    .limit(1);

  return settings || null;
}

/**
 * Upsert org style settings
 */
export async function upsertOrgStyleSettings(
  organizationId: string,
  data: OrgStyleData
) {
  // Validate input
  const validated = orgStyleSchema.parse(data);

  // Upsert with conflict resolution on organizationId
  const [updated] = await db
    .insert(orgStyleSettings)
    .values({
      organizationId,
      styleMode: validated.styleMode,
      tone: validated.tone ?? null,
      formality: validated.formality ?? null,
      preferredPhrases: validated.preferredPhrases ?? null,
      avoidPhrases: validated.avoidPhrases ?? null,
      customGuidance: validated.customGuidance ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: orgStyleSettings.organizationId,
      set: {
        styleMode: validated.styleMode,
        tone: validated.tone ?? null,
        formality: validated.formality ?? null,
        preferredPhrases: validated.preferredPhrases ?? null,
        avoidPhrases: validated.avoidPhrases ?? null,
        customGuidance: validated.customGuidance ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return updated;
}

/**
 * Get YOLO mode settings (global and user overrides)
 */
export async function getYoloModeSettings(organizationId: string) {
  const settings = await getOrgStyleSettings(organizationId);

  return {
    globalEnabled: settings?.yoloModeGlobal ?? false,
    userOverrides: settings?.yoloModeUserOverrides ?? {},
  };
}

/**
 * Update global YOLO mode setting
 */
export async function updateYoloModeGlobal(
  organizationId: string,
  enabled: boolean
) {
  // Get existing settings or create default
  const existing = await getOrgStyleSettings(organizationId);

  if (existing) {
    // Update existing
    await db
      .update(orgStyleSettings)
      .set({
        yoloModeGlobal: enabled,
        updatedAt: new Date(),
      })
      .where(eq(orgStyleSettings.organizationId, organizationId));
  } else {
    // Create new with default values
    await db.insert(orgStyleSettings).values({
      organizationId,
      styleMode: 'fallback',
      yoloModeGlobal: enabled,
      updatedAt: new Date(),
    });
  }

  return { globalEnabled: enabled };
}

/**
 * Update YOLO mode for specific user
 */
export async function updateYoloModeUser(
  organizationId: string,
  slackUserId: string,
  enabled: boolean | null
) {
  const settings = await getOrgStyleSettings(organizationId);
  const currentOverrides = settings?.yoloModeUserOverrides || {};

  // If enabled is null, remove the user override (use org default)
  const newOverrides = { ...currentOverrides };
  if (enabled === null) {
    delete newOverrides[slackUserId];
  } else {
    newOverrides[slackUserId] = enabled;
  }

  if (settings) {
    // Update existing
    await db
      .update(orgStyleSettings)
      .set({
        yoloModeUserOverrides: newOverrides,
        updatedAt: new Date(),
      })
      .where(eq(orgStyleSettings.organizationId, organizationId));
  } else {
    // Create new with default values
    await db.insert(orgStyleSettings).values({
      organizationId,
      styleMode: 'fallback',
      yoloModeGlobal: false,
      yoloModeUserOverrides: newOverrides,
      updatedAt: new Date(),
    });
  }

  return { userOverrides: newOverrides };
}

/**
 * Check if YOLO mode is enabled for specific user
 */
export async function isYoloEnabled(
  organizationId: string,
  slackUserId: string
): Promise<boolean> {
  const settings = await getOrgStyleSettings(organizationId);

  if (!settings) {
    return false; // Default: disabled
  }

  // Check for user-specific override
  const userOverride = settings.yoloModeUserOverrides?.[slackUserId];
  if (userOverride !== undefined) {
    return userOverride;
  }

  // Fall back to global setting
  return settings.yoloModeGlobal ?? false;
}
