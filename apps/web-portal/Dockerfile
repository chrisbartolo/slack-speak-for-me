# Production Dockerfile for web-portal (Next.js)
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

# Build the Next.js app (uses standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=web-portal

# ============================================
# Stage 2: Runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone build output
COPY --from=builder /app/apps/web-portal/.next/standalone ./
COPY --from=builder /app/apps/web-portal/.next/static ./apps/web-portal/.next/static
COPY --from=builder /app/apps/web-portal/public ./apps/web-portal/public

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "apps/web-portal/server.js"]
