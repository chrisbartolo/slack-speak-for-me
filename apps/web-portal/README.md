# Web Portal

Next.js web portal for managing Slack Speak for Me settings and viewing AI learning progress.

## Prerequisites

- Node.js 20+
- PostgreSQL running (via Docker Compose)
- Slack app configured with OAuth
- ngrok or cloudflared for HTTPS tunneling (Slack requires HTTPS for OAuth)

## Environment Setup

1. Copy the example env file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Configure `.env.local`:
   ```env
   # App URL (for redirects behind proxy/tunnel)
   NEXTAUTH_URL=https://<your-ngrok-domain>

   # Slack OAuth (same credentials as slack-backend)
   SLACK_CLIENT_ID=your_slack_client_id
   SLACK_CLIENT_SECRET=your_slack_client_secret
   SLACK_WEB_REDIRECT_URI=https://<your-ngrok-domain>/callback

   # Session secret (generate with: openssl rand -hex 32)
   SESSION_SECRET=your_session_secret_at_least_32_chars

   # Database (same as slack-backend)
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/slack_speak_for_me
   ```

## Slack App Configuration

### Option 1: Import App Manifest (Recommended)

The easiest way to configure your Slack app is to import the manifest file:

1. Go to https://api.slack.com/apps and click **Create New App**
2. Select **From an app manifest**
3. Choose your workspace
4. Copy the contents of `slack-app-manifest.yml` from the repo root
5. Replace `YOUR_BACKEND_URL` and `YOUR_WEB_PORTAL_URL` with your tunnel URLs
6. Review and create the app

### Option 2: Manual Configuration

#### OAuth & Permissions

1. Go to https://api.slack.com/apps and select your app

2. **OAuth & Permissions**:
   - Add Redirect URLs:
     - `https://<backend-tunnel>/slack/oauth_redirect`
     - `https://<web-portal-tunnel>/callback`
   - **User Token Scopes**: `openid`, `profile`
   - **Bot Token Scopes**:
     - `app_mentions:read`
     - `channels:history`
     - `channels:read`
     - `chat:write`
     - `commands`
     - `users:read`

#### Slash Commands

Navigate to **Features > Slash Commands** and create:

| Command | Request URL | Description |
|---------|-------------|-------------|
| `/watch` | `https://<backend-tunnel>/slack/events` | Enable AI suggestions for this conversation |
| `/unwatch` | `https://<backend-tunnel>/slack/events` | Disable AI suggestions for this conversation |

#### Interactivity & Shortcuts

Navigate to **Features > Interactivity & Shortcuts**:

1. Toggle **Interactivity** to ON
2. Set **Request URL**: `https://<backend-tunnel>/slack/events`
3. Under **Shortcuts**, click **Create New Shortcut**:
   - Type: **On messages**
   - Name: `Help me respond`
   - Description: `Get an AI-suggested response to this message`
   - Callback ID: `help_me_respond`

#### Event Subscriptions

Navigate to **Features > Event Subscriptions**:

1. Toggle **Enable Events** to ON
2. Set **Request URL**: `https://<backend-tunnel>/slack/events`
3. Under **Subscribe to bot events**, add:
   - `app_mention`
   - `message.channels`

## Development

### Start Infrastructure

```bash
# From repo root - start PostgreSQL and Redis
docker compose up -d

# Push database schema
cd packages/database && npm run db:push
```

### Start Tunnels

Slack requires HTTPS for OAuth redirects. Use ngrok or cloudflared:

**Option 1: ngrok** (one tunnel at a time on free tier)
```bash
# For web portal
ngrok http 3001

# For slack-backend (separate terminal, or use cloudflared)
ngrok http 3000
```

**Option 2: cloudflared** (unlimited free tunnels)
```bash
# For web portal
cloudflared tunnel --url http://localhost:3001

# For slack-backend
cloudflared tunnel --url http://localhost:3000
```

### Start Development Server

```bash
# From repo root
npm run dev --workspace=web-portal
```

Portal will be available at:
- Local: http://localhost:3001
- Via tunnel: https://<your-tunnel-domain>

### Important: Update URLs When Tunnels Change

When your tunnel URL changes, update:

1. **Slack App Settings** (https://api.slack.com/apps):
   - OAuth Redirect URL for web portal: `https://<new-web-portal-tunnel>/callback`
   - OAuth Redirect URL for backend: `https://<new-backend-tunnel>/slack/oauth_redirect`

2. **`.env.local`**:
   ```env
   NEXTAUTH_URL=https://<new-web-portal-tunnel>
   SLACK_WEB_REDIRECT_URI=https://<new-web-portal-tunnel>/callback
   ```

3. Restart the dev server to pick up env changes

## Full Setup Flow

1. **Start infrastructure**:
   ```bash
   docker compose up -d
   ```

2. **Start tunnels** (2 terminals):
   ```bash
   # Terminal 1 - Backend tunnel
   cloudflared tunnel --url http://localhost:3000

   # Terminal 2 - Web portal tunnel
   ngrok http 3001
   ```

3. **Configure Slack app** with tunnel URLs (see above)

4. **Update `.env.local`** with tunnel URLs

5. **Start backend** (registers workspace on install):
   ```bash
   npm run dev --workspace=slack-backend
   # Or use Docker: docker compose up slack-backend
   ```

6. **Install app to workspace**:
   - Visit `https://<backend-tunnel>/slack/install`
   - Complete OAuth flow

7. **Start web portal**:
   ```bash
   npm run dev --workspace=web-portal
   ```

8. **Sign in**:
   - Visit `https://<web-portal-tunnel>`
   - Click "Sign in with Slack"

## Troubleshooting

### "workspace_not_found" Error
The Slack app must be installed to your workspace first via the backend's `/slack/install` endpoint.

### "invalid_state" Error
OAuth state validation failed. This can happen if:
- Cookies were cleared mid-flow
- The redirect URL doesn't match what's configured in Slack
- The tunnel URL changed

### "Invalid client_id" Error
Environment variables not set or not loaded. Restart the dev server after updating `.env.local`.

### Localhost Redirect Issues
When behind a tunnel, ensure `NEXTAUTH_URL` is set to the tunnel URL, not localhost.

### Database Error 42P10
The `installations` table needs a unique constraint on `workspace_id`. Run:
```bash
cd packages/database && npm run db:push
```

## Tech Stack

- Next.js 15+ with App Router
- shadcn/ui components
- Tailwind CSS
- Drizzle ORM
- jose for JWT sessions
