# Slack Marketplace Listing Content

## Short Description (75 char max)

AI response suggestions for difficult Slack messages. Only you see them.

## Long Description

**Stop agonizing over difficult workplace messages.**

Speak for Me is an AI assistant that helps you craft thoughtful, professional responses to challenging Slack conversations. Whether it's a frustrated client, a tricky HR situation, or a message you just don't know how to respond to — get an instant suggestion that matches your writing style.

**How it works:**

1. **Watch a conversation** — Use `/speakforme-watch` in any channel or DM to start receiving suggestions automatically.
2. **Get AI suggestions** — When someone messages you, Speak for Me privately suggests a response. Only you can see it.
3. **Review and send** — Copy the suggestion as-is, refine it until it's perfect, or dismiss it. You're always in control.

**On-demand help:** Right-click any message and select "Help me respond" to get a suggestion anytime — no watching required.

**Key features:**
- AI learns YOUR writing style over time — suggestions sound like you, not a robot
- Full conversation context — understands what's being discussed, not just the last message
- People context — remembers details about who you're talking to
- Weekly standup reports — `/speakforme-report` generates a summary of your week
- Task detection — `/speakforme-tasks` surfaces action items from your messages
- Suggestion refinement — iterate on suggestions with custom instructions

**Built for privacy:**
- All suggestions are ephemeral — only you can see them
- Messages are processed temporarily and never stored
- OAuth tokens encrypted with AES-256-GCM
- Full data cleanup on app uninstall
- We never send messages on your behalf

**Pricing:** Free tier includes 5 suggestions/month. Paid plans start at $9/month with a 14-day free trial. No credit card required to start.

Powered by Claude AI from Anthropic.

## Privacy Policy URL

https://speakforme.app/privacy

## Support Email

support@speakforme.app

## Supported Languages

English

## Pricing

Free to install (with paid plans starting at $9/month)

## Category

Productivity

## App Icon

Use existing `logo.png` (brushstroke "S", 512x512)

## Screenshots & Marketing Images

All located in `apps/web-portal/public/images/`:

| Image | File | Purpose |
|-------|------|---------|
| Hero banner | `slack-marketplace-hero.png` | Main listing header / promo banner |
| Suggestion in action | `slack-marketplace-screenshot-1.png` | Screenshot 1 — AI suggestion in Slack |
| Feature overview | `slack-marketplace-features.png` | Screenshot 2 — 3-step workflow |
| App Home tab | `slack-marketplace-apphome.png` | Screenshot 3 — App Home tab |
| Privacy & Security | `slack-marketplace-privacy.png` | Screenshot 4 — trust & security |
| Before / After | `slack-marketplace-before-after.png` | Screenshot 5 — stress vs confidence |
| Message Shortcut | `slack-marketplace-shortcut.png` | Screenshot 6 — "Help me respond" shortcut |

Compressed copies (1600x1000px, <2MB) for Slack upload in `slack-store/` subdirectory.

---

## Scope Justifications

### Bot Token Scopes

| Scope | Justification |
|-------|---------------|
| `app_mentions:read` | Detects when users @mention the bot to request an AI response suggestion for a message in the conversation. |
| `assistant:write` | Powers the Slack Assistant thread experience, allowing the app to respond in assistant threads when users ask for help. |
| `channels:history` | Reads recent conversation history in public channels to provide context-aware AI response suggestions. |
| `channels:read` | Retrieves channel metadata (name, topic) to give the AI better context when generating suggestions. |
| `chat:write` | Sends ephemeral (private) AI response suggestions that only the requesting user can see. |
| `commands` | Registers slash commands: /speakforme-watch, /speakforme-unwatch, /speakforme-report, and /speakforme-tasks. |
| `groups:history` | Reads recent conversation history in private channels to provide context-aware AI response suggestions. |
| `groups:read` | Retrieves private channel metadata (name, topic) to give the AI better context when generating suggestions. |
| `im:history` | Reads recent DM conversation history to provide context-aware AI response suggestions in direct messages. |
| `im:read` | Retrieves DM metadata to determine conversation context for generating relevant suggestions. |
| `mpim:history` | Reads recent group DM conversation history to provide context-aware AI response suggestions. |
| `usergroups:read` | Resolves user group mentions in messages so the AI understands who is being addressed in a conversation. |
| `users:read` | Retrieves display names and profiles to personalize AI suggestions and address people correctly. |

### User Token Scopes

| Scope | Justification |
|-------|---------------|
| `chat:write` | Allows users to send an AI-suggested response directly as their own message when they click "Send" on a suggestion. |

---

## Security & Data Questionnaire

### Data retention policy

Retention periods are tier-based and enforced by an automated data-retention job:
- **Free plan:** 7 days
- **Paid plans (Starter/Pro/Team/Business):** 90 days

After the retention period, suggestion feedback, guardrail violations, and audit logs are automatically purged. Message content used to generate suggestions is processed in-memory and never persisted beyond the request lifecycle. Deleted user accounts are fully purged within 30 days.

### Data archival/removal policy

Data is not archived — it is permanently deleted after the retention period expires. On app uninstall, the `app_uninstalled` event handler performs a full cleanup: all workspace-scoped data (installations, watched conversations, user preferences, suggestions, embeddings, feedback, tasks, contacts, escalations, guardrail violations) is hard-deleted. The workspace record itself is soft-deleted (marked inactive) for audit trail purposes. Users can also request individual data deletion through the GDPR self-service endpoint at any time.

### Data storage policy

All data is stored in a PostgreSQL 16 database with Row-Level Security (RLS) policies enforcing strict multi-tenant workspace isolation. OAuth tokens (Slack and Google) are encrypted at rest using AES-256-GCM with a 256-bit key and random per-record initialization vectors. Redis is used only as a transient job queue — no user data is persisted in Redis. All data in transit is encrypted with TLS 1.3.

### How do you host your data?

Cloud-hosted on DigitalOcean managed infrastructure in the Frankfurt region (EU). The application runs on DigitalOcean App Platform with a managed PostgreSQL database cluster and managed Redis instance.

### Data host company

DigitalOcean, LLC

### Do you have sub-processors?

Yes. The following sub-processors handle user data:

| Sub-processor | Purpose | Data processed |
|---------------|---------|----------------|
| **Anthropic** | AI response generation (Claude API) | Conversation context and message content (processed, not stored by Anthropic per their API terms) |
| **DigitalOcean** | Infrastructure hosting | All application and database data |
| **Stripe** | Payment processing | Billing email, subscription status, payment details |
| **Google** | Optional Sheets integration for weekly reports | Google OAuth tokens, spreadsheet data (only if user opts in) |

### The app exposes a Large Language Model (e.g. ChatGPT) to customers

Yes. Speak for Me uses Anthropic's Claude AI (claude-sonnet-4-20250514) to generate response suggestions. The LLM is not exposed directly — users interact with it only through structured features (response suggestions, weekly reports, task detection). A 4-layer prompt injection defense system is in place: input sanitization, prompt spotlighting, injection detection, and output filtering. Users cannot send arbitrary prompts to the model. All AI-generated content is clearly labeled as suggestions, and the app includes disclaimers that suggestions may not always be accurate.

### Are you HIPAA compliant?

No. Speak for Me is not HIPAA compliant and is not intended for use with protected health information (PHI). Our Terms of Service explicitly state the app should not be used to process or transmit healthcare data.

### What is your procedure for handling requests for data deletion?

Users can self-service data deletion through two methods:

1. **GDPR deletion endpoint** (`POST /api/gdpr/delete`) — Users confirm deletion by submitting `{ confirm: "DELETE MY ACCOUNT" }`. This triggers a transactional deletion of all personal data across all tables. Anonymized consent records are preserved for compliance audit trail. The action is logged with timestamp, IP address, and user agent.

2. **Email request** — Users can email privacy@speakforme.app to request data deletion. We process requests within 30 days per GDPR Article 17 (Right to Erasure).

3. **App uninstall** — When a workspace admin uninstalls the app, the `app_uninstalled` event triggers automatic deletion of all workspace data.

All deletion actions are logged in the audit trail for compliance verification.

---

## LLM & Third-Party Fields

| Field | Value |
|-------|-------|
| **LLM exposed** | Yes |
| **LLM model(s)** | Anthropic Claude Sonnet 4 (claude-sonnet-4-20250514) |
| **LLM data tenancy** | Single-tenant per workspace. Data isolated via PostgreSQL Row-Level Security. Conversation context sent to Anthropic per-request, not shared across tenants. |
| **LLM data residency** | EU. Database on DigitalOcean Frankfurt region. AI processing via Anthropic API (US). |
| **LLM retention settings** | Zero retention. Message content processed in-memory only. Anthropic does not retain API inputs/outputs per their API data policy. |
| **Third party services** | Anthropic (AI response generation), DigitalOcean (infrastructure hosting), Stripe (payment processing), Google (optional Sheets integration) |
| **Sub-processors URL** | https://speakforme.app/sub-processors |
| **GDPR commitment URL** | https://speakforme.app/gdpr |
| **SSO support** | Yes. Users authenticate via Slack OAuth (Sign in with Slack). No separate username/password login. |
| **SAML support** | No. Authentication is handled entirely through Slack OAuth. The app inherits the workspace's existing identity provider through Slack. |
| **Third party auths required** | No. Only Slack OAuth is required for core functionality. Google OAuth is optional, used only if a user enables the Google Sheets integration for weekly reports. |

---

## Test Account Details

No account or login is required. The app authenticates entirely through Slack OAuth — installing it via "Add to Slack" creates the account automatically.

All features work immediately after installation on the Free plan (5 AI suggestions/month). No paid account or trial activation needed.

If you need to test paid features (higher suggestion limits, refinement), contact support@speakforme.app and we'll apply a test coupon to your workspace for extended access.

---

## How to Test Your App

After installing Speak for Me to your workspace:

### 1. Open the App Home
- Click "Speak for Me" in your Apps sidebar
- You should see a welcome message, getting started steps, and available commands

### 2. Watch a Conversation
- Go to any channel the bot has been invited to
- Type: `/speakforme-watch`
- You should see an ephemeral confirmation: "Now watching this conversation"

### 3. Get an AI Suggestion
- Have another workspace member send a message in that watched channel
- You should receive a private (ephemeral) AI-suggested response
- Only you can see the suggestion — it includes "Copy", "Refine", and "Dismiss" buttons

### 4. Use the Message Shortcut (on-demand)
- Right-click (or hover and click "More actions") on any message
- Select "Help me respond"
- You should receive a private AI suggestion for that specific message

### 5. Test Help Text
- In any channel, type: `/speakforme-watch help`
- You should see usage instructions
- Also try: `/speakforme-report help` and `/speakforme-tasks help`

### 6. Unwatch a Conversation
- Type: `/speakforme-unwatch`
- Suggestions will stop for that conversation

### 7. Generate a Standup Report
- Type: `/speakforme-report`
- The bot generates a weekly summary based on your recent Slack activity

### 8. View Detected Tasks
- Type: `/speakforme-tasks`
- Shows action items automatically detected from your messages

### Main Functionality
- AI response suggestions delivered as ephemeral messages (only visible to the requesting user)
- Automatic suggestions in watched conversations
- On-demand suggestions via message shortcut ("Help me respond")
- Suggestion refinement — click "Refine" to iterate with custom instructions
- Weekly standup report generation
- Automatic task/action item detection from messages
- AI learns user's writing style over time

### Notes for Reviewers
- The bot must be invited to a channel before it can read messages there
- Suggestions require at least one other person to send a message (the bot doesn't suggest responses to your own messages)
- All suggestions are ephemeral — they disappear on reload and are never visible to others
- The app uses Claude AI by Anthropic for suggestion generation
