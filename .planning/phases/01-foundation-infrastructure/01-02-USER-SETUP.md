# User Setup: OAuth Configuration

**Phase:** 01-02
**Required before:** Running the Slack backend application

---

## Overview

This phase requires manual configuration of external services and environment variables. You'll need to:

1. Create a Slack App and obtain OAuth credentials
2. Generate encryption keys
3. Configure environment variables
4. Verify the application starts correctly

**Estimated time:** 10-15 minutes

---

## Step 1: Create Slack App

### 1.1 Create New App

1. Visit [Slack API Dashboard](https://api.slack.com/apps)
2. Click "Create New App"
3. Select "From scratch"
4. Enter app name: "Slack Speak for Me" (or your preferred name)
5. Select your development workspace
6. Click "Create App"

### 1.2 Configure OAuth & Permissions

1. In your app dashboard, go to **OAuth & Permissions** (left sidebar)
2. Scroll to **Scopes** section
3. Under **Bot Token Scopes**, add these scopes:
   - `channels:history` - View messages in public channels
   - `channels:read` - View basic channel information
   - `chat:write` - Send messages as bot
   - `users:read` - View user information
   - `app_mentions:read` - View mentions of the app

### 1.3 Add OAuth Redirect URL

1. Still in **OAuth & Permissions** page
2. Scroll to **Redirect URLs** section
3. Click "Add New Redirect URL"
4. Enter: `https://your-domain.com/slack/oauth_redirect`
   - For local development: `http://localhost:3000/slack/oauth_redirect`
5. Click "Add"
6. Click "Save URLs"

### 1.4 Obtain OAuth Credentials

1. Go to **Basic Information** (left sidebar)
2. Scroll to **App Credentials** section
3. Note these values (you'll need them for environment variables):
   - **Client ID**
   - **Client Secret**
   - **Signing Secret**

**⚠️ Security Note:** Keep these credentials secret. Never commit them to git.

---

## Step 2: Generate Encryption Keys

### 2.1 Generate ENCRYPTION_KEY

The encryption key must be a 64-character hexadecimal string (32 bytes).

**Generate using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate using OpenSSL:**
```bash
openssl rand -hex 32
```

**Generate using Python:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output - this is your `ENCRYPTION_KEY`.

### 2.2 Generate SLACK_STATE_SECRET

The state secret must be at least 32 characters.

**Generate using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Generate using OpenSSL:**
```bash
openssl rand -base64 32
```

Copy the output - this is your `SLACK_STATE_SECRET`.

---

## Step 3: Configure Environment Variables

### 3.1 Create .env File

In the repository root, create a `.env` file:

```bash
touch .env
```

### 3.2 Add Required Variables

Add these variables to `.env`:

```bash
# Slack OAuth Credentials (from Step 1.4)
SLACK_CLIENT_ID=your_client_id_here
SLACK_CLIENT_SECRET=your_client_secret_here
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_STATE_SECRET=your_generated_state_secret_here

# Encryption (from Step 2.1)
ENCRYPTION_KEY=your_generated_encryption_key_here

# Database (from previous phase)
DATABASE_URL=postgresql://user:password@localhost:5432/slack_speak

# Redis (default values, adjust if needed)
REDIS_HOST=localhost
REDIS_PORT=6379

# Anthropic API (you'll get this when setting up AI integration)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# App Configuration
NODE_ENV=development
PORT=3000
```

### 3.3 Verify .env is Gitignored

Ensure `.env` is in your `.gitignore`:

```bash
grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
```

---

## Step 4: Verify Application Starts

### 4.1 Start the Application

```bash
npm run dev
```

### 4.2 Expected Output

You should see:
```
{"level":30,"time":...,"name":"app","msg":"Slack backend starting..."}
{"level":30,"time":...,"name":"app","msg":"Bolt app is running on port 3000"}
{"level":30,"time":...,"name":"app","msg":"Slack backend ready"}
```

### 4.3 Troubleshooting

**❌ "Environment validation failed"**
- Check that all required variables are in `.env`
- Verify ENCRYPTION_KEY is exactly 64 hex characters
- Verify SLACK_STATE_SECRET is at least 32 characters

**❌ "Database connection failed"**
- Ensure PostgreSQL is running
- Verify DATABASE_URL is correct
- Check database exists: `psql $DATABASE_URL -c "SELECT 1"`

**❌ "Redis connection failed"**
- Ensure Redis is running: `redis-cli ping` should return `PONG`
- Verify REDIS_HOST and REDIS_PORT are correct

---

## Step 5: Test OAuth Flow (Optional)

### 5.1 Install App to Workspace

1. Start your application (Step 4.1)
2. Visit: `http://localhost:3000/slack/install`
3. Click "Allow" to install the app to your workspace
4. You should be redirected to `http://localhost:3000/slack/oauth_redirect`
5. Check application logs for successful installation

### 5.2 Verify Installation Stored

Check the database:
```bash
psql $DATABASE_URL -c "SELECT id, team_id, name FROM workspaces;"
psql $DATABASE_URL -c "SELECT id, workspace_id, bot_user_id FROM installations;"
```

You should see your workspace and installation with encrypted bot_token.

---

## Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] ENCRYPTION_KEY is 64 hex characters (32 bytes)
- [ ] SLACK_STATE_SECRET is at least 32 characters
- [ ] OAuth credentials are not committed to git
- [ ] Database uses TLS in production
- [ ] Application starts without errors

---

## Next Steps

Once verification passes, you're ready for:
- **Phase 01-05:** Slack event handlers (app.message, app.mention)
- **Phase 02:** AI integration for generating responses

---

## Reference

**Environment Variable Summary:**

| Variable | Required | Format | Source |
|----------|----------|--------|--------|
| SLACK_CLIENT_ID | Yes | String | Slack API Dashboard → App Credentials |
| SLACK_CLIENT_SECRET | Yes | String | Slack API Dashboard → App Credentials |
| SLACK_SIGNING_SECRET | Yes | String | Slack API Dashboard → App Credentials |
| SLACK_STATE_SECRET | Yes | 32+ chars | Generate with crypto.randomBytes |
| ENCRYPTION_KEY | Yes | 64 hex chars | Generate with crypto.randomBytes(32).toString('hex') |
| DATABASE_URL | Yes | postgres:// URL | From Phase 01-01 |
| ANTHROPIC_API_KEY | Yes | sk-ant-... | Anthropic Console |
| REDIS_HOST | No | String | Default: localhost |
| REDIS_PORT | No | Number | Default: 6379 |
| NODE_ENV | No | development/staging/production | Default: development |
| PORT | No | Number | Default: 3000 |

---

*Last updated: 2026-01-26*
