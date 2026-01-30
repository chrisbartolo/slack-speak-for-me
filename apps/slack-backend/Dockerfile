# Production Dockerfile for slack-backend
# Multi-stage build for optimal image size

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Copy package files for all workspaces
COPY package*.json ./
COPY apps/slack-backend/package*.json ./apps/slack-backend/
COPY packages/database/package*.json ./packages/database/
COPY packages/validation/package*.json ./packages/validation/

# Install all dependencies
RUN npm ci --workspace=slack-backend --include-workspace-root

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/slack-backend/node_modules ./apps/slack-backend/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/validation/node_modules ./packages/validation/node_modules

# Copy source code
COPY . .

# Build all packages
RUN npm run build --workspaces --if-present

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 slackapp

# Set production environment
ENV NODE_ENV=production

# Copy built application
COPY --from=builder --chown=slackapp:nodejs /app/apps/slack-backend/dist ./dist
COPY --from=builder --chown=slackapp:nodejs /app/apps/slack-backend/package*.json ./
COPY --from=builder --chown=slackapp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=slackapp:nodejs /app/packages ./packages

USER slackapp

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

CMD ["node", "dist/index.js"]
