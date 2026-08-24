# ==============================================================================
# Optimized Multi-Stage Production Dockerfile for ParcelPilot (CALQUITY)
# ==============================================================================

# 1. Base Image (Debian-slim for stable glibc networking and memory handling)
FROM node:20-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 2. Dependencies Stage (Cached with BuildKit)
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

# 3. Build Stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Cache Next.js build cache across builds
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# 4. Production Runner (Lean Standalone ~180MB)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 nextjs

# Copy static assets and standalone bundle
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy runtime data caches and docs for offline/fallback mode
COPY --from=builder --chown=nextjs:nodejs /app/src/data ./src/data
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/docs ./docs
COPY --from=builder --chown=nextjs:nodejs /app/*.xlsx ./

RUN mkdir -p /app/src/data /app/data /app/docs && chown -R nextjs:nodejs /app/src/data /app/data /app/docs

USER nextjs

EXPOSE 3000

# Direct node startup for instant sub-second boot
CMD ["node", "server.js"]
