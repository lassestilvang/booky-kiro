import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * Tests the complete bookmark manager platform including:
 * - User registration and authentication
 * - Bookmark creation via web UI
 * - Collection management
 * - Search and filtering
 * - Import/export functionality
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid database conflicts
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start dev servers before running tests
  webServer: [
    {
      command: 'pnpm --filter @bookmark-manager/backend run dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm --filter @bookmark-manager/frontend run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
