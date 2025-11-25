# E2E Tests Quick Start Guide

## Prerequisites

1. **Docker** - Ensure Docker Desktop is running
2. **Node.js 20+** - Check with `node --version`
3. **pnpm** - Check with `pnpm --version`

## Setup (First Time Only)

```bash
# 1. Install dependencies
pnpm install

# 2. Start Docker services
npm run docker:up

# 3. Build all packages
npm run build

# 4. Install Playwright browsers
npx playwright install chromium
```

Or use the automated setup script:

```bash
./e2e/setup.sh
```

## Running Tests

### Run All Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test e2e/auth.spec.ts
```

### Run Tests in UI Mode (Recommended for Development)

```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode (See Browser)

```bash
npm run test:e2e:headed
```

### Run Tests in Debug Mode

```bash
npm run test:e2e:debug
```

### Run Smoke Tests Only

```bash
npx playwright test e2e/smoke.spec.ts
```

## Test Files

- `smoke.spec.ts` - Quick sanity checks (run first)
- `auth.spec.ts` - User registration and login
- `bookmarks.spec.ts` - Bookmark CRUD operations
- `collections.spec.ts` - Collection management
- `search.spec.ts` - Search and filtering
- `import-export.spec.ts` - Import/export functionality
- `extension.spec.ts` - Browser extension (partial)
- `user-journey.spec.ts` - Complete user workflow

## Viewing Results

### HTML Report

After running tests, view the report:

```bash
npx playwright show-report
```

### Test Results Directory

- Screenshots: `test-results/`
- Videos: `test-results/`
- Traces: `test-results/`

## Troubleshooting

### "Cannot connect to backend"

```bash
# Check if backend is running
curl http://localhost:3000/health

# If not, start services
npm run docker:up
npm run build
```

### "Cannot connect to frontend"

```bash
# Check if frontend is running
curl http://localhost:5173

# The Playwright config will start it automatically
# But you can start it manually:
pnpm --filter @bookmark-manager/frontend run dev
```

### "Tests are failing"

```bash
# 1. Clean and rebuild
npm run build

# 2. Restart Docker services
npm run docker:down
npm run docker:up

# 3. Run smoke tests first
npx playwright test e2e/smoke.spec.ts

# 4. Run with UI to debug
npm run test:e2e:ui
```

### "Extension tests don't work"

```bash
# Build extension first
pnpm --filter @bookmark-manager/extension run build

# Run in headed mode
npm run test:e2e:headed
```

## Tips

1. **Start with smoke tests** - Verify basic setup
2. **Use UI mode** - Best for development and debugging
3. **Run specific tests** - Faster iteration during development
4. **Check Docker logs** - If services aren't responding
5. **View HTML report** - Detailed test results and screenshots

## Common Commands

```bash
# Full test cycle
npm run docker:up && npm run build && npm run test:e2e

# Quick smoke test
npx playwright test e2e/smoke.spec.ts --headed

# Debug specific test
npx playwright test e2e/auth.spec.ts --debug

# Run tests matching pattern
npx playwright test --grep "should register"

# Update snapshots (if using visual regression)
npx playwright test --update-snapshots
```

## Next Steps

- Read `e2e/README.md` for comprehensive documentation
- Check `E2E_TESTS_IMPLEMENTATION.md` for implementation details
- Review test files to understand patterns
- Add new tests following existing patterns

## Getting Help

- Playwright Docs: https://playwright.dev
- Project README: `e2e/README.md`
- Implementation Summary: `E2E_TESTS_IMPLEMENTATION.md`
