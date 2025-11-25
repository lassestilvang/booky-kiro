import { Page } from '@playwright/test';

/**
 * E2E Test Helper Functions
 *
 * Common utilities for E2E tests to reduce code duplication
 * and provide consistent test patterns.
 */

/**
 * Register a new user and login
 */
export async function registerAndLogin(
  page: Page,
  email: string,
  password: string,
  name: string
): Promise<void> {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="name"]', name);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Login with existing credentials
 */
export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Create a bookmark via UI
 */
export async function createBookmark(
  page: Page,
  url: string,
  title: string,
  options?: {
    excerpt?: string;
    tags?: string[];
    collectionName?: string;
  }
): Promise<void> {
  // Open create bookmark modal
  await page.click(
    'button:has-text("Add Bookmark"), button:has-text("New Bookmark"), [aria-label*="Add"]'
  );

  // Fill required fields
  await page.fill('input[name="url"], input[placeholder*="URL"]', url);
  await page.fill('input[name="title"], input[placeholder*="Title"]', title);

  // Fill optional fields
  if (options?.excerpt) {
    const excerptField = page.locator(
      'textarea[name="excerpt"], textarea[placeholder*="Description"]'
    );
    if ((await excerptField.count()) > 0) {
      await excerptField.fill(options.excerpt);
    }
  }

  if (options?.tags) {
    const tagInput = page.locator(
      'input[name="tags"], input[placeholder*="tag"]'
    );
    if ((await tagInput.count()) > 0) {
      for (const tag of options.tags) {
        await tagInput.fill(tag);
        await page.keyboard.press('Enter');
      }
    }
  }

  if (options?.collectionName) {
    const collectionSelect = page.locator(
      'select[name="collectionId"], select[name="collection"]'
    );
    if ((await collectionSelect.count()) > 0) {
      await collectionSelect.selectOption({ label: options.collectionName });
    }
  }

  // Submit form
  await page.click(
    'button[type="submit"]:has-text("Save"), button:has-text("Create")'
  );
  await page.waitForTimeout(1000);
}

/**
 * Create a collection via UI
 */
export async function createCollection(
  page: Page,
  name: string
): Promise<void> {
  await page.click(
    'button:has-text("New Collection"), button:has-text("Add Collection"), [aria-label*="collection"]'
  );
  await page.fill(
    'input[name="title"], input[name="name"], input[placeholder*="Collection"]',
    name
  );
  await page.click(
    'button[type="submit"]:has-text("Create"), button:has-text("Save")'
  );
  await page.waitForTimeout(1000);
}

/**
 * Search for bookmarks
 */
export async function searchBookmarks(
  page: Page,
  query: string
): Promise<void> {
  const searchInput = page.locator(
    'input[type="search"], input[placeholder*="Search"]'
  );
  await searchInput.fill(query);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
}

/**
 * Wait for element to be visible with custom timeout
 */
export async function waitForVisible(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<void> {
  await page.locator(selector).waitFor({ state: 'visible', timeout });
}

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}@example.com`;
}

/**
 * Clean up test data (if needed)
 */
export async function cleanupTestData(page: Page): Promise<void> {
  // This could be implemented to call API endpoints to clean up test data
  // For now, it's a placeholder
}
