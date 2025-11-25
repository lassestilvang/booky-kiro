# E2E Tests with Playwright

This directory contains end-to-end tests for the Bookmark Manager Platform using Playwright.

## Test Coverage

The E2E test suite covers the following areas:

### 1. Authentication (`auth.spec.ts`)

- User registration with valid credentials
- User login with registered credentials
- Invalid credential rejection
- Authentication persistence across page reloads
- **Validates**: Requirements 16.1, 16.2

### 2. Bookmark Management (`bookmarks.spec.ts`)

- Create bookmarks via web UI
- View bookmark details
- Update bookmark information
- Delete bookmarks
- Add tags to bookmarks
- **Validates**: Requirements 1.1, 1.2, 1.3, 1.4, 3.1

### 3. Collection Management (`collections.spec.ts`)

- Create collections with custom names
- Assign bookmarks to collections
- Move bookmarks between collections
- Delete collections
- Display collection hierarchy
- **Validates**: Requirements 2.1, 2.2, 2.3, 2.4

### 4. Search and Filtering (`search.spec.ts`)

- Search bookmarks by title
- Filter by tags
- Filter by domain
- Combine multiple filters
- Clear search and show all bookmarks
- Navigate to search page
- Handle no results gracefully
- **Validates**: Requirements 3.2, 3.3, 8.3, 17.1, 17.2

### 5. Import and Export (`import-export.spec.ts`)

- Import bookmarks from HTML file
- Export bookmarks to HTML format
- Export bookmarks to JSON format
- Export bookmarks to CSV format
- Export filtered bookmarks
- Preserve folder structure during import
- **Validates**: Requirements 7.1, 7.2, 7.3, 7.4, 7.5

### 6. Browser Extension (`extension.spec.ts`)

- Authenticate extension with OAuth
- Save current page via extension
- Save images and links via context menu (skipped - requires advanced setup)
- View recent bookmarks in side panel (skipped - requires advanced setup)
- **Validates**: Requirements 6.1, 6.2, 6.3, 6.4, 16.3

## Prerequisites

1. **Install Dependencies**

   ```bash
   pnpm install
   ```

2. **Install Playwright Browsers**

   ```bash
   pnpm --filter @bookmark-manager/frontend exec playwright install chromium
   ```

3. **Start Docker Services**

   ```bash
   npm run docker:up
   ```

4. **Build All Packages**
   ```bash
   npm run build
   ```

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Tests in UI Mode (Interactive)

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

### Run Specific Test File

```bash
npx playwright test e2e/auth.spec.ts
```

### Run Tests Matching Pattern

```bash
npx playwright test --grep "should register"
```

## Test Architecture

### Configuration

- **File**: `playwright.config.ts`
- **Base URL**: http://localhost:5173 (frontend)
- **API URL**: http://localhost:3000 (backend)
- **Workers**: 1 (sequential execution to avoid database conflicts)
- **Retries**: 2 in CI, 0 locally

### Test Structure

Each test file follows this pattern:

1. **Setup**: Register/login user, create test data
2. **Action**: Perform user actions via UI
3. **Assertion**: Verify expected outcomes
4. **Cleanup**: Automatic via test isolation

### Helper Functions

Common test utilities are available in `e2e/helpers.ts`:

- `registerAndLogin()` - Register and login a user
- `login()` - Login with existing credentials
- `createBookmark()` - Create a bookmark via UI
- `createCollection()` - Create a collection via UI
- `searchBookmarks()` - Search for bookmarks
- `generateTestEmail()` - Generate unique test email

## CI/CD Integration

The E2E tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    npm run docker:up
    npm run build
    npm run test:e2e
```

## Debugging Tests

### Visual Debugging

```bash
npm run test:e2e:debug
```

### View Test Report

After running tests, view the HTML report:

```bash
npx playwright show-report
```

### Screenshots and Videos

- Screenshots are captured on failure
- Traces are recorded on first retry
- Find artifacts in `test-results/` directory

## Known Limitations

1. **Extension Tests**: Full browser extension testing requires:
   - Building the extension first
   - Running in headed mode
   - Complex setup for context menus and side panels
   - Some tests are skipped pending advanced implementation

2. **Database State**: Tests run sequentially to avoid conflicts. Consider implementing:
   - Database cleanup between tests
   - Test-specific database instances
   - API endpoints for test data management

3. **Timing**: Some tests use `waitForTimeout()` for simplicity. Consider:
   - Using more specific wait conditions
   - Implementing custom wait helpers
   - Reducing flakiness with better selectors

## Best Practices

1. **Selectors**: Use semantic selectors in order of preference:
   - Text content: `text=Login`
   - ARIA labels: `[aria-label="Submit"]`
   - Test IDs: `[data-testid="login-button"]`
   - CSS selectors: `button.submit`

2. **Assertions**: Use Playwright's auto-waiting assertions:
   - `expect(locator).toBeVisible()`
   - `expect(locator).toHaveText()`
   - `expect(page).toHaveURL()`

3. **Test Isolation**: Each test should:
   - Create its own test data
   - Not depend on other tests
   - Clean up after itself (if needed)

4. **Timeouts**: Configure appropriate timeouts:
   - Default: 30 seconds
   - Navigation: 10 seconds
   - Custom waits: 5 seconds

## Troubleshooting

### Tests Fail to Start

- Ensure Docker services are running: `npm run docker:up`
- Check backend is accessible: `curl http://localhost:3000/health`
- Check frontend is accessible: `curl http://localhost:5173`

### Tests Are Flaky

- Increase timeouts in `playwright.config.ts`
- Use more specific selectors
- Add explicit waits for dynamic content
- Check for race conditions

### Extension Tests Don't Work

- Build extension first: `pnpm --filter @bookmark-manager/extension run build`
- Run in headed mode: `npm run test:e2e:headed`
- Check extension path in `extension.spec.ts`

## Contributing

When adding new E2E tests:

1. Follow existing test patterns
2. Use helper functions from `helpers.ts`
3. Add descriptive test names
4. Include requirement validation comments
5. Update this README with new test coverage
6. Ensure tests pass locally before committing

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
