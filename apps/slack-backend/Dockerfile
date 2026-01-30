# Production Dockerfile for slack-backend
# Multi-stage build for optimal image size

# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Copy entire source (needed for workspace resolution)
COPY . .

# Install all dependencies
RUN npm ci

# Build packages in correct order (database first, then others depend on it)
RUN npm run build --workspace=@slack-speak/database
RUN npm run build --workspace=@slack-speak/validation
RUN npm run build --workspace=@slack-speak/slack-backend

# ============================================
# Stage 2: Runner
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
