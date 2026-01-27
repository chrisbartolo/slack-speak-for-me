# Slack Speak for Me

AI-powered Slack integration that helps professionals craft contextually-aware responses to challenging workplace messages.

## Features

- **Smart Response Suggestions**: Get AI-generated response suggestions via ephemeral messages when mentioned or replied to
- **Context-Aware**: AI considers full conversation context and your communication style
- **Refinement Modal**: Iterate on suggestions through back-and-forth with AI
- **Style Learning**: AI learns from your message history, explicit guidance, and feedback
- **Weekly Reports**: Automate team report aggregation from Slack workflow submissions

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development without Docker)
- A Slack app created at https://api.slack.com/apps

### 1. Configure Environment

```bash
# Copy the Docker environment template
cp .env.docker .env

# Generate required secrets
openssl rand -hex 32  # Use for ENCRYPTION_KEY
openssl rand -hex 32  # Use for SLACK_STATE_SECRET
```

Edit `.env` with your credentials:
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` from your Slack app
- `ANTHROPIC_API_KEY` from https://console.anthropic.com

### 2. Start Development Environment

```bash
# Start PostgreSQL, Redis, and the app
npm run docker:up

# Apply database schema
npm run docker:db:push

# View logs (hot reload active)
npm run docker:logs
```

### 3. Configure Slack App

#### Option A: Import App Manifest (Recommended)

1. Go to https://api.slack.com/apps → **Create New App** → **From an app manifest**
2. Select your workspace
3. Copy contents of `slack-app-manifest.yml` from repo root
4. Replace `YOUR_BACKEND_URL` with your backend URL (e.g., `http://localhost:3000` or tunnel URL)
5. Replace `YOUR_WEB_PORTAL_URL` with your web portal URL (e.g., `http://localhost:3001` or tunnel URL)
6. Create the app

#### Option B: Manual Configuration

In your Slack app settings (https://api.slack.com/apps):

1. **OAuth & Permissions**
   - Redirect URLs:
     - `http://localhost:3000/slack/oauth_redirect` (backend)
     - `http://localhost:3001/callback` (web portal)
   - Bot Token Scopes: `app_mentions:read`, `channels:history`, `channels:read`, `chat:write`, `commands`, `users:read`
   - User Token Scopes: `openid`, `profile`

2. **Slash Commands** (Features → Slash Commands):
   | Command | Request URL | Description |
   |---------|-------------|-------------|
   | `/watch` | `http://localhost:3000/slack/events` | Enable AI suggestions for this conversation |
   | `/unwatch` | `http://localhost:3000/slack/events` | Disable AI suggestions for this conversation |

3. **Interactivity & Shortcuts** (Features → Interactivity & Shortcuts):
   - Enable Interactivity: ON
   - Request URL: `http://localhost:3000/slack/events`
   - Create Message Shortcut:
     - Name: `Help me respond`
     - Description: `Get an AI-suggested response to this message`
     - Callback ID: `help_me_respond`

4. **Event Subscriptions** (Features → Event Subscriptions):
   - Enable Events: ON
   - Request URL: `http://localhost:3000/slack/events`
   - Subscribe to bot events: `app_mention`, `message.channels`

5. **Install the App**
   - Visit `http://localhost:3000/slack/install`
   - Approve the OAuth permissions

### 4. Configure Google OAuth (for Weekly Reports)

To use the Weekly Reports feature, you need to set up Google OAuth for Sheets access:

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Note your project name for later

2. **Enable Google Sheets API**
   - Go to **APIs & Services** → **Library**
   - Search for "Google Sheets API"
   - Click **Enable**

3. **Configure OAuth Consent Screen**
   - Go to **APIs & Services** → **OAuth consent screen**
   - Choose **External** (or Internal for Google Workspace)
   - Fill in app name, support email, and developer email
   - Add scopes: `https://www.googleapis.com/auth/spreadsheets`
   - Add test users (your email) if in testing mode

4. **Create OAuth 2.0 Client ID**
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth 2.0 Client ID**
   - When asked "What data will you be accessing?", select **User data** (not Application data)
     - User data = OAuth 2.0 for accessing user's Google Sheets with their permission
     - Application data = Service accounts, which is not what we need
   - Complete the OAuth consent screen setup if prompted
   - Application type: **Web application**
   - Name: "Slack Speak for Me"
   - Authorized redirect URIs:
     - `http://localhost:3000/oauth/google/callback` (development)
     - `https://your-domain.com/oauth/google/callback` (production)
   - Click **Create** and copy the Client ID and Client Secret

5. **Add to Environment**

   Add to your `.env` file:
   ```bash
   GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   ```

6. **Create a Google Sheet for Reports**
   - Create a new Google Sheet in your Google Drive
   - Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - You'll enter this ID in the Web Portal → Reports settings

### 5. Verify Installation

```bash
# Check app is running
curl http://localhost:3000/health/live

# Check all services are healthy
curl http://localhost:3000/health/ready
```

## Docker Commands

| Command | Description |
|---------|-------------|
| `npm run docker:up` | Start all services (PostgreSQL, Redis, app) |
| `npm run docker:down` | Stop all containers |
| `npm run docker:logs` | Stream app logs (Ctrl+C to exit) |
| `npm run docker:build` | Rebuild containers (after dependency changes) |
| `npm run docker:shell` | Shell into the app container |
| `npm run docker:db:push` | Apply database migrations |
| `npm run docker:restart` | Restart just the app container |

## Development

### Hot Reload

Edit any file in these directories and the app automatically rebuilds:
- `apps/slack-backend/src/`
- `packages/database/src/`
- `packages/validation/src/`

### Project Structure

```
slack-speak-for-me/
├── apps/
│   ├── slack-backend/       # Slack Bolt app (event handling, AI integration)
│   └── web-portal/          # Next.js settings portal
├── packages/
│   ├── database/            # Drizzle ORM schema and client
│   └── validation/          # Zod schemas and sanitization
├── slack-app-manifest.yml   # Slack app configuration template
├── docker-compose.yml       # Development services
├── Dockerfile.dev           # Development container
└── .env.docker              # Environment template
```

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis separately, then:
npm run dev --workspace=apps/slack-backend
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Slack Backend | 3000 | Slack Bolt app (events, commands, AI) |
| Web Portal | 3001 | Next.js settings dashboard |
| PostgreSQL | 5432 | Database (user: postgres, pass: postgres) |
| Redis | 6379 | Job queue |

## Web Portal

The web portal allows users to manage their settings:

- **Style Preferences**: Tone, formality, phrases to use/avoid
- **People Context**: Notes about colleagues for personalized suggestions
- **AI Learning**: View how AI adapts to your style
- **Reports**: Configure weekly report generation

See `apps/web-portal/README.md` for detailed setup instructions.

## Architecture

- **Multi-tenant**: PostgreSQL Row-Level Security isolates workspace data
- **Secure**: OAuth tokens encrypted with AES-256-GCM
- **Async Processing**: BullMQ handles AI generation without hitting Slack's 3-second timeout
- **Prompt Injection Defense**: 4-layer sanitization protects AI interactions

## License

Private - All rights reserved
