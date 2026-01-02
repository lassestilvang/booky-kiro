# Docker Deployment Guide

This guide covers Docker-based deployment options for the Bookmark Manager Platform.

## Table of Contents

- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Service Architecture](#service-architecture)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Development (Infrastructure Only)

Run only infrastructure services (PostgreSQL, Redis, MeiliSearch, MinIO) for local development:

```bash
# Start infrastructure services
docker-compose -f docker-compose.dev.yml up -d

# Check service health
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

Then run application services locally:

```bash
# Install dependencies
npm install

# Run database migrations
cd packages/backend && npm run migrate

# Start all services in development mode
npm run dev
```

### Production (Full Stack)

Run all services including application containers:

```bash
# Build and start all services
docker-compose up -d --build

# Check service health
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Development Setup

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (for local development)
- npm 10+

### Infrastructure Services

The development compose file (`docker-compose.dev.yml`) runs:

- **PostgreSQL 15** - Primary database (port 5432)
- **Redis 7** - Cache and job queue (port 6379)
- **MeiliSearch 1.5** - Full-text search engine (port 7700)
- **MinIO** - S3-compatible object storage (ports 9000, 9001)

### Service URLs

- PostgreSQL: `postgresql://bookmark_user:bookmark_pass@localhost:5432/bookmark_db`
- Redis: `redis://localhost:6379`
- MeiliSearch: `http://localhost:7700` (API key: `masterKey123`)
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001` (credentials: `minioadmin/minioadmin`)

### Environment Variables

Copy the example environment file:

```bash
cp packages/backend/.env.example packages/backend/.env
```

The default values in `.env.example` are configured to work with the Docker services.

## Production Deployment

### Service Architecture

The production compose file (`docker-compose.yml`) runs:

**Infrastructure Services:**

- PostgreSQL 15
- Redis 7
- MeiliSearch 1.5
- MinIO

**Application Services:**

- **API Server** - REST API and WebSocket server (port 3000)
- **Snapshot Worker** (2 replicas) - Fetches and archives web pages
- **Index Worker** (2 replicas) - Extracts and indexes content
- **Maintenance Worker** - Duplicate detection and broken link scanning
- **Frontend** - React SPA served by Nginx (port 8080)

### Building Images

Build all Docker images:

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build api
docker-compose build snapshot-worker
docker-compose build index-worker
docker-compose build maintenance-worker
docker-compose build frontend
```

### Running Services

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d postgres redis meilisearch minio
docker-compose up -d api snapshot-worker index-worker

# Scale workers
docker-compose up -d --scale snapshot-worker=3 --scale index-worker=3
```

### Database Migrations

Run migrations before starting the API:

```bash
# Run migrations in API container
docker-compose exec api node dist/db/migrate.js

# Or run migrations from host
cd packages/backend
npm run migrate
```

### Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# API health endpoint
curl http://localhost:3000/health

# Frontend health endpoint
curl http://localhost:8080/health
```

### Logs

View logs for all or specific services:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f snapshot-worker
docker-compose logs -f index-worker

# Last 100 lines
docker-compose logs --tail=100 api
```

## Service Architecture

### API Server

- **Image**: Built from `packages/backend/Dockerfile`
- **Port**: 3000
- **Dependencies**: PostgreSQL, Redis, MeiliSearch, MinIO
- **Health Check**: `GET /health`
- **Restart Policy**: `unless-stopped`

### Snapshot Worker

- **Image**: Built from `packages/backend/Dockerfile.snapshot-worker`
- **Replicas**: 2 (configurable)
- **Dependencies**: PostgreSQL, Redis, MinIO
- **Special**: Includes Chromium for web page rendering
- **Restart Policy**: `unless-stopped`

### Index Worker

- **Image**: Built from `packages/backend/Dockerfile.index-worker`
- **Replicas**: 2 (configurable)
- **Dependencies**: PostgreSQL, Redis, MeiliSearch, MinIO
- **Restart Policy**: `unless-stopped`

### Maintenance Worker

- **Image**: Built from `packages/backend/Dockerfile.maintenance-worker`
- **Replicas**: 1
- **Dependencies**: PostgreSQL, Redis
- **Restart Policy**: `unless-stopped`

### Frontend

- **Image**: Built from `packages/frontend/Dockerfile`
- **Port**: 8080 (mapped to 80 in container)
- **Server**: Nginx
- **Dependencies**: API
- **Health Check**: `GET /health`
- **Restart Policy**: `unless-stopped`

## Configuration

### Environment Variables

Key environment variables for production:

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=bookmark_db
DB_USER=bookmark_user
DB_PASSWORD=bookmark_pass

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# MeiliSearch
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=masterKey123

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=bookmarks
MINIO_SNAPSHOT_BUCKET=snapshots

# Application
NODE_ENV=production
PORT=3000
```

### Volumes

Persistent data is stored in Docker volumes:

- `postgres_data` - PostgreSQL database
- `redis_data` - Redis persistence
- `meilisearch_data` - MeiliSearch indexes
- `minio_data` - Object storage (snapshots, uploads, backups)

### Networking

All services communicate via the `bookmark-network` bridge network. Services can reference each other by service name (e.g., `postgres`, `redis`, `minio`).

## Troubleshooting

### Service Won't Start

Check service logs:

```bash
docker-compose logs service-name
```

Check service health:

```bash
docker-compose ps
```

### Database Connection Issues

Ensure PostgreSQL is healthy:

```bash
docker-compose exec postgres pg_isready -U bookmark_user
```

Test connection:

```bash
docker-compose exec postgres psql -U bookmark_user -d bookmark_db -c "SELECT 1"
```

### Worker Not Processing Jobs

Check Redis connection:

```bash
docker-compose exec redis redis-cli ping
```

Check job queue:

```bash
docker-compose exec redis redis-cli KEYS "bull:*"
```

### Storage Issues

Check MinIO health:

```bash
curl http://localhost:9000/minio/health/live
```

Access MinIO console:

```
http://localhost:9001
Username: minioadmin
Password: minioadmin
```

### Search Not Working

Check MeiliSearch health:

```bash
curl http://localhost:7700/health
```

Check indexes:

```bash
curl -H "Authorization: Bearer masterKey123" http://localhost:7700/indexes
```

### Container Resource Issues

Check resource usage:

```bash
docker stats
```

Adjust resource limits in `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Rebuild After Code Changes

```bash
# Rebuild and restart specific service
docker-compose up -d --build api

# Rebuild all services
docker-compose up -d --build
```

### Clean Up

Remove all containers, volumes, and networks:

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Production Considerations

### Security

1. **Change default credentials** in production
2. **Use secrets management** for sensitive values
3. **Enable TLS** for external connections
4. **Use private networks** for service communication
5. **Implement proper firewall rules**

### Scaling

Scale workers based on load:

```bash
# Scale snapshot workers
docker-compose up -d --scale snapshot-worker=5

# Scale index workers
docker-compose up -d --scale index-worker=5
```

### Monitoring

Consider adding:

- Prometheus for metrics
- Grafana for dashboards
- Loki for log aggregation
- Alertmanager for alerts

### Backups

Backup persistent volumes regularly:

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U bookmark_user bookmark_db > backup.sql

# Backup MinIO data
docker run --rm -v minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data
```

### High Availability

For production HA:

1. Use managed database services (RDS, Cloud SQL)
2. Use managed Redis (ElastiCache, Cloud Memorystore)
3. Use managed object storage (S3, GCS)
4. Deploy to Kubernetes for orchestration
5. Use load balancers for API and frontend
6. Implement database replication
7. Use multiple availability zones

## Next Steps

- See [SETUP.md](./SETUP.md) for detailed setup instructions
- See [README.md](./README.md) for project overview
- See [packages/backend/README.md](./packages/backend/README.md) for API documentation
