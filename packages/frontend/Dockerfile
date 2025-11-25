# Frontend Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/frontend/package.json ./packages/frontend/
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
COPY --from=deps /app/packages/frontend/node_modules ./packages/frontend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Install pnpm
RUN npm install -g pnpm

# Build shared package first
WORKDIR /app/packages/shared
RUN pnpm run build

# Build frontend
WORKDIR /app/packages/frontend
RUN pnpm run build

# Production image - use nginx to serve static files
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup --system --gid 1001 nginx-user
RUN adduser --system --uid 1001 nginx-user

# Set ownership
RUN chown -R nginx-user:nginx-user /usr/share/nginx/html
RUN chown -R nginx-user:nginx-user /var/cache/nginx
RUN chown -R nginx-user:nginx-user /var/log/nginx
RUN touch /var/run/nginx.pid
RUN chown -R nginx-user:nginx-user /var/run/nginx.pid

USER nginx-user

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
