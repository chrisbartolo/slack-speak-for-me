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

In your Slack app settings (https://api.slack.com/apps):

1. **OAuth & Permissions**
   - Add Redirect URL: `http://localhost:3000/slack/oauth_redirect`
   - Scopes: `channels:history`, `channels:read`, `chat:write`, `users:read`, `app_mentions:read`

2. **Install the App**
   - Visit `http://localhost:3000/slack/install`
   - Approve the OAuth permissions

### 4. Verify Installation

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
│   └── slack-backend/     # Slack Bolt app
├── packages/
│   ├── database/          # Drizzle ORM schema and client
│   └── validation/        # Zod schemas and sanitization
├── docker-compose.yml     # Development services
├── Dockerfile.dev         # Development container
└── .env.docker            # Environment template
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
| App | 3000 | Slack backend API |
| PostgreSQL | 5432 | Database (user: postgres, pass: postgres) |
| Redis | 6379 | Job queue |

## Architecture

- **Multi-tenant**: PostgreSQL Row-Level Security isolates workspace data
- **Secure**: OAuth tokens encrypted with AES-256-GCM
- **Async Processing**: BullMQ handles AI generation without hitting Slack's 3-second timeout
- **Prompt Injection Defense**: 4-layer sanitization protects AI interactions

## License

Private - All rights reserved
