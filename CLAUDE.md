# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Slack Speak for Me** - An AI-powered Slack integration that helps professionals craft contextually-aware responses to challenging workplace messages. Uses Claude AI to generate suggestions delivered via ephemeral messages.

## Architecture

- **Monorepo** with npm workspaces
- **apps/slack-backend** - Slack Bolt app with OAuth, event handlers, job processing
- **packages/database** - Drizzle ORM with PostgreSQL, RLS for multi-tenant isolation

## Development Setup

```bash
# Install dependencies
npm install

# Start infrastructure (PostgreSQL, Redis)
docker compose up -d

# Run database migrations
npm run db:push --workspace=@slack-speak-for-me/database

# Start development server with hot reload
npm run dev --workspace=slack-backend
```

### Environment Variables

Required in `apps/slack-backend/.env`:
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_STATE_SECRET`
- `DATABASE_URL` (PostgreSQL connection string)
- `ANTHROPIC_API_KEY` (for Claude AI)
- `ENCRYPTION_KEY` (32-byte hex for OAuth token encryption)
- `REDIS_HOST` (optional, defaults to localhost)

## Code Conventions

### TypeScript
- Strict mode enabled
- ESM modules with `.js` extensions in imports
- Zod for runtime validation

### Database
- Snake_case for column names (PostgreSQL convention)
- RLS policies for workspace isolation
- Drizzle ORM with explicit schema

### Slack Integration
- Bolt 3.22 for event handling
- BullMQ for async job processing (Slack 3-second timeout)
- Ephemeral messages for private suggestions

### Security
- 4-layer prompt injection defense (sanitize, spotlight, detect, filter)
- AES-256-GCM for OAuth token encryption
- Logger redacts secrets automatically

## Testing Requirements

**CRITICAL: All code must have comprehensive test coverage.**

### Unit Tests
- Use Vitest for all unit tests
- Target 90%+ code coverage
- Mock external services (Slack API, Anthropic API, database)
- Test files colocated with source: `*.test.ts`

### Integration Tests
- Test database operations with test database
- Test job queue processing
- Test API endpoints

### E2E Tests
- Test complete flows from event to delivery
- Test Slack interaction flows
- Use testing page for manual verification

### Testing Page
- Web interface at `/test` route for manual testing
- Simulate Slack events without Slack
- Test AI generation directly
- Verify all handlers work correctly

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific workspace tests
npm test --workspace=slack-backend
```

## Common Commands

```bash
# Build all packages
npm run build --workspaces --if-present

# Type check
npm run typecheck --workspaces --if-present

# Lint
npm run lint --workspaces --if-present

# Database operations
npm run db:generate --workspace=@slack-speak-for-me/database  # Generate migrations
npm run db:push --workspace=@slack-speak-for-me/database      # Apply schema
npm run db:studio --workspace=@slack-speak-for-me/database    # Open Drizzle Studio
```

## Key Files

- `.planning/ROADMAP.md` - Project phases and progress
- `.planning/PROJECT.md` - Requirements and decisions
- `apps/slack-backend/src/app.ts` - Main Bolt app configuration
- `apps/slack-backend/src/services/ai.ts` - Claude AI integration
- `packages/database/src/schema.ts` - Database schema
