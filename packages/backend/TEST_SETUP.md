# Test Setup Guide

## Prerequisites

To run the property-based tests for the database schema, you need:

1. Docker and Docker Compose installed
2. PostgreSQL running (via Docker or locally)

## Quick Start with Docker

1. Start the Docker services:

```bash
npm run docker:up
```

2. Run the migrations:

```bash
cd packages/backend
npm run migrate
```

3. Run the tests:

```bash
npm run test:run
```

## Manual PostgreSQL Setup

If you prefer to run PostgreSQL manually:

1. Install PostgreSQL 15+
2. Create the test database:

```sql
CREATE DATABASE bookmark_manager_test;
```

3. Update `.env.test` with your PostgreSQL credentials

4. Run migrations:

```bash
npm run migrate
```

5. Run tests:

```bash
npm run test:run
```

## What the Tests Verify

### Property 1: Bookmark Creation Completeness

Tests that all bookmark fields (URL, title, excerpt, cover image, domain, type, timestamps, owner, collection) are correctly persisted to the database.

### Property 6: Collection Creation Completeness

Tests that all collection fields (title, owner, icon, visibility, timestamps) are correctly persisted to the database.

Both tests use property-based testing with fast-check to generate 100 random test cases, ensuring the schema handles a wide variety of valid inputs correctly.
