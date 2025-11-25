# Demo Scripts

This directory contains scripts for creating demo data and testing the Bookmark Manager Platform API.

## Available Scripts

### 1. Create Demo User (`create-demo-user.js`)

Creates a demo user account with Pro plan enabled.

```bash
node scripts/create-demo-user.js
```

**Environment Variables:**

- `API_BASE_URL` - API server URL (default: `http://localhost:3000`)
- `DEMO_USER_EMAIL` - Demo user email (default: `demo@example.com`)
- `DEMO_USER_PASSWORD` - Demo user password (default: `Demo123!`)
- `DEMO_USER_NAME` - Demo user name (default: `Demo User`)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database connection

**What it does:**

- Registers a new user via the API
- Upgrades the user to Pro plan in the database
- Verifies login functionality

### 2. Seed Demo Data (`seed-demo-data.js`)

Creates a comprehensive demo dataset with 50+ bookmarks, collections, tags, highlights, and shared collections.

```bash
node scripts/seed-demo-data.js
```

**Prerequisites:**

- Demo user must exist (run `create-demo-user.js` first)
- API server must be running

**What it creates:**

- 10 collections with hierarchical structure
- 50+ bookmarks across various categories:
  - Web Development (JavaScript, React, Node.js)
  - Design (UI/UX, Figma, CSS)
  - DevOps (Docker, Kubernetes, Terraform)
  - Career (Interview prep, salary info)
  - Productivity (Tools and methods)
- Tags on all bookmarks
- 4 highlights with annotations (Pro feature)
- 1 public shared collection (Pro feature)

**Categories:**

- Web Development
  - JavaScript
    - React
    - Node.js
- Design
- DevOps
  - Docker
  - Kubernetes
- Career
- Productivity

### 3. Upgrade User to Pro (`upgrade-user-to-pro.js`)

Upgrades any user account to Pro tier directly in the database.

```bash
node scripts/upgrade-user-to-pro.js [email]
```

**Arguments:**

- `email` - User email to upgrade (default: `demo@example.com`)

**Example:**

```bash
node scripts/upgrade-user-to-pro.js user@example.com
```

### 4. Sample API Requests (`sample-api-requests.sh`)

Demonstrates common API operations using curl commands.

```bash
./scripts/sample-api-requests.sh
```

**Prerequisites:**

- API server running on localhost:3000
- Demo user created
- `jq` installed for JSON formatting

**What it demonstrates:**

1. User registration
2. User login
3. Get user profile
4. Create collection
5. Create bookmark
6. List bookmarks
7. Get bookmark details
8. Update bookmark
9. Create tag
10. List tags
11. Search bookmarks
12. Filter bookmarks by tags
13. Create highlight (Pro)
14. List collections
15. Export collection
16. Get user stats
17. Bulk operations (Pro)

### 5. Seed Large Dataset (`seed-large-dataset.js`)

Creates 100,000 bookmarks for load testing.

```bash
node scripts/seed-large-dataset.js
```

**Environment Variables:**

- `TARGET_BOOKMARKS` - Number of bookmarks to create (default: 100000)
- `TEST_USER_EMAIL` - Test user email
- `TEST_USER_PASSWORD` - Test user password

## Quick Start Guide

### Complete Demo Setup

Run these commands in order to set up a complete demo environment:

```bash
# 1. Start the infrastructure
npm run docker:up

# 2. Start the API server (in a separate terminal)
cd packages/backend
npm run dev

# 3. Create demo user with Pro plan
node scripts/create-demo-user.js

# 4. Seed demo data
node scripts/seed-demo-data.js

# 5. (Optional) Test API endpoints
./scripts/sample-api-requests.sh
```

### Login Credentials

After running the demo scripts, you can login with:

- **Email:** `demo@example.com`
- **Password:** `Demo123!`
- **Plan:** Pro (all features enabled)

## Environment Setup

Create a `.env` file in `packages/backend/` with:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bookmark_manager
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# MeiliSearch
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=masterKey

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# JWT
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
```

## Troubleshooting

### "Connection refused" errors

Make sure all services are running:

```bash
npm run docker:up
docker ps  # Verify all containers are running
```

### "User already exists" error

This is normal if you've run the scripts before. The scripts will continue and use the existing user.

### Pro features not working

Make sure the user has been upgraded to Pro:

```bash
node scripts/upgrade-user-to-pro.js demo@example.com
```

### Database connection errors

Check your database credentials in `packages/backend/.env` and ensure PostgreSQL is running:

```bash
docker ps | grep postgres
```

## Notes

- Pro features (highlights, sharing, backups, bulk operations) require the user to have `plan = 'pro'` in the database
- The demo data includes realistic bookmarks from popular developer resources
- All scripts are idempotent - safe to run multiple times
- Scripts use the API where possible to test real-world usage patterns
