# Phase 05: Weekly Reports - Research

**Researched:** 2026-01-27
**Domain:** Google Sheets API integration, Slack workflow monitoring, scheduled job execution
**Confidence:** HIGH

## Summary

Phase 05 integrates Google Sheets API to automate weekly team report generation from Slack workflow form submissions. The standard approach combines Google's OAuth 2.0 user authentication (for individual user Sheets access), the official googleapis Node.js library for reading/writing spreadsheet data, and BullMQ's job schedulers for cron-based report generation.

**Key architectural insights:**
- Slack native workflow forms post messages to channels that apps monitor using standard message events
- Google OAuth requires full read/write scope (`spreadsheets`) for writing submissions and reading aggregated data
- Token encryption follows existing AES-256-GCM pattern already implemented in codebase
- BullMQ's new Job Schedulers API (v5.16+) replaces deprecated repeatable jobs pattern
- Slash commands provide manual trigger capability with 3-second acknowledgment + delayed response via response_url

**Primary recommendation:** Use OAuth user authentication (not service accounts) since users need to connect their personal Google Sheets, leverage existing encryption infrastructure for token storage, and implement upsertJobScheduler for cron-based scheduling with proper timezone handling.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | 105+ | Official Google Sheets API client | Official SDK, comprehensive API coverage, maintained by Google |
| @google-cloud/local-auth | 2.1.0+ | OAuth 2.0 authentication flow | Simplifies OAuth consent flow, token persistence |
| BullMQ | 5.28.2+ | Job scheduling (cron-based reports) | Already in project, Job Schedulers API for cron (v5.16+) |
| @slack/bolt | 3.22.0+ | Slash command handling | Already in project, native slash command support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0+ | Timezone calculations | Already in project, for schedule configuration |
| crypto (Node.js) | Built-in | Token encryption (AES-256-GCM) | Already implemented for Slack OAuth tokens |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| googleapis | node-google-spreadsheet | Cleaner API but less comprehensive, loses official support advantage |
| googleapis | google-spreadsheet (samcday) | Older, less maintained alternative |
| OAuth user auth | Service account | Wrong use case - users need access to their own Sheets, not shared bot Sheets |
| BullMQ schedulers | node-cron | Loses queue persistence, retry logic, and existing infrastructure |

**Installation:**
```bash
npm install googleapis @google-cloud/local-auth
# BullMQ, @slack/bolt already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/slack-backend/src/
├── handlers/
│   ├── commands/
│   │   └── generate-report.ts    # Slash command handler
│   └── events/
│       └── workflow-submission.ts # Monitor channel for workflow forms
├── services/
│   ├── google-sheets.ts           # Sheets read/write operations
│   └── report-generator.ts        # AI summarization logic
├── oauth/
│   └── google-oauth.ts            # Google OAuth flow handler
└── jobs/
    └── scheduled-reports.ts       # BullMQ job scheduler setup
```

### Pattern 1: Google OAuth Token Storage
**What:** Store Google OAuth tokens using existing encryption infrastructure
**When to use:** For all Google API credentials requiring user authorization
**Example:**
```typescript
// Reuse existing encryption pattern from oauth/installation-store.ts
import { encrypt, decrypt } from '@slack-speak/database';
import { getEncryptionKey } from '../env.js';

// Store tokens in new googleIntegrations table
const encryptedAccessToken = encrypt(tokens.access_token, getEncryptionKey());
const encryptedRefreshToken = tokens.refresh_token
  ? encrypt(tokens.refresh_token, getEncryptionKey())
  : null;

await db.insert(googleIntegrations).values({
  workspaceId,
  userId,
  accessToken: encryptedAccessToken,
  refreshToken: encryptedRefreshToken,
  expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  scope: tokens.scope,
});
```
**Source:** Existing pattern in [installation-store.ts](https://github.com/slackapi/bolt-js), [AES-256-GCM implementation](https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81)

### Pattern 2: Slack Workflow Form Detection
**What:** Monitor designated channel for messages posted by Workflow Builder bot
**When to use:** To capture native Slack workflow form submissions
**Example:**
```typescript
// Listen for message.channels events
app.event('message', async ({ event, client }) => {
  // Filter for workflow submissions
  if (event.subtype === 'bot_message' &&
      event.bot_id &&
      isWorkflowSubmission(event)) {

    // Parse structured workflow data from message blocks
    const formData = parseWorkflowSubmission(event);

    // Write to Google Sheets asynchronously
    await googleSheetsService.appendRow(formData);
  }
});

function isWorkflowSubmission(event: MessageEvent): boolean {
  // Workflow submissions have specific block structure
  return event.blocks?.some(block =>
    block.type === 'rich_text' || block.type === 'section'
  );
}
```
**Source:** [message.channels event documentation](https://api.slack.com/events/message.channels), [Slack Forms Guide 2026](https://clearfeed.ai/blogs/slack-forms-guide)

### Pattern 3: BullMQ Job Schedulers (v5.16+)
**What:** Use upsertJobScheduler for cron-based scheduled reports
**When to use:** For user-configured report generation schedules
**Example:**
```typescript
// Create or update scheduler based on user settings
await reportQueue.upsertJobScheduler(
  `report-scheduler-${workspaceId}-${userId}`, // Unique scheduler ID
  {
    pattern: '0 9 * * 1', // Cron: Every Monday at 9 AM
    tz: settings.timezone // User's timezone
  },
  {
    name: 'generate-weekly-report',
    data: { workspaceId, userId, reportSettingsId: settings.id },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  },
);
```
**Source:** [BullMQ Job Schedulers Guide](https://docs.bullmq.io/guide/job-schedulers)

### Pattern 4: Slash Command with Delayed Response
**What:** Acknowledge slash command within 3 seconds, use response_url for delayed processing
**When to use:** For manual report generation that may take >3 seconds
**Example:**
```typescript
app.command('/generate-report', async ({ command, ack, respond }) => {
  // Acknowledge immediately (within 3 seconds)
  await ack();

  try {
    // Queue async processing
    await reportQueue.add('generate-report', {
      workspaceId,
      userId: command.user_id,
      responseUrl: command.response_url, // For delayed response
    });

    // Send ephemeral acknowledgment
    await respond({
      response_type: 'ephemeral',
      text: 'Generating report... I\'ll send it to you when ready.',
    });
  } catch (error) {
    await respond({
      response_type: 'ephemeral',
      text: 'Failed to start report generation. Please try again.',
    });
  }
});
```
**Source:** [Slack Slash Commands Guide](https://docs.slack.dev/interactivity/implementing-slash-commands), [Delayed Responses](https://claudiajs.com/tutorials/slack-delayed-responses.html)

### Pattern 5: Google Sheets Batch Operations
**What:** Use spreadsheets.values.append for writing rows, values.batchGet for reading ranges
**When to use:** For efficient data operations avoiding rate limits
**Example:**
```typescript
// Append submission to sheet
await sheets.spreadsheets.values.append({
  auth,
  spreadsheetId: settings.spreadsheetId,
  range: 'Weekly Updates!A:E',
  valueInputOption: 'USER_ENTERED',
  resource: {
    values: [[
      new Date().toISOString(),
      submitter.name,
      formData.achievements,
      formData.focus,
      formData.blockers,
    ]],
  },
});

// Read all submissions for aggregation (batch read)
const result = await sheets.spreadsheets.values.batchGet({
  auth,
  spreadsheetId: settings.spreadsheetId,
  ranges: ['Weekly Updates!A2:E'], // Skip header row
});
```
**Source:** [Google Sheets batchUpdate Guide](https://developers.google.com/sheets/api/guides/batchupdate), [Node.js samples](https://github.com/googleworkspace/node-samples/blob/main/sheets/snippets/sheets_batch_update_values.js)

### Anti-Patterns to Avoid
- **Writing one cell at a time:** Use append with full rows instead - avoids rate limits and improves performance
- **Polling Google Sheets for changes:** Listen to Slack workflow submissions instead - event-driven is more efficient
- **Service account authentication:** Use OAuth user authentication - users need access to their own Sheets
- **Hardcoded cron expressions:** Store in database with timezone - allows per-user configuration
- **Synchronous report generation in slash command:** Queue async job - avoids 3-second timeout

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 flow | Custom redirect handlers | @google-cloud/local-auth | Handles PKCE, state validation, token refresh automatically |
| Cron scheduling | Custom setInterval logic | BullMQ Job Schedulers | Persistent across restarts, timezone-aware, handles failures |
| Token refresh | Manual expiry checks | googleapis auto-refresh | Built into OAuth2Client, handles refresh token rotation |
| Exponential backoff | Custom retry logic | BullMQ backoff options | Configurable, tested, handles rate limit errors |
| Spreadsheet parsing | Regex on message text | Slack Block Kit parsing | Structured data access, handles formatting correctly |
| Rate limit handling | Manual sleep/retry | googleapis quotas + BullMQ | Official client has built-in retry, queue prevents overwhelming API |

**Key insight:** Google Sheets API has numerous edge cases (rate limits, token refresh, quota management) that the official SDK handles. Custom OAuth flows are security-critical and prone to vulnerabilities. BullMQ's scheduler handles timezone conversions and persistence that are error-prone when hand-rolled.

## Common Pitfalls

### Pitfall 1: OAuth Token Refresh Timing
**What goes wrong:** Access tokens expire after ~30 minutes, causing API calls to fail if not refreshed
**Why it happens:** Developers store tokens but don't implement refresh logic
**How to avoid:**
- Use googleapis OAuth2Client which auto-refreshes tokens
- Store both access_token and refresh_token (encrypted)
- Handle token refresh events to update database
**Warning signs:** Intermittent "401 Unauthorized" errors ~30 minutes after OAuth
**Example:**
```typescript
// OAuth2Client handles refresh automatically
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
oauth2Client.setCredentials({
  access_token: decryptedAccessToken,
  refresh_token: decryptedRefreshToken,
});

// Listen for token refresh to update database
oauth2Client.on('tokens', async (tokens) => {
  if (tokens.refresh_token) {
    // Update stored refresh token
    await updateGoogleTokens(userId, tokens);
  }
});
```

### Pitfall 2: Workflow Submission Detection
**What goes wrong:** App receives all channel messages, not just workflow submissions, leading to false positives
**Why it happens:** Workflow submissions appear as regular bot messages without special event type
**How to avoid:**
- Filter by bot_id to identify workflow bot
- Parse message blocks structure to confirm workflow format
- Validate expected field structure before processing
- Store workflow configuration (which bot_id to watch for)
**Warning signs:** Non-workflow messages trigger report processing, duplicate entries
**Example:**
```typescript
// Configuration: Store workflow bot_id when user sets up integration
const workflowConfig = {
  workspaceId,
  userId,
  channelId: 'C123456',
  workflowBotId: 'B987654', // Identified during setup
  expectedFields: ['achievements', 'focus', 'blockers', 'shoutouts'],
};

// Detection: Validate message matches workflow
if (event.bot_id === workflowConfig.workflowBotId &&
    event.channel === workflowConfig.channelId &&
    hasExpectedFields(event.blocks, workflowConfig.expectedFields)) {
  // Process as workflow submission
}
```

### Pitfall 3: Google Sheets API Rate Limits
**What goes wrong:** App exceeds 300 read requests per minute per project, receiving 429 errors
**Why it happens:** Writing each submission immediately without batching, or reading entire sheet repeatedly
**How to avoid:**
- Use append operations (not individual cell updates)
- Batch read operations when aggregating for reports
- Implement exponential backoff for 429 errors
- Cache spreadsheet metadata (don't refetch on every operation)
**Warning signs:** 429 Too Many Requests errors, slow submission processing during high activity
**Example:**
```typescript
// BullMQ rate limiter configuration
const sheetsQueue = new Queue('sheets-operations', {
  connection: redis,
  limiter: {
    max: 60, // 60 operations
    duration: 60000, // per minute (well below 300/min limit)
  },
});

// Exponential backoff for rate limit errors
const job = await sheetsQueue.add('append-row', data, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000, // Start with 2s, exponentially increase
  },
});
```

### Pitfall 4: Timezone Handling in Scheduled Reports
**What goes wrong:** Reports generate at wrong time because cron runs in UTC while user expects local time
**Why it happens:** BullMQ defaults to UTC; storing time without timezone context
**How to avoid:**
- Store user's timezone in reportSettings
- Pass timezone to BullMQ scheduler via `tz` option
- Display schedule confirmation in user's local time
- Handle DST transitions correctly (BullMQ handles this with tz option)
**Warning signs:** Users report receiving reports at incorrect times, confusion about schedule
**Example:**
```typescript
// Store timezone in settings
const reportSettings = {
  dayOfWeek: 1, // Monday
  timeOfDay: '09:00', // 9 AM
  timezone: 'America/New_York', // User's timezone
};

// Create scheduler with timezone
await reportQueue.upsertJobScheduler(
  schedulerId,
  {
    pattern: '0 9 * * 1', // 9 AM every Monday
    tz: reportSettings.timezone, // BullMQ converts to UTC internally
  },
  jobOptions
);
```

### Pitfall 5: OAuth Scope Creep
**What goes wrong:** Requesting broader permissions than needed (e.g., all Google Drive access instead of just Sheets)
**Why it happens:** Using convenient high-level scopes without checking minimal requirements
**How to avoid:**
- Use `https://www.googleapis.com/auth/spreadsheets` (not `drive` or `drive.file`)
- Request only read-only scope if write not needed (but this phase needs write)
- Display clear permission explanation to users during OAuth
**Warning signs:** Users decline OAuth due to excessive permissions, Google security warnings
**Correct scopes:**
```typescript
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets', // Full Sheets read/write
  // NOT 'https://www.googleapis.com/auth/drive' - too broad
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Get refresh token
  scope: REQUIRED_SCOPES,
  prompt: 'consent', // Force consent to get refresh token
});
```

### Pitfall 6: Missing Channel Permissions
**What goes wrong:** App can't receive message events from designated channel
**Why it happens:** Bot not added to channel, or missing channels:history scope
**How to avoid:**
- Require channels:history scope in Slack app manifest
- Validate bot membership when user configures channel
- Provide clear instructions for adding bot to channel
- Handle permission errors gracefully with user-facing messages
**Warning signs:** Silent failures, workflow submissions not detected
**Example:**
```typescript
// Validate bot is in channel before saving configuration
try {
  const channelInfo = await client.conversations.info({
    channel: channelId,
  });

  if (!channelInfo.channel.is_member) {
    throw new Error(`Please add the bot to #${channelInfo.channel.name} first`);
  }
} catch (error) {
  if (error.data?.error === 'channel_not_found') {
    throw new Error('Channel not found. Make sure the bot is added to the channel.');
  }
  throw error;
}
```

## Code Examples

Verified patterns from official sources:

### Google OAuth 2.0 Setup with Token Refresh
```typescript
// Source: https://developers.google.com/identity/protocols/oauth2/web-server
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://your-app.com/oauth/google/callback'
);

// Generate auth URL for user consent
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Required for refresh token
  scope: ['https://www.googleapis.com/auth/spreadsheets'],
  prompt: 'consent', // Force consent to ensure refresh token
});

// Exchange authorization code for tokens
const { tokens } = await oauth2Client.getToken(authorizationCode);
oauth2Client.setCredentials(tokens);

// Listen for automatic token refresh
oauth2Client.on('tokens', async (refreshedTokens) => {
  // Update database with new tokens
  await updateStoredTokens(userId, refreshedTokens);
});
```

### BullMQ Job Scheduler with Timezone
```typescript
// Source: https://docs.bullmq.io/guide/job-schedulers
import { Queue } from 'bullmq';

const reportQueue = new Queue('weekly-reports', { connection: redis });

// Upsert prevents duplicate schedulers
await reportQueue.upsertJobScheduler(
  `report-${workspaceId}-${userId}`, // Unique ID
  {
    pattern: '0 9 * * 1', // Monday 9 AM
    tz: 'America/New_York', // User timezone
  },
  {
    name: 'generate-report',
    data: { workspaceId, userId },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  }
);

// Remove scheduler when user disables
await reportQueue.removeJobScheduler(`report-${workspaceId}-${userId}`);
```

### Google Sheets Append Operation
```typescript
// Source: https://developers.google.com/sheets/api/quickstart/nodejs
import { google } from 'googleapis';

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

await sheets.spreadsheets.values.append({
  spreadsheetId: 'your-spreadsheet-id',
  range: 'Weekly Updates!A:E', // Append to columns A-E
  valueInputOption: 'USER_ENTERED', // Parse formulas/formatting
  insertDataOption: 'INSERT_ROWS', // Insert new rows
  resource: {
    values: [[
      new Date().toISOString(),
      'John Doe',
      'Shipped feature X',
      'Working on feature Y',
      'Blocked by API access',
    ]],
  },
});
```

### Slack Slash Command Handler
```typescript
// Source: https://docs.slack.dev/interactivity/implementing-slash-commands
app.command('/generate-report', async ({ command, ack, client, respond }) => {
  await ack(); // Must respond within 3 seconds

  try {
    // Validate user has Google Sheets connected
    const integration = await getGoogleIntegration(command.user_id);
    if (!integration) {
      return await respond({
        response_type: 'ephemeral',
        text: 'Please connect your Google account first: /setup-reports',
      });
    }

    // Queue async report generation
    await reportQueue.add('manual-report', {
      workspaceId,
      userId: command.user_id,
      responseUrl: command.response_url,
    });

    await respond({
      response_type: 'ephemeral',
      text: '🔄 Generating your weekly report... I\'ll send it shortly.',
    });
  } catch (error) {
    logger.error({ error, userId: command.user_id }, 'Failed to queue report');
    await respond({
      response_type: 'ephemeral',
      text: '❌ Failed to start report generation. Please try again.',
    });
  }
});
```

### Workflow Submission Parsing
```typescript
// Source: https://api.slack.com/events/message.channels
app.event('message', async ({ event, client }) => {
  // Filter for workflow bot messages in monitored channel
  if (event.subtype !== 'bot_message' || !event.bot_id) return;

  const config = await getWorkflowConfig(event.channel);
  if (!config || event.bot_id !== config.workflowBotId) return;

  // Parse structured data from blocks
  const formData = parseWorkflowBlocks(event.blocks);
  if (!formData) return;

  // Queue write to Google Sheets (async, rate-limited)
  await sheetsQueue.add('append-submission', {
    workspaceId: config.workspaceId,
    userId: config.userId,
    spreadsheetId: config.spreadsheetId,
    submission: {
      timestamp: new Date(parseFloat(event.ts) * 1000),
      submitter: await getUserName(client, event.bot_id),
      ...formData,
    },
  });
});

function parseWorkflowBlocks(blocks: any[]): WorkflowSubmission | null {
  // Workflow forms use rich_text or section blocks
  const textBlocks = blocks.filter(b =>
    b.type === 'rich_text' || b.type === 'section'
  );

  // Extract field values based on expected structure
  // This is workflow-specific and needs configuration
  return {
    achievements: extractField(textBlocks, 'achievements'),
    focus: extractField(textBlocks, 'focus'),
    blockers: extractField(textBlocks, 'blockers'),
    shoutouts: extractField(textBlocks, 'shoutouts'),
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ repeatable jobs | Job Schedulers (upsertJobScheduler) | BullMQ v5.16.0 (2023) | More robust, prevents duplicates, better timezone handling |
| Service account auth | OAuth user authentication | 2020+ best practice | Users access their own Sheets, better UX, proper permissions |
| Manual token refresh | OAuth2Client auto-refresh | Always recommended | Prevents token expiry failures, handles rotation |
| REST API direct | googleapis npm library | Standard since v105 | Auto-retry, rate limiting, type safety |
| Custom cron implementations | BullMQ with timezone support | BullMQ v3+ | Persistent, handles DST, survives restarts |
| OAuth 2.0 implicit flow | Authorization Code + PKCE | OAuth 2.1 (2026) | More secure, prevents token interception |

**Deprecated/outdated:**
- **BullMQ repeatable jobs API:** Use Job Schedulers instead (upsertJobScheduler) - old API being phased out
- **OAuth implicit flow:** Use authorization code flow with PKCE - implicit flow removed in OAuth 2.1
- **Google Sheets API v3:** Use v4 - v3 deprecated, lacks features
- **@google-cloud/local-auth for production:** Appropriate for testing only - implement custom OAuth flow with proper error handling for production

## Open Questions

Things that couldn't be fully resolved:

1. **Workflow Bot ID Detection**
   - What we know: Workflow submissions appear as bot_message events with bot_id
   - What's unclear: Whether bot_id is stable across workflow edits, or if it changes when workflow is modified
   - Recommendation: During setup, have user trigger test submission to capture bot_id; implement fallback matching on message structure if bot_id changes

2. **Workflow Form Structure Variability**
   - What we know: Forms use Block Kit (rich_text, section blocks) with field labels
   - What's unclear: How much structure varies based on workflow configuration (custom fields, conditional logic)
   - Recommendation: Implement flexible parser that extracts fields by label matching; allow user to map workflow fields to expected schema during setup; validate parsed data before writing to Sheets

3. **Google Sheets Spreadsheet ID Discovery**
   - What we know: Users need to provide spreadsheet ID from URL or sharing settings
   - What's unclear: Whether Drive API integration would improve UX for spreadsheet selection (list user's Sheets)
   - Recommendation: Start with manual spreadsheet ID input (simplest, no additional scope); consider Drive API listing in future iteration if user feedback indicates confusion

4. **Report Delivery Method**
   - What we know: Requirements specify "DM for review" but also mention "ephemeral message"
   - What's unclear: Whether draft should be ephemeral in monitored channel, DM message, or modal
   - Recommendation: Use DM with interactive message blocks (approve/refine buttons); preserves draft across sessions, keeps channel clean, allows longer content than ephemeral

5. **Concurrent Workflow Submission Handling**
   - What we know: Multiple team members may submit simultaneously, each triggering Sheets write
   - What's unclear: Whether Google Sheets API handles concurrent appends gracefully or needs application-level locking
   - Recommendation: Queue all Sheets operations through BullMQ with concurrency: 1 for writes to same spreadsheet; Google Sheets supports concurrent writes but queueing provides retry logic and rate limit protection

## Sources

### Primary (HIGH confidence)
- [Google Sheets API Node.js Quickstart](https://developers.google.com/sheets/api/quickstart/nodejs) - Official authentication and API usage
- [Google Sheets API batchUpdate Guide](https://developers.google.com/sheets/api/guides/batchupdate) - Write operations and best practices
- [Google Sheets API Usage Limits](https://developers.google.com/workspace/sheets/api/limits) - Rate limits and quotas (updated 2026-01-26)
- [Google OAuth 2.0 Scopes](https://developers.google.com/workspace/sheets/api/scopes) - Permission scope reference
- [BullMQ Job Schedulers](https://docs.bullmq.io/guide/job-schedulers) - Cron scheduling with timezone support
- [BullMQ Repeatable Jobs](https://docs.bullmq.io/guide/jobs/repeatable) - Scheduler documentation
- [Slack Slash Commands](https://docs.slack.dev/interactivity/implementing-slash-commands) - Command registration and handling
- [Slack Message Events](https://api.slack.com/events/message.channels) - Event subscription for channel monitoring
- [Google OAuth 2.0 Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) - Token storage and refresh

### Secondary (MEDIUM confidence)
- [Better Stack BullMQ Guide](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/) - Job scheduling tutorial (2026)
- [OneUpTime BullMQ Redis Guide](https://oneuptime.com/blog/post/2026-01-06-nodejs-job-queue-bullmq-redis/view) - Queue setup patterns (2026-01-06)
- [AES-256-GCM Example](https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81) - Node.js crypto implementation
- [OAuth 2.1 Features 2026](https://rgutierrez2004.medium.com/oauth-2-1-features-you-cant-ignore-in-2026-a15f852cb763) - Security updates (Jan 2026)
- [node-google-spreadsheet Authentication](https://github.com/theoephraim/node-google-spreadsheet/blob/main/docs/guides/authentication.md) - Alternative library patterns
- [Slack Forms Guide 2026](https://clearfeed.ai/blogs/slack-forms-guide) - Workflow Builder forms overview

### Tertiary (LOW confidence - marked for validation)
- [3 Approaches to Google Sheets API](https://blog.stephsmith.io/tutorial-google-sheets-api-node-js/) - Tutorial comparing approaches (date unclear)
- [Delayed Slack Responses](https://claudiajs.com/tutorials/slack-delayed-responses.html) - response_url usage patterns
- Workflow form submission structure - No definitive documentation found for native Workflow Builder form event payload structure in Bolt apps; requires testing and validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official libraries verified via Context7 equivalent (official docs), versions confirmed
- Architecture: HIGH - Patterns based on official documentation and existing codebase conventions
- Pitfalls: MEDIUM-HIGH - Rate limits and OAuth refresh verified in official docs; workflow detection needs testing
- Workflow submission parsing: LOW - Native Slack workflow event structure not fully documented for Bolt; requires validation

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable domain with established libraries)

**Notes:**
- Existing codebase already implements AES-256-GCM encryption for OAuth tokens (packages/database/src/encryption.ts)
- BullMQ already configured with Redis connection (apps/slack-backend/src/jobs/connection.ts)
- Slash command handler directory exists (apps/slack-backend/src/handlers/commands/)
- reportSettings table already exists in schema with all required fields
- OAuth 2.1 becoming standard in 2026 - Authorization Code + PKCE mandatory
