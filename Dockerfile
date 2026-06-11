# ── Build stage ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/
COPY packages/amail/package.json packages/amail/
COPY packages/cli/package.json packages/cli/

# Install dependencies
RUN npm ci

# Copy source
COPY packages/server/ packages/server/
COPY packages/amail/ packages/amail/

# Build
RUN npm --workspace=@amail/server run build

# ── Production stage ───────────────────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/
COPY packages/amail/package.json packages/amail/
COPY packages/cli/package.json packages/cli/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files
COPY --from=builder /app/packages/server/dist packages/server/dist

# Create data directory
RUN mkdir -p /data

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/data/amail.db

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "packages/server/dist/index.js"]
