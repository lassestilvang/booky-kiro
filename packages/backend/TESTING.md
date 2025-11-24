# Testing Guide

This document explains how to run tests for the backend package.

## Prerequisites

### Docker Services

The property-based tests and integration tests require Docker services to be running. These tests interact with real PostgreSQL, Redis, MeiliSearch, and MinIO instances.

**Start Docker services:**

```bash
# From the project root
npm run docker:up

# Or using docker-compose directly
docker-compose up -d
```

**Verify services are running:**

```bash
docker ps
```

You should see containers for:

- `bookmark-postgres` (PostgreSQL)
- `bookmark-redis` (Redis)
- `bookmark-meilisearch` (MeiliSearch)
- `bookmark-minio` (MinIO)

### Database Migrations

Tests automatically run migrations in the `beforeAll` hook, but you can also run them manually:

```bash
npm run migrate
```

## Running Tests

### All Tests

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode
npm test
```

### Specific Test Files

```bash
# Run property tests
npm run test:run -- src/repositories/repository.property.test.ts

# Run schema tests
npm run test:run -- src/db/schema.test.ts
```

### With Coverage

```bash
npm run test:run -- --coverage
```

## Test Types

### Property-Based Tests

Property-based tests use `fast-check` to generate random test data and verify that properties hold across all inputs.

**Location:** `src/repositories/repository.property.test.ts`

**Properties tested:**

- Property 2: Bookmark Retrieval Completeness
- Property 3: Bookmark Update Consistency
- Property 4: Bookmark Deletion Cascade
- Property 7: Bookmark Assignment
- Property 8: Bookmark Move Atomicity

Each property test runs 100 iterations by default.

### Schema Tests

Schema tests verify database schema correctness and data persistence.

**Location:** `src/db/schema.test.ts`

**Properties tested:**

- Property 1: Bookmark Creation Completeness
- Property 6: Collection Creation Completeness

## Troubleshooting

### "Cannot connect to Docker daemon"

**Problem:** Docker is not running.

**Solution:** Start Docker Desktop or Docker daemon, then run `npm run docker:up`.

### "role 'bookmark_user' does not exist"

**Problem:** Database user hasn't been created.

**Solution:** The Docker Compose configuration automatically creates the user. Ensure Docker services are running with `npm run docker:up`.

### "relation 'bookmarks' does not exist"

**Problem:** Database migrations haven't been run.

**Solution:** Tests automatically run migrations, but if you see this error, try running migrations manually:

```bash
npm run migrate
```

### Tests timeout

**Problem:** Database connection is slow or services aren't ready.

**Solution:**

1. Check that all Docker services are healthy: `docker ps`
2. Increase test timeout in `vitest.config.ts` if needed
3. Restart Docker services: `npm run docker:down && npm run docker:up`

## Test Data Cleanup

Tests automatically clean up data in the following hooks:

- `beforeEach`: Cleans up test data for the current test user
- `afterAll`: Deletes the test user and all related data

This ensures test isolation and prevents data pollution between test runs.

## Environment Variables

Tests use the `.env.test` file for configuration. Key variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bookmark_db
DB_USER=bookmark_user
DB_PASSWORD=bookmark_pass
```

These match the Docker Compose configuration and should not need to be changed for local development.
