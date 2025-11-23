# Quick Start Guide

Get the Bookmark Manager Platform up and running in minutes.

## Prerequisites

Ensure you have the following installed:

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **pnpm** 10+ (`npm install -g pnpm`)
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))

## Installation

### 1. Install Dependencies

```bash
pnpm install
```

This will install all dependencies for all packages in the monorepo.

### 2. Start Development Services

Start PostgreSQL, Redis, MeiliSearch, and MinIO:

```bash
pnpm docker:up
```

Wait for all services to be healthy (about 30 seconds). You can check status with:

```bash
docker-compose ps
```

### 3. Configure Backend Environment

```bash
cp packages/backend/.env.example packages/backend/.env
```

The default values work with the Docker Compose setup.

### 4. Verify Setup

Run the verification script:

```bash
# Build all packages
pnpm build

# Run tests
pnpm --filter @bookmark-manager/shared test:run

# Check linting
pnpm lint
```

## Development

### Start All Services

```bash
pnpm dev
```

This starts:

- **Backend API** on http://localhost:3000
- **Frontend** on http://localhost:5173
- **Shared package** in watch mode
- **Extension** in watch mode

### Start Individual Services

```bash
# Backend only
pnpm --filter @bookmark-manager/backend dev

# Frontend only
pnpm --filter @bookmark-manager/frontend dev

# Shared package only
pnpm --filter @bookmark-manager/shared dev
```

## Access Services

Once running, you can access:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **MeiliSearch**: http://localhost:7700
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## Common Commands

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test:run

# Run tests in watch mode
pnpm test

# Lint all code
pnpm lint

# Format all code
pnpm format

# Check formatting
pnpm format:check

# Start Docker services
pnpm docker:up

# Stop Docker services
pnpm docker:down

# View Docker logs
pnpm docker:logs
```

## Package-Specific Commands

```bash
# Backend
pnpm --filter @bookmark-manager/backend dev
pnpm --filter @bookmark-manager/backend build
pnpm --filter @bookmark-manager/backend test:run

# Frontend
pnpm --filter @bookmark-manager/frontend dev
pnpm --filter @bookmark-manager/frontend build
pnpm --filter @bookmark-manager/frontend test:run

# Extension
pnpm --filter @bookmark-manager/extension dev
pnpm --filter @bookmark-manager/extension build
pnpm --filter @bookmark-manager/extension test:run

# Shared
pnpm --filter @bookmark-manager/shared dev
pnpm --filter @bookmark-manager/shared build
pnpm --filter @bookmark-manager/shared test:run
```

## Troubleshooting

### Docker Services Won't Start

```bash
# Stop all containers
pnpm docker:down

# Remove volumes and restart
docker-compose down -v
pnpm docker:up
```

### Port Already in Use

If you get port conflicts, check what's using the ports:

```bash
# Check port 5432 (PostgreSQL)
lsof -i :5432

# Check port 6379 (Redis)
lsof -i :6379

# Check port 7700 (MeiliSearch)
lsof -i :7700

# Check port 9000 (MinIO)
lsof -i :9000
```

### Build Errors

```bash
# Clean all build artifacts
rm -rf packages/*/dist packages/*/.turbo packages/*/tsconfig.tsbuildinfo

# Rebuild
pnpm build
```

### Dependency Issues

```bash
# Clean install
rm -rf node_modules packages/*/node_modules pnpm-lock.yaml
pnpm install
```

## Next Steps

1. Review the [Requirements Document](.kiro/specs/bookmark-manager-platform/requirements.md)
2. Review the [Design Document](.kiro/specs/bookmark-manager-platform/design.md)
3. Start implementing tasks from [Tasks Document](.kiro/specs/bookmark-manager-platform/tasks.md)

## Project Structure

```
bookmark-manager-platform/
├── packages/
│   ├── backend/          # Node.js API server
│   ├── frontend/         # React web app
│   ├── extension/        # Browser extension
│   └── shared/           # Shared types
├── docker-compose.yml    # Local services
└── package.json          # Root package
```

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test:run

# Run tests in watch mode
pnpm test

# Run tests for specific package
pnpm --filter @bookmark-manager/shared test:run
```

### Property-Based Tests

The project uses fast-check for property-based testing. Example:

```typescript
import * as fc from 'fast-check';

it('property: normalized tag names should be lowercase', () => {
  fc.assert(
    fc.property(fc.string(), (tagName) => {
      const normalized = tagName.toLowerCase();
      expect(normalized).toBe(normalized.toLowerCase());
    })
  );
});
```

## Docker Services

### PostgreSQL

- **Port**: 5432
- **User**: bookmark_user
- **Password**: bookmark_pass
- **Database**: bookmark_db

### Redis

- **Port**: 6379
- **No password** (development only)

### MeiliSearch

- **Port**: 7700
- **Master Key**: masterKey123

### MinIO

- **API Port**: 9000
- **Console Port**: 9001
- **Access Key**: minioadmin
- **Secret Key**: minioadmin

## Support

For issues or questions:

1. Check the [SETUP.md](SETUP.md) for detailed setup information
2. Review the [README.md](README.md) for project overview
3. Check the spec documents in `.kiro/specs/bookmark-manager-platform/`

Happy coding! 🚀
