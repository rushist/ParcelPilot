# ==============================================================================
# Multi-Stage Production Dockerfile for ParcelPilot (CALQUITY)
# ==============================================================================

# 1. Base Image (Debian-slim for stable glibc networking and memory handling)
FROM node:20-slim AS base
WORKDIR /app

# 2. Dependencies Stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

# 3. Build Stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN npm run build

# 4. Production Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/data ./data
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/tests ./tests
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/*.xlsx ./

RUN mkdir -p /app/src/data /app/data /app/docs && chown -R nextjs:nodejs /app/src/data /app/data /app/docs

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
