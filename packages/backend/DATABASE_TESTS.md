# Database Property-Based Tests

## Overview

This package includes property-based tests for the database schema that verify:

1. **Property 1: Bookmark Creation Completeness** - All bookmark fields are correctly persisted
2. **Property 6: Collection Creation Completeness** - All collection fields are correctly persisted

## Test Files

- `src/db/schema.test.ts` - Full integration tests (requires PostgreSQL)
- `src/db/schema.mock.test.ts` - Mock tests (no database required) ✅ PASSING

## Running Tests

### Quick Test (No Database Required)

Run the mock tests to verify the test structure and data generators:

```bash
npm run test:run -- src/db/schema.mock.test.ts
```

### Full Integration Tests (Requires PostgreSQL)

1. **Start Docker services:**
   ```bash
   # From project root
   npm run docker:up
   ```

2. **Wait for PostgreSQL to be ready:**
   ```bash
   docker-compose ps
   # Wait until postgres shows "healthy"
   ```

3. **Run migrations:**
   ```bash
   cd packages/backend
   npm run migrate
   ```

4. **Run the full database tests:**
   ```bash
   npm run test:run -- src/db/schema.test.ts
   ```

## What the Tests Verify

### Property 1: Bookmark Creation Completeness

**Validates: Requirements 1.1**

For any valid bookmark data with all required fields:
- URL (web URL)
- Title (1-500 characters)
- Excerpt (optional, up to 1000 characters)
- Content snapshot path (optional)
- Content indexed flag (boolean)
- Type (article, video, image, file, or document)
- Domain (valid domain name)
- Cover URL (optional web URL)
- Is duplicate flag (boolean)
- Is broken flag (boolean)
- Custom order (optional, 0-10000)
- Owner reference (user ID)
- Collection reference (collection ID)
- Timestamps (created_at, updated_at)

The test generates 100 random bookmark records and verifies that:
1. All fields are correctly inserted into the database
2. All fields can be retrieved with the same values
3. Optional fields are handled correctly (null when undefined)
4. Timestamps are automatically generated
5. Foreign key relationships are maintained

### Property 6: Collection Creation Completeness

**Validates: Requirements 2.1**

For any valid collection data with all required fields:
- Title (1-255 characters)
- Icon (1-100 characters)
- Is public flag (boolean)
- Share slug (optional, 5-50 characters, alphanumeric with hyphens)
- Sort order (0-10000)
- Owner reference (user ID)
- Timestamps (created_at, updated_at)

The test generates 100 random collection records and verifies that:
1. All fields are correctly inserted into the database
2. All fields can be retrieved with the same values
3. Optional fields are handled correctly (null when undefined)
4. Timestamps are automatically generated
5. Foreign key relationships are maintained

## Test Configuration

- **Test runs per property:** 100 (configurable via `numRuns` parameter)
- **Test timeout:** 30 seconds
- **Database:** PostgreSQL 15+
- **Property testing library:** fast-check v3.15+

## Troubleshooting

### Docker not running

If you see "Cannot connect to the Docker daemon":
1. Start Docker Desktop or OrbStack
2. Wait for Docker to fully start
3. Try `docker ps` to verify it's running

### Database connection errors

If tests fail with connection errors:
1. Verify PostgreSQL is running: `docker-compose ps`
2. Check credentials in `.env.test` match `docker-compose.yml`
3. Ensure migrations have been run: `npm run migrate`

### Migration errors

If migrations fail:
1. Check PostgreSQL logs: `docker-compose logs postgres`
2. Verify database exists: `docker-compose exec postgres psql -U bookmark_user -d bookmark_db -c '\dt'`
3. Reset database if needed: `docker-compose down -v && docker-compose up -d`

## Next Steps

After these tests pass, you can proceed to:
- Task 3: Implement core data models and repositories
- Task 4: Implement authentication system
- Additional property-based tests for repository operations
