import type { App } from '@slack/bolt';
import { logger } from '../../utils/logger.js';

const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || 'https://speakforme.app';

/**
 * Register handler for the App Home tab.
 * Publishes a view with getting started info, commands, and support links.
 */
export function registerAppHomeHandler(app: App): void {
  app.event('app_home_opened', async ({ event, client }) => {
    try {
      // Only publish for the "home" tab, not "messages"
      if (event.tab !== 'home') return;

      await client.views.publish({
        user_id: event.user,
        view: {
          type: 'home',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: 'Welcome to Speak for Me',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'AI-powered response suggestions for workplace messages. Get suggestions delivered privately, refine them to match your style, and send with confidence.',
              },
            },
            { type: 'divider' },
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: 'Getting Started',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: [
                  '*1.* Use `/speakforme-watch` in any channel to start receiving AI suggestions',
                  '*2.* When someone messages you in a watched channel, you\'ll get a private suggestion',
                  '*3.* Review, refine, or dismiss — you\'re always in control',
                  '*4.* Right-click any message and choose *"Help me respond"* for on-demand suggestions',
                ].join('\n'),
              },
            },
            { type: 'divider' },
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: 'Commands',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: [
                  '`/speakforme-watch` — Enable AI suggestions for a conversation',
                  '`/speakforme-unwatch` — Disable AI suggestions for a conversation',
                  '`/speakforme-report` — Generate your weekly standup report',
                  '`/speakforme-tasks` — View pending tasks detected from messages',
                  '',
                  'Type `help` after any command for usage details.',
                ].join('\n'),
              },
            },
            { type: 'divider' },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Need Help?*\nVisit our <${WEB_PORTAL_URL}/support|support page> or email support@speakforme.app`,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `AI-generated suggestions may not always be accurate. Always review before sending. | <${WEB_PORTAL_URL}/privacy|Privacy Policy>`,
                },
              ],
            },
          ],
        },
      });

      logger.debug({ user: event.user }, 'App Home view published');
    } catch (error) {
      logger.error({ error, user: event.user }, 'Error publishing App Home view');
    }
  });
}
