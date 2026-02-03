import { db, organizations, clientProfiles, clientContacts, workspaces, installations, decrypt } from '@slack-speak/database';
import { eq, and, isNotNull } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { analyzeSentiment, triggerEscalationAlert } from '../services/index.js';
import { getEncryptionKey } from '../env.js';
import { WebClient } from '@slack/web-api';
import type { EscalationScanJobResult } from './types.js';

/**
 * Scan for escalations in client conversations
 *
 * Background job that runs every 15 minutes to detect high-risk client messages
 * that might have been missed by real-time detection (e.g., messages sent while
 * user didn't have the app watching that conversation).
 */
export async function scanForEscalations(): Promise<EscalationScanJobResult> {
  const startTime = Date.now();
  let organizationsScanned = 0;
  let alertsCreated = 0;

  try {
    logger.info('Starting escalation scan');

    // Query organizations with active subscriptions
    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        subscriptionStatus: organizations.subscriptionStatus,
      })
      .from(organizations)
      .where(eq(organizations.subscriptionStatus, 'active'));

    logger.info({ organizationCount: orgs.length }, 'Found organizations to scan');

    for (const org of orgs) {
      try {
        organizationsScanned++;

        // Get client contacts for this org
        const contacts = await db
          .select({
            clientProfileId: clientContacts.clientProfileId,
            workspaceId: clientContacts.workspaceId,
            slackUserId: clientContacts.slackUserId,
          })
          .from(clientContacts)
          .innerJoin(clientProfiles, eq(clientContacts.clientProfileId, clientProfiles.id))
          .where(eq(clientProfiles.organizationId, org.id));

        if (contacts.length === 0) {
          continue;
        }

        logger.debug(
          { organizationId: org.id, contactCount: contacts.length },
          'Scanning client contacts'
        );

        // For each client contact, check recent messages
        for (const contact of contacts) {
          try {
            // Get bot token for this workspace
            const [inst] = await db
              .select({ installation: installations, workspace: workspaces })
              .from(installations)
              .innerJoin(workspaces, eq(installations.workspaceId, workspaces.id))
              .where(eq(workspaces.id, contact.workspaceId))
              .limit(1);

            if (!inst) {
              logger.debug(
                { workspaceId: contact.workspaceId },
                'No installation found for workspace'
              );
              continue;
            }

            const encKey = getEncryptionKey();
            const botToken = decrypt(inst.installation.botToken, encKey);
            const client = new WebClient(botToken);

            // Fetch recent DM/conversation history with this client contact
            // We'll check the last 4 hours of messages (matching cooldown window)
            const fourHoursAgo = Math.floor((Date.now() - 4 * 60 * 60 * 1000) / 1000);

            try {
              // Get conversations.history for DM channel with client
              // First, open/find the DM channel
              const dmResult = await client.conversations.open({
                users: contact.slackUserId,
              });

              const channelId = dmResult.channel?.id;
              if (!channelId) {
                continue;
              }

              // Fetch recent messages
              const history = await client.conversations.history({
                channel: channelId,
                oldest: fourHoursAgo.toString(),
                limit: 20, // Check last 20 messages max
              });

              if (!history.messages || history.messages.length === 0) {
                continue;
              }

              // Filter to messages from the client contact (not bot)
              const clientMessages = history.messages.filter(
                msg => msg.user === contact.slackUserId && msg.text
              );

              if (clientMessages.length === 0) {
                continue;
              }

              // Analyze sentiment on the most recent client message
              const latestMessage = clientMessages[0];
              if (!latestMessage.text) {
                continue;
              }

              // Build conversation context (last 5 messages)
              const contextMessages = history.messages.slice(0, 5).map(msg => ({
                userId: msg.user || 'unknown',
                text: msg.text || '',
                ts: msg.ts || '',
              }));

              const sentiment = await analyzeSentiment({
                conversationMessages: contextMessages,
                targetMessage: latestMessage.text,
              });

              // Trigger alert on high or critical risk
              if (sentiment.riskLevel === 'high' || sentiment.riskLevel === 'critical') {
                const alertId = await triggerEscalationAlert({
                  organizationId: org.id,
                  workspaceId: contact.workspaceId,
                  clientProfileId: contact.clientProfileId,
                  channelId,
                  messageTs: latestMessage.ts || '',
                  sentiment,
                });

                if (alertId) {
                  alertsCreated++;
                  logger.info(
                    {
                      alertId,
                      organizationId: org.id,
                      channelId,
                      riskLevel: sentiment.riskLevel,
                    },
                    'Escalation alert created by scanner'
                  );
                }
              }
            } catch (slackError: any) {
              // Slack API errors are expected (e.g., channel not found, permissions)
              // Log at debug level and continue
              logger.debug(
                {
                  error: slackError.message || slackError,
                  slackUserId: contact.slackUserId,
                  workspaceId: contact.workspaceId,
                },
                'Slack API error during escalation scan (skipping contact)'
              );
            }
          } catch (contactError) {
            logger.warn(
              { error: contactError, contact },
              'Error scanning individual contact'
            );
          }
        }
      } catch (orgError) {
        logger.warn(
          { error: orgError, organizationId: org.id },
          'Error scanning organization'
        );
      }
    }

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      { organizationsScanned, alertsCreated, processingTimeMs },
      'Escalation scan complete'
    );

    return {
      organizationsScanned,
      alertsCreated,
    };
  } catch (error) {
    logger.error({ error }, 'Escalation scan failed');
    throw error;
  }
}
