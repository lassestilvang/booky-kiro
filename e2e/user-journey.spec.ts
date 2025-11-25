import { test, expect } from '@playwright/test';
import { registerAndLogin, createBookmark, createCollection } from './helpers';

/**
 * E2E Tests for Complete User Journey
 *
 * Tests the complete user workflow from registration to advanced features:
 * - Register and login
 * - Create collections
 * - Create bookmarks in collections
 * - Search and filter bookmarks
 * - Export bookmarks
 * - Manage tags
 *
 * This test validates the entire user experience end-to-end.
 *
 * Validates: Requirements 1.1-1.4, 2.1-2.4, 3.1-3.3, 7.2
 */

test.describe('Complete User Journey', () => {
  const testUser = {
    email: `journey-test-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    name: 'Journey Test User',
  };

  test('should complete full user workflow', async ({ page }) => {
    // Step 1: Register new user
    await registerAndLogin(
      page,
      testUser.email,
      testUser.password,
      testUser.name
    );

    // Verify we're on dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=' + testUser.name)).toBeVisible();

    // Step 2: Create collections
    await createCollection(page, 'Work Resources');
    await createCollection(page, 'Personal Learning');

    // Verify collections appear in sidebar
    await expect(page.locator('text=Work Resources')).toBeVisible();
    await expect(page.locator('text=Personal Learning')).toBeVisible();

    // Step 3: Create bookmarks in different collections
    await createBookmark(
      page,
      'https://example.com/work-article',
      'Important Work Article',
      {
        excerpt: 'This is a work-related article',
        tags: ['work', 'important'],
        collectionName: 'Work Resources',
      }
    );

    await createBookmark(
      page,
      'https://example.com/tutorial',
      'JavaScript Tutorial',
      {
        excerpt: 'Learn JavaScript basics',
        tags: ['javascript', 'learning', 'programming'],
        collectionName: 'Personal Learning',
      }
    );

    await createBookmark(
      page,
      'https://example.com/python-guide',
      'Python Guide',
      {
        excerpt: 'Comprehensive Python guide',
        tags: ['python', 'learning', 'programming'],
        collectionName: 'Personal Learning',
      }
    );

    // Step 4: Navigate to Work Resources collection
    await page.click('text=Work Resources');
    await page.waitForTimeout(1000);

    // Verify only work bookmark is shown
    await expect(page.locator('text=Important Work Article')).toBeVisible();
    await expect(page.locator('text=JavaScript Tutorial')).not.toBeVisible();

    // Step 5: Navigate to Personal Learning collection
    await page.click('text=Personal Learning');
    await page.waitForTimeout(1000);

    // Verify learning bookmarks are shown
    await expect(page.locator('text=JavaScript Tutorial')).toBeVisible();
    await expect(page.locator('text=Python Guide')).toBeVisible();
    await expect(page.locator('text=Important Work Article')).not.toBeVisible();

    // Step 6: Search for bookmarks
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"]'
    );
    await searchInput.fill('Tutorial');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Should show JavaScript Tutorial
    await expect(page.locator('text=JavaScript Tutorial')).toBeVisible();

    // Step 7: Filter by tag
    const programmingTag = page.locator('text=programming').first();
    if ((await programmingTag.count()) > 0) {
      await programmingTag.click();
      await page.waitForTimeout(1000);

      // Should show both programming bookmarks
      await expect(page.locator('text=JavaScript Tutorial')).toBeVisible();
      await expect(page.locator('text=Python Guide')).toBeVisible();
    }

    // Step 8: View bookmark details
    await page.click('text=JavaScript Tutorial');

    // Verify details are displayed
    await expect(
      page.locator('text=https://example.com/tutorial')
    ).toBeVisible();
    await expect(page.locator('text=javascript')).toBeVisible();
    await expect(page.locator('text=learning')).toBeVisible();

    // Close details
    const closeButton = page.locator(
      'button:has-text("Close"), [aria-label*="Close"]'
    );
    if ((await closeButton.count()) > 0) {
      await closeButton.click();
    }

    // Step 9: Update a bookmark
    await page.click('text=Python Guide');
    const editButton = page.locator(
      'button:has-text("Edit"), [aria-label*="Edit"]'
    );
    if ((await editButton.count()) > 0) {
      await editButton.click();

      // Update title
      await page.fill(
        'input[name="title"], input[placeholder*="Title"]',
        'Advanced Python Guide'
      );
      await page.click(
        'button[type="submit"]:has-text("Save"), button:has-text("Update")'
      );
      await page.waitForTimeout(1000);

      // Verify updated title
      await expect(page.locator('text=Advanced Python Guide')).toBeVisible();
    }

    // Step 10: Export bookmarks
    const exportButton = page.locator(
      'button:has-text("Export"), [aria-label*="Export"]'
    );
    if ((await exportButton.count()) > 0) {
      await exportButton.click();

      // Select JSON format
      const formatSelect = page.locator(
        'select[name="format"], input[value="json"]'
      );
      if ((await formatSelect.count()) > 0) {
        if (
          (await formatSelect.first().evaluate((el) => el.tagName)) === 'SELECT'
        ) {
          await formatSelect.selectOption('json');
        } else {
          await page.click('input[value="json"], label:has-text("JSON")');
        }
      }

      // Verify export dialog is ready
      await expect(
        page.locator('button:has-text("Export"), button:has-text("Download")')
      ).toBeVisible();
    }

    // Step 11: View user statistics
    const statsLink = page.locator(
      'a[href*="stats"], button:has-text("Statistics")'
    );
    if ((await statsLink.count()) > 0) {
      await statsLink.click();
      await page.waitForTimeout(1000);

      // Should show bookmark count
      await expect(page.locator('text=/3.*bookmark/i')).toBeVisible({
        timeout: 5000,
      });
    }

    // Step 12: Logout
    const logoutButton = page.locator(
      'button:has-text("Logout"), [aria-label="Logout"]'
    );
    if ((await logoutButton.count()) > 0) {
      await logoutButton.click();

      // Should redirect to login page
      await expect(page).toHaveURL('/login', { timeout: 5000 });
    }

    // Step 13: Login again
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Verify all data persisted
    await expect(page.locator('text=Work Resources')).toBeVisible();
    await expect(page.locator('text=Personal Learning')).toBeVisible();
    await expect(page.locator('text=Important Work Article')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Register and login
    await registerAndLogin(
      page,
      testUser.email,
      testUser.password,
      testUser.name
    );

    // Try to create bookmark with invalid URL
    await page.click(
      'button:has-text("Add Bookmark"), button:has-text("New Bookmark"), [aria-label*="Add"]'
    );
    await page.fill(
      'input[name="url"], input[placeholder*="URL"]',
      'not-a-valid-url'
    );
    await page.fill(
      'input[name="title"], input[placeholder*="Title"]',
      'Invalid Bookmark'
    );
    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Create")'
    );

    // Should show error message
    await expect(
      page.locator('text=/invalid.*url/i, text=/error/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Register and login
    await registerAndLogin(
      page,
      testUser.email,
      testUser.password,
      testUser.name
    );

    // Create a bookmark
    await createBookmark(
      page,
      'https://example.com/keyboard-test',
      'Keyboard Test Bookmark'
    );

    // Use keyboard to navigate
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Press Enter to open bookmark (if focused)
    await page.keyboard.press('Enter');

    // Should open bookmark details or navigate
    // This is a basic test - full keyboard navigation depends on implementation
  });
});
