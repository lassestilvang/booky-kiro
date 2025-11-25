import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Bookmark Management via Web UI
 *
 * Tests bookmark creation, viewing, updating, and deletion through the web interface:
 * - Create bookmarks with URL, title, and metadata
 * - View bookmark details
 * - Update bookmark information
 * - Delete bookmarks
 * - Add tags to bookmarks
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 3.1
 */

test.describe('Bookmark Management', () => {
  const testUser = {
    email: `bookmark-test-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    name: 'Bookmark Test User',
  };

  const testBookmark = {
    url: 'https://example.com/article',
    title: 'Test Article',
    excerpt: 'This is a test article for E2E testing',
  };

  // Setup: Register and login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="name"]', testUser.name);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a new bookmark via web UI', async ({ page }) => {
    // Open create bookmark modal/form
    await page.click(
      'button:has-text("Add Bookmark"), button:has-text("New Bookmark"), [aria-label*="Add"]'
    );

    // Fill bookmark form
    await page.fill(
      'input[name="url"], input[placeholder*="URL"]',
      testBookmark.url
    );
    await page.fill(
      'input[name="title"], input[placeholder*="Title"]',
      testBookmark.title
    );

    // Check if excerpt field exists and fill it
    const excerptField = page.locator(
      'textarea[name="excerpt"], textarea[placeholder*="Description"]'
    );
    if ((await excerptField.count()) > 0) {
      await excerptField.fill(testBookmark.excerpt);
    }

    // Submit form
    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Create")'
    );

    // Wait for modal to close and bookmark to appear
    await page.waitForTimeout(1000);

    // Verify bookmark appears in the list
    await expect(page.locator(`text=${testBookmark.title}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should view bookmark details', async ({ page }) => {
    // Create a bookmark first
    await page.click(
      'button:has-text("Add Bookmark"), button:has-text("New Bookmark"), [aria-label*="Add"]'
    );
    await page.fill(
      'input[name="url"], input[placeholder*="URL"]',
      testBookmark.url
    );
    await page.fill(
      'input[name="title"], input[placeholder*="Title"]',
      testBookmark.title
    );
    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Create")'
    );
    await page.waitForTimeout(1000);

    // Click on the bookmark to view details
    await page.click(`text=${testBookmark.title}`);

    // Verify details are displayed
    await expect(page.locator(`text=${testBookmark.url}`)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should update bookmark information', async ({ page }) => {
    // Create a bookmark
    await page.click(
      'button:has-text("Add Bookmark"), button:has-text("New Bookmark"), [aria-label*="Add"]'
    );
    await page.fill(
      'input[name="url"], input[placeholder*="URL"]',
      testBookmark.url
    );
    await page.fill(
      'input[name="title"], input[placeholder*="Title"]',
      testBookmark.title
    );
    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Create")'
    );
    await page.waitForTimeout(1000);

    // Open bookmark for editing
    await page.click(`text=${testBookmark.title}`);
    await page.click('button:has-text("Edit"), [aria-label*="Edit"]');

    // Update title
    const updatedTitle = 'Updated Test Article';
    await page.fill(
      'input[name="title"], input[placeholder*="Title"]',
      updatedTitle
    );
    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Update")'
    );

    // Verify updated title appears
    await expect(page.locator(`text=${updatedTitle}`)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should delete a bookmark', async ({ page }) => {
    // Create a bookmark
    await page.click(
      'button:has-text("Add Bookmark"), button:has-text("New Bookmark"), [aria-label*="Add"]'
    );
    await page.fill(
      'input[name="url"], input[placeholder*="URL"]',
      testBookmark.url
    );
    await page.fill(
      'input[name="title"], input[placeholder*="Title"]',
      testBookmark.title
    );
    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Create")'
    );
    await page.waitForTimeout(1000);

    // Open bookmark details
    await page.click(`text=${testBookmark.title}`);

    // Delete bookmark
    await page.click('button:has-text("Delete"), [aria-label*="Delete"]');

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.locator(
      'button:has-text("Confirm"), button:has-text("Yes")'
    );
    if ((await confirmButton.count()) > 0) {
      await confirmButton.click();
    }

    // Verify bookmark is removed from list
    await expect(page.locator(`text=${testBookmark.title}`)).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('should add tags to a bookmark', async ({ page }) => {
    // Create a bookmark
    await page.click(
      'button:has-text("Add Bookmark"), button:has-text("New Bookmark"), [aria-label*="Add"]'
    );
    await page.fill(
      'input[name="url"], input[placeholder*="URL"]',
      testBookmark.url
    );
    await page.fill(
      'input[name="title"], input[placeholder*="Title"]',
      testBookmark.title
    );

    // Add tags
    const tagInput = page.locator(
      'input[name="tags"], input[placeholder*="tag"]'
    );
    if ((await tagInput.count()) > 0) {
      await tagInput.fill('test-tag');
      await page.keyboard.press('Enter');
      await tagInput.fill('e2e');
      await page.keyboard.press('Enter');
    }

    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Create")'
    );
    await page.waitForTimeout(1000);

    // Open bookmark details
    await page.click(`text=${testBookmark.title}`);

    // Verify tags are displayed
    await expect(page.locator('text=test-tag')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=e2e')).toBeVisible({ timeout: 5000 });
  });
});
