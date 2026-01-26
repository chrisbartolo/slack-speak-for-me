import type { Installation, InstallationQuery } from '@slack/bolt';
import { db, workspaces, installations, encrypt, decrypt } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { getEncryptionKey } from '../env.js';

/**
 * Custom installation store that encrypts OAuth tokens before storing in PostgreSQL
 * Implements the InstallationStore interface required by @slack/bolt
 */
export const installationStore = {
  /**
   * Store a new installation or update an existing one
   */
  storeInstallation: async (installation: Installation) => {
    const teamId = installation.team?.id;
    const enterpriseId = installation.enterprise?.id;

    if (!teamId && !enterpriseId) {
      throw new Error('Installation must have either teamId or enterpriseId');
    }

    const encryptionKey = getEncryptionKey();

    // Encrypt tokens before storage
    const encryptedBotToken = installation.bot?.token
      ? encrypt(installation.bot.token, encryptionKey)
      : '';

    const encryptedUserToken = installation.user?.token
      ? encrypt(installation.user.token, encryptionKey)
      : null;

    // Upsert workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        teamId: teamId || '',
        enterpriseId: enterpriseId || null,
        name: installation.team?.name || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: workspaces.teamId,
        set: {
          name: installation.team?.name || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Insert or update installation
    await db
      .insert(installations)
      .values({
        workspaceId: workspace.id,
        botToken: encryptedBotToken,
        botUserId: installation.bot?.userId || null,
        botScopes: installation.bot?.scopes?.join(',') || null,
        userToken: encryptedUserToken,
        userId: installation.user?.id || null,
        userScopes: installation.user?.scopes?.join(',') || null,
      })
      .onConflictDoUpdate({
        target: installations.workspaceId,
        set: {
          botToken: encryptedBotToken,
          botUserId: installation.bot?.userId || null,
          botScopes: installation.bot?.scopes?.join(',') || null,
          userToken: encryptedUserToken,
          userId: installation.user?.id || null,
          userScopes: installation.user?.scopes?.join(',') || null,
          installedAt: new Date(),
        },
      });
  },

  /**
   * Fetch an installation from the database
   */
  fetchInstallation: async (
    installQuery: InstallationQuery<boolean>
  ): Promise<Installation> => {
    const teamId = installQuery.teamId;
    const enterpriseId = installQuery.enterpriseId;

    if (!teamId && !enterpriseId) {
      throw new Error('InstallQuery must have either teamId or enterpriseId');
    }

    // Query installation with workspace
    const result = await db
      .select({
        installation: installations,
        workspace: workspaces,
      })
      .from(installations)
      .innerJoin(workspaces, eq(installations.workspaceId, workspaces.id))
      .where(
        enterpriseId
          ? and(
              eq(workspaces.teamId, teamId || ''),
              eq(workspaces.enterpriseId, enterpriseId)
            )
          : eq(workspaces.teamId, teamId || '')
      )
      .limit(1);

    if (result.length === 0) {
      throw new Error('Installation not found');
    }

    const { installation, workspace } = result[0];

    const encryptionKey = getEncryptionKey();

    // Decrypt tokens
    const botToken = installation.botToken
      ? decrypt(installation.botToken, encryptionKey)
      : '';

    const userToken = installation.userToken
      ? decrypt(installation.userToken, encryptionKey)
      : undefined;

    // Build the installation object
    const installationData: Installation = {
      team: {
        id: workspace.teamId,
        name: workspace.name || undefined,
      },
      enterprise: workspace.enterpriseId
        ? {
            id: workspace.enterpriseId,
          }
        : undefined,
      bot: {
        token: botToken,
        userId: installation.botUserId || '',
        scopes: installation.botScopes?.split(',') || [],
        id: installation.botUserId || '',
      },
      user: installation.userToken && userToken
        ? {
            token: userToken,
            id: installation.userId || '',
            scopes: installation.userScopes?.split(','),
          }
        : {
            token: undefined,
            id: installation.userId || '',
            scopes: installation.userScopes?.split(','),
          },
    };

    return installationData;
  },

  /**
   * Delete an installation (soft delete by marking inactive could be implemented)
   */
  deleteInstallation: async (
    installQuery: InstallationQuery<boolean>
  ): Promise<void> => {
    const teamId = installQuery.teamId;
    const enterpriseId = installQuery.enterpriseId;

    if (!teamId && !enterpriseId) {
      throw new Error('InstallQuery must have either teamId or enterpriseId');
    }

    // Find workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(
        enterpriseId
          ? and(eq(workspaces.teamId, teamId || ''), eq(workspaces.enterpriseId, enterpriseId))
          : eq(workspaces.teamId, teamId || '')
      )
      .limit(1);

    if (!workspace) {
      console.warn('Delete installation: workspace not found');
      return;
    }

    // Delete installation
    await db
      .delete(installations)
      .where(eq(installations.workspaceId, workspace.id));

    console.log(`Installation deleted for workspace ${workspace.teamId}`);
  },
};
