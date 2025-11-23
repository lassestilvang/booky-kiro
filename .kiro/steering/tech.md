# Technology Stack

## Build System

- **Monorepo**: Turborepo for orchestrating builds and tasks
- **Package Manager**: pnpm with workspaces
- **TypeScript**: v5.3+ with strict type checking enabled

## Backend Stack

- Node.js 20+ with Express
- PostgreSQL 15+ (primary database)
- Redis 7+ (cache, sessions, job queue)
- MeiliSearch (full-text search)
- MinIO (S3-compatible object storage)
- BullMQ (job queue)
- Passport.js (OAuth2/JWT authentication)
- Zod (runtime validation)

## Frontend Stack

- React 18 with TypeScript
- Vite (build tool and dev server)
- Tailwind CSS (styling)
- Zustand (state management)
- React Query (@tanstack/react-query) for server state
- React Router for navigation
- Axios for HTTP requests

## Browser Extension

- Manifest V3
- WebExtensions API with polyfill
- TypeScript compilation

## Testing & Quality

- Vitest for unit testing
- fast-check for property-based testing
- ESLint with TypeScript support
- Prettier for code formatting

## Common Commands

```bash
# Install dependencies
npm install

# Development
npm run dev                 # Start all packages in dev mode
npm run docker:up          # Start Docker services (PostgreSQL, Redis, MeiliSearch, MinIO)
npm run docker:down        # Stop Docker services
npm run docker:logs        # View Docker logs

# Building
npm run build              # Build all packages

# Testing
npm run test:run           # Run all tests once
npm run test               # Run tests in watch mode

# Code Quality
npm run lint               # Lint all packages
npm run format             # Format code with Prettier
npm run format:check       # Check formatting

# Individual package commands (run from package directory)
cd packages/backend && npm run dev
cd packages/frontend && npm run dev
```

## Development Services

- PostgreSQL: localhost:5432
- Redis: localhost:6379
- MeiliSearch: http://localhost:7700
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

## Requirements

- Node.js 20+
- npm 10+
- Docker & Docker Compose
