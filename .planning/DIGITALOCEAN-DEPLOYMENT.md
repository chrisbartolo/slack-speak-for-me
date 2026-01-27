# DigitalOcean App Platform Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DigitalOcean App Platform                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │  slack-backend   │     │   web-portal     │                 │
│  │  (Service)       │     │   (Static Site)  │                 │
│  │  Port: 3000      │     │   Next.js SSR    │                 │
│  └────────┬─────────┘     └────────┬─────────┘                 │
│           │                        │                            │
│           ▼                        ▼                            │
│  ┌──────────────────────────────────────────┐                  │
│  │              Managed Database            │                  │
│  │         PostgreSQL (with pgvector)       │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                  │
│  ┌──────────────────────────────────────────┐                  │
│  │              Managed Redis               │                  │
│  │           (BullMQ Job Queue)             │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

| Component | Type | Plan | Purpose |
|-----------|------|------|---------|
| slack-backend | Service | Basic ($12/mo) | Slack Bolt app, API, workers |
| web-portal | Service | Basic ($12/mo) | Next.js dashboard |
| PostgreSQL | Database | Basic ($15/mo) | Data storage with pgvector |
| Redis | Database | Basic ($15/mo) | Job queue (BullMQ) |

**Estimated Cost:** ~$54/month for basic setup

---

## Step 1: Prepare Dockerfiles

### slack-backend/Dockerfile

```dockerfile
# apps/slack-backend/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/slack-backend/package*.json ./apps/slack-backend/
COPY packages/database/package*.json ./packages/database/
COPY packages/validation/package*.json ./packages/validation/

# Install dependencies
RUN npm ci --workspace=@slack-speak/slack-backend --workspace=@slack-speak/database --workspace=@slack-speak/validation

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/slack-backend/node_modules ./apps/slack-backend/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/validation/node_modules ./packages/validation/node_modules
COPY . .

# Build packages first, then app
RUN npm run build --workspace=@slack-speak/database
RUN npm run build --workspace=@slack-speak/validation
RUN npm run build --workspace=@slack-speak/slack-backend

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 slack

# Copy built application
COPY --from=builder /app/apps/slack-backend/dist ./apps/slack-backend/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/validation/dist ./packages/validation/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/slack-backend/package*.json ./apps/slack-backend/
COPY --from=builder /app/packages/database/package*.json ./packages/database/
COPY --from=builder /app/packages/validation/package*.json ./packages/validation/

USER slack

EXPOSE 3000

CMD ["node", "apps/slack-backend/dist/index.js"]
```

### web-portal/Dockerfile

```dockerfile
# apps/web-portal/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package*.json ./
COPY apps/web-portal/package*.json ./apps/web-portal/
COPY packages/database/package*.json ./packages/database/
COPY packages/validation/package*.json ./packages/validation/

RUN npm ci

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build packages
RUN npm run build --workspace=@slack-speak/database
RUN npm run build --workspace=@slack-speak/validation

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=web-portal

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web-portal/.next/standalone ./
COPY --from=builder /app/apps/web-portal/.next/static ./apps/web-portal/.next/static
COPY --from=builder /app/apps/web-portal/public ./apps/web-portal/public

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web-portal/server.js"]
```

---

## Step 2: App Platform Spec (app.yaml)

Create `app.yaml` in repository root:

```yaml
# app.yaml - DigitalOcean App Platform specification
name: slack-speak-for-me

region: nyc

# Alerts
alerts:
  - rule: DEPLOYMENT_FAILED
  - rule: DOMAIN_FAILED

# Services
services:
  # Slack Backend
  - name: slack-backend
    dockerfile_path: apps/slack-backend/Dockerfile
    github:
      repo: chrisbartolo/slack-speak-for-me
      branch: main
      deploy_on_push: true
    instance_size_slug: basic-xxs
    instance_count: 1
    http_port: 3000
    health_check:
      http_path: /health/live
      initial_delay_seconds: 10
      period_seconds: 30
    routes:
      - path: /slack
      - path: /oauth
      - path: /health
      - path: /api
    envs:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3000"
      - key: DATABASE_URL
        scope: RUN_TIME
        type: SECRET
      - key: REDIS_URL
        scope: RUN_TIME
        type: SECRET
      - key: SLACK_CLIENT_ID
        scope: RUN_TIME
        type: SECRET
      - key: SLACK_CLIENT_SECRET
        scope: RUN_TIME
        type: SECRET
      - key: SLACK_SIGNING_SECRET
        scope: RUN_TIME
        type: SECRET
      - key: SLACK_STATE_SECRET
        scope: RUN_TIME
        type: SECRET
      - key: ENCRYPTION_KEY
        scope: RUN_TIME
        type: SECRET
      - key: ANTHROPIC_API_KEY
        scope: RUN_TIME
        type: SECRET
      - key: GOOGLE_CLIENT_ID
        scope: RUN_TIME
        type: SECRET
      - key: GOOGLE_CLIENT_SECRET
        scope: RUN_TIME
        type: SECRET
      - key: WEB_PORTAL_URL
        value: ${web-portal.PUBLIC_URL}
      - key: GOOGLE_REDIRECT_URI
        value: ${slack-backend.PUBLIC_URL}/oauth/google/callback

  # Web Portal
  - name: web-portal
    dockerfile_path: apps/web-portal/Dockerfile
    github:
      repo: chrisbartolo/slack-speak-for-me
      branch: main
      deploy_on_push: true
    instance_size_slug: basic-xxs
    instance_count: 1
    http_port: 3001
    health_check:
      http_path: /api/health
      initial_delay_seconds: 10
      period_seconds: 30
    routes:
      - path: /
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        scope: RUN_TIME
        type: SECRET
      - key: SESSION_SECRET
        scope: RUN_TIME
        type: SECRET
      - key: SLACK_CLIENT_ID
        scope: RUN_TIME
        type: SECRET
      - key: SLACK_CLIENT_SECRET
        scope: RUN_TIME
        type: SECRET
      - key: SLACK_BACKEND_URL
        value: ${slack-backend.PUBLIC_URL}

# Databases
databases:
  - name: db
    engine: PG
    version: "16"
    size: db-s-1vcpu-1gb
    num_nodes: 1

  - name: redis
    engine: REDIS
    version: "7"
    size: db-s-1vcpu-1gb
    num_nodes: 1

# Jobs (for database migrations)
jobs:
  - name: db-migrate
    dockerfile_path: apps/slack-backend/Dockerfile
    github:
      repo: chrisbartolo/slack-speak-for-me
      branch: main
    instance_size_slug: basic-xxs
    kind: PRE_DEPLOY
    envs:
      - key: DATABASE_URL
        scope: RUN_TIME
        type: SECRET
    run_command: npm run db:push --workspace=@slack-speak/database
```

---

## Step 3: Create Databases

### PostgreSQL with pgvector

1. Go to DigitalOcean → Databases → Create Database Cluster
2. Choose PostgreSQL 16
3. Select datacenter (same as app)
4. Choose plan (Basic $15/mo for dev)
5. Name: `slack-speak-db`

**After creation, enable pgvector:**

```sql
-- Connect via psql or console
CREATE EXTENSION IF NOT EXISTS vector;
```

**Connection string format:**
```
postgresql://user:password@host:25060/defaultdb?sslmode=require
```

### Redis

1. Go to DigitalOcean → Databases → Create Database Cluster
2. Choose Redis 7
3. Select datacenter (same as app)
4. Choose plan (Basic $15/mo)
5. Name: `slack-speak-redis`

**Connection string format:**
```
rediss://default:password@host:25061
```

---

## Step 4: Environment Variables

### slack-backend

| Variable | Source | Example |
|----------|--------|---------|
| `DATABASE_URL` | DO Database | `postgresql://...` |
| `REDIS_URL` | DO Redis | `rediss://...` |
| `SLACK_CLIENT_ID` | Slack App | `1234567890.123456789` |
| `SLACK_CLIENT_SECRET` | Slack App | `abcdef123456...` |
| `SLACK_SIGNING_SECRET` | Slack App | `abc123def456...` |
| `SLACK_STATE_SECRET` | Generate | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Generate | `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | Anthropic | `sk-ant-...` |
| `GOOGLE_CLIENT_ID` | Google Cloud | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud | `GOCSPX-...` |
| `WEB_PORTAL_URL` | Auto | `${web-portal.PUBLIC_URL}` |
| `GOOGLE_REDIRECT_URI` | Auto | `${slack-backend.PUBLIC_URL}/oauth/google/callback` |

### web-portal

| Variable | Source | Example |
|----------|--------|---------|
| `DATABASE_URL` | DO Database | `postgresql://...` |
| `SESSION_SECRET` | Generate | `openssl rand -hex 32` |
| `SLACK_CLIENT_ID` | Slack App | Same as backend |
| `SLACK_CLIENT_SECRET` | Slack App | Same as backend |
| `SLACK_BACKEND_URL` | Auto | `${slack-backend.PUBLIC_URL}` |

---

## Step 5: Domain & SSL

### Custom Domain

1. Go to App Platform → Settings → Domains
2. Add custom domain: `app.yourdomain.com`
3. Add CNAME record pointing to DO app URL
4. SSL certificate auto-provisioned

### Routing

```
app.yourdomain.com/           → web-portal (dashboard)
app.yourdomain.com/slack/*    → slack-backend (Slack events)
app.yourdomain.com/oauth/*    → slack-backend (OAuth callbacks)
app.yourdomain.com/health/*   → slack-backend (health checks)
app.yourdomain.com/api/*      → slack-backend (API endpoints)
```

Or use subdomains:
```
app.yourdomain.com            → web-portal
api.yourdomain.com            → slack-backend
```

---

## Step 6: Deploy

### Option A: Via Console

1. Go to DigitalOcean → Apps → Create App
2. Select GitHub repository
3. Import `app.yaml` or configure manually
4. Add environment variables
5. Deploy

### Option B: Via CLI

```bash
# Install doctl
brew install doctl

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec app.yaml

# Deploy update
doctl apps update <app-id> --spec app.yaml
```

---

## Step 7: Update Slack App Configuration

After deployment, update your Slack app settings:

### OAuth & Permissions → Redirect URLs
```
https://your-app-url.ondigitalocean.app/slack/oauth_redirect
https://app.yourdomain.com/slack/oauth_redirect
```

### Event Subscriptions → Request URL
```
https://your-app-url.ondigitalocean.app/slack/events
```

### Interactivity & Shortcuts → Request URL
```
https://your-app-url.ondigitalocean.app/slack/events
```

### Slash Commands
Update all command Request URLs to:
```
https://your-app-url.ondigitalocean.app/slack/events
```

---

## Step 8: Update Google OAuth

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit OAuth 2.0 Client ID
3. Add authorized redirect URI:
```
https://your-app-url.ondigitalocean.app/oauth/google/callback
```

---

## Step 9: Monitoring & Logs

### View Logs
```bash
# Via CLI
doctl apps logs <app-id> --type=run

# Or in console: Apps → your-app → Runtime Logs
```

### Health Checks

- Liveness: `/health/live` - Returns 200 if app is running
- Readiness: `/health/ready` - Returns 200 if all services connected

### Alerts

Configure in App Platform:
- Deployment failures
- Health check failures
- High memory/CPU usage

---

## Step 10: Scaling

### Horizontal Scaling
```yaml
services:
  - name: slack-backend
    instance_count: 2  # Increase for more capacity
```

### Vertical Scaling
```yaml
services:
  - name: slack-backend
    instance_size_slug: basic-xs  # Upgrade from basic-xxs
```

### Database Scaling
- Upgrade to higher tier for more connections
- Add read replicas for read-heavy workloads
- Enable connection pooling

---

## Deployment Checklist

### Pre-Deploy
- [ ] Dockerfiles created and tested locally
- [ ] app.yaml validated
- [ ] All secrets generated
- [ ] Database created with pgvector
- [ ] Redis cluster created

### Deploy
- [ ] App created in DO console
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Health checks passing

### Post-Deploy
- [ ] Slack app URLs updated
- [ ] Google OAuth URLs updated
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Monitoring configured
- [ ] Test full flow end-to-end

---

## Troubleshooting

### Build Failures
```bash
# Check build logs
doctl apps logs <app-id> --type=build
```

### Runtime Errors
```bash
# Check runtime logs
doctl apps logs <app-id> --type=run --follow
```

### Database Connection Issues
- Verify DATABASE_URL format includes `?sslmode=require`
- Check trusted sources in database settings
- Verify app is in same VPC/datacenter

### Redis Connection Issues
- Use `rediss://` (with double s) for TLS
- Verify REDIS_URL includes port (usually 25061)

---

## Cost Optimization

### Development
- Use basic-xxs instances ($5/mo each)
- Use basic database tiers
- Single instance per service

### Production
- Scale based on actual load
- Use reserved instances for discounts
- Monitor and right-size resources

**Estimated Monthly Costs:**

| Tier | Services | Databases | Total |
|------|----------|-----------|-------|
| Dev | $10 (2×$5) | $30 (PG+Redis) | ~$40/mo |
| Basic | $24 (2×$12) | $30 | ~$54/mo |
| Prod | $48 (2×$24) | $60 | ~$108/mo |

---
*Created: 2026-01-27*
