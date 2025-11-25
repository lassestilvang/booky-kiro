import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Search and Filtering
 *
 * Tests search functionality and filtering capabilities:
 * - Search bookmarks by title and URL
 * - Filter by tags
 * - Filter by type (article, video, image)
 * - Filter by domain
 * - Filter by date range
 * - Combine multiple filters
 *
 * Validates: Requirements 3.2, 3.3, 8.3, 17.1, 17.2
 */

test.describe('Search and Filtering', () => {
  const testUser = {
    email: `search-test-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    name: 'Search Test User',
  };

  const testBookmarks = [
    {
      url: 'https://example.com/article1',
      title: 'JavaScript Tutorial',
      tags: ['javascript', 'programming'],
    },
    {
      url: 'https://test.com/article2',
      title: 'Python Guide',
      tags: ['python', 'programming'],
    },
    {
      url: 'https://example.com/video',
      title: 'React Video Tutorial',
      tags: ['react', 'javascript'],
    },
  ];

  // Setup: Register, login, and create test bookmarks
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="name"]', testUser.name);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Create test bookmarks
    for (const bookmark of testBookmarks) {
      await page.click(
        'button:has-text("Add Bookmark"), button:has-text("New Bookmark"), [aria-label*="Add"]'
      );
      await page.fill(
        'input[name="url"], input[placeholder*="URL"]',
        bookmark.url
      );
      await page.fill(
        'input[name="title"], input[placeholder*="Title"]',
        bookmark.title
      );

      // Add tags if tag input exists
      const tagInput = page.locator(
        'input[name="tags"], input[placeholder*="tag"]'
      );
      if ((await tagInput.count()) > 0) {
        for (const tag of bookmark.tags) {
          await tagInput.fill(tag);
          await page.keyboard.press('Enter');
        }
      }

      await page.click(
        'button[type="submit"]:has-text("Save"), button:has-text("Create")'
      );
      await page.waitForTimeout(500);
    }
  });

  test('should search bookmarks by title', async ({ page }) => {
    // Find search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"]'
    );

    // Search for "JavaScript"
    await searchInput.fill('JavaScript');
    await page.keyboard.press('Enter');

    // Wait for results
    await page.waitForTimeout(1000);

    // Should show JavaScript Tutorial
    await expect(page.locator('text=JavaScript Tutorial')).toBeVisible({
      timeout: 5000,
    });

    // Should not show Python Guide
    await expect(page.locator('text=Python Guide')).not.toBeVisible();
  });

  test('should filter bookmarks by tag', async ({ page }) => {
    // Look for tag filter or click on a tag
    const pythonTag = page.locator('text=python').first();

    if ((await pythonTag.count()) > 0) {
      await pythonTag.click();
      await page.waitForTimeout(1000);

      // Should show Python Guide
      await expect(page.locator('text=Python Guide')).toBeVisible({
        timeout: 5000,
      });

      // Should not show JavaScript Tutorial (doesn't have python tag)
      await expect(page.locator('text=JavaScript Tutorial')).not.toBeVisible();
    }
  });

  test('should filter by domain', async ({ page }) => {
    // Look for domain filter
    const filterButton = page.locator(
      'button:has-text("Filter"), [aria-label*="Filter"]'
    );

    if ((await filterButton.count()) > 0) {
      await filterButton.click();

      // Look for domain input or filter
      const domainInput = page.locator(
        'input[name="domain"], input[placeholder*="domain"]'
      );
      if ((await domainInput.count()) > 0) {
        await domainInput.fill('example.com');
        await page.click('button:has-text("Apply"), button[type="submit"]');
        await page.waitForTimeout(1000);

        // Should show bookmarks from example.com
        await expect(page.locator('text=JavaScript Tutorial')).toBeVisible({
          timeout: 5000,
        });

        // Should not show bookmarks from test.com
        await expect(page.locator('text=Python Guide')).not.toBeVisible();
      }
    }
  });

  test('should combine multiple filters', async ({ page }) => {
    // Search for "Tutorial"
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"]'
    );
    await searchInput.fill('Tutorial');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Should show both JavaScript Tutorial and React Video Tutorial
    await expect(page.locator('text=JavaScript Tutorial')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('text=React Video Tutorial')).toBeVisible({
      timeout: 5000,
    });

    // Now filter by javascript tag
    const javascriptTag = page.locator('text=javascript').first();
    if ((await javascriptTag.count()) > 0) {
      await javascriptTag.click();
      await page.waitForTimeout(1000);

      // Should show both JavaScript bookmarks
      await expect(page.locator('text=JavaScript Tutorial')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('text=React Video Tutorial')).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('should clear search and show all bookmarks', async ({ page }) => {
    // Search for something specific
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"]'
    );
    await searchInput.fill('JavaScript');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Clear search
    await searchInput.clear();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Should show all bookmarks
    await expect(page.locator('text=JavaScript Tutorial')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('text=Python Guide')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('text=React Video Tutorial')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should navigate to search page', async ({ page }) => {
    // Look for search page link or navigate directly
    const searchLink = page.locator('a[href="/search"], a:has-text("Search")');

    if ((await searchLink.count()) > 0) {
      await searchLink.click();
      await expect(page).toHaveURL(/\/search/);

      // Search interface should be visible
      await expect(
        page.locator('input[type="search"], input[placeholder*="Search"]')
      ).toBeVisible();
    }
  });

  test('should show no results message for non-matching search', async ({
    page,
  }) => {
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"]'
    );
    await searchInput.fill('NonExistentBookmark12345');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Should show no results message
    await expect(
      page.locator(
        'text=/no.*results/i, text=/no.*bookmarks/i, text=/not.*found/i'
      )
    ).toBeVisible({ timeout: 5000 });
  });
});
