# Bookmark Manager Platform

A production-ready, cross-platform bookmark management platform with comprehensive organization, archiving, search, and collaboration capabilities.

## Features

- **Core Bookmarking**: Save, organize, and manage web bookmarks with rich metadata
- **Collections**: Hierarchical organization with custom icons
- **Tags & Filtering**: Multi-tag support with advanced filtering
- **Full-text Search**: Search within saved page content (Pro)
- **Permanent Archival**: Snapshot pages for offline access (Pro)
- **Highlights & Annotations**: Mark and annotate important passages (Pro)
- **Collaboration**: Share collections with specific users or publicly (Pro)
- **Browser Extension**: Quick save from Chrome, Firefox, Safari, Edge
- **Import/Export**: Migrate from other bookmark managers
- **Cross-device Sync**: Real-time synchronization across devices

## Architecture

This is a monorepo containing:

- `packages/backend` - Node.js/Express REST API server
- `packages/frontend` - React web application
- `packages/extension` - Browser extension (Manifest V3)
- `packages/shared` - Shared TypeScript types and utilities

## Prerequisites

- Node.js 20+
- npm 10+
- Docker & Docker Compose (for local development)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Services

Start PostgreSQL, Redis, MeiliSearch, and MinIO:

```bash
npm run docker:up
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp packages/backend/.env.example packages/backend/.env
```

### 4. Run Database Migrations

Set up the database schema:

```bash
cd packages/backend
npm run migrate
```

### 5. Run Development Servers

```bash
# Run all packages in development mode
npm run dev

# Or run individual packages
cd packages/backend && npm run dev
cd packages/frontend && npm run dev
```

## Development

### Project Structure

```
bookmark-manager-platform/
├── packages/
│   ├── backend/          # API server
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── frontend/         # React web app
│   │   ├── src/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── extension/        # Browser extension
│   │   ├── src/
│   │   ├── manifest.json
│   │   └── package.json
│   └── shared/           # Shared types
│       ├── src/
│       └── package.json
├── docker-compose.yml    # Local services
├── package.json          # Root package
└── turbo.json           # Monorepo config
```

### Available Scripts

- `npm run dev` - Start all packages in development mode
- `npm run build` - Build all packages
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run lint` - Lint all packages
- `npm run format` - Format code with Prettier
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services
- `npm run docker:logs` - View Docker logs

**Backend-specific:**

- `cd packages/backend && npm run migrate` - Run database migrations

### Testing

This project uses Vitest for unit testing and fast-check for property-based testing.

```bash
# Run all tests
npm run test:run

# Run tests for a specific package
cd packages/backend && npm run test:run
```

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with TypeScript support
- **Prettier**: Consistent code formatting
- **Vitest**: Fast unit testing
- **fast-check**: Property-based testing for correctness

## Docker Services

The development environment includes:

- **PostgreSQL 15**: Primary database (port 5432)
- **Redis 7**: Cache and job queue (port 6379)
- **MeiliSearch**: Full-text search engine (port 7700)
- **MinIO**: S3-compatible object storage (port 9000, console 9001)

Access services:

- MeiliSearch: http://localhost:7700
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

## Technology Stack

**Backend:**

- Node.js 20+ with Express
- PostgreSQL 15+ (primary database)
- Redis 7+ (cache, sessions, job queue)
- MeiliSearch (full-text search)
- MinIO (object storage)
- BullMQ (job queue)
- Passport.js (OAuth2/JWT)

**Frontend:**

- React 18 with TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- React Query (server state)
- React Router (navigation)

**Browser Extension:**

- Manifest V3
- WebExtensions API
- TypeScript

## License

Private - All rights reserved
