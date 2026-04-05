# ── Stage 1: install production dependencies ──────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: production runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# bash is required by db/migrate.sh; postgresql-client provides psql
RUN apk add --no-cache bash postgresql-client

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Standalone server listens on 0.0.0.0 by default in Docker; set PORT explicitly
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup -S ems && adduser -S ems -G ems

# Standalone output: self-contained server + static assets
COPY --from=builder --chown=ems:ems /app/.next/standalone ./
COPY --from=builder --chown=ems:ems /app/.next/static     ./.next/static
COPY --from=builder --chown=ems:ems /app/public           ./public

# Migration scripts (needed by entrypoint at container start)
COPY --from=builder --chown=ems:ems /app/db ./db

COPY --chown=ems:ems docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER ems
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
