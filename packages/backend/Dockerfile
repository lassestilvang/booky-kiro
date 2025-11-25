# Backend API Server Dockerfile
FROM node:25-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Install pnpm
RUN npm install -g pnpm

# Build shared package first
WORKDIR /app/packages/shared
RUN pnpm run build

# Build backend
WORKDIR /app/packages/backend
RUN pnpm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 backend

# Copy built application
COPY --from=builder --chown=backend:nodejs /app/packages/backend/dist ./dist
COPY --from=builder --chown=backend:nodejs /app/packages/backend/package.json ./package.json
COPY --from=builder --chown=backend:nodejs /app/packages/shared/dist ./node_modules/@bookmark-manager/shared/dist
COPY --from=builder --chown=backend:nodejs /app/packages/shared/package.json ./node_modules/@bookmark-manager/shared/package.json

# Copy migrations
COPY --from=builder --chown=backend:nodejs /app/packages/backend/migrations ./migrations

# Install production dependencies only
RUN npm install -g pnpm
COPY --from=builder /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

USER backend

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
