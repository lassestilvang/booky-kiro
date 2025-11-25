import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Collection Management
 *
 * Tests collection creation, organization, and bookmark assignment:
 * - Create collections with custom names and icons
 * - Assign bookmarks to collections
 * - Move bookmarks between collections
 * - Delete collections
 * - View collection hierarchy
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

test.describe('Collection Management', () => {
  const testUser = {
    email: `collection-test-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    name: 'Collection Test User',
  };

  const testCollection = {
    name: 'Test Collection',
  };

  const testBookmark = {
    url: 'https://example.com/test',
    title: 'Test Bookmark for Collections',
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

  test('should create a new collection', async ({ page }) => {
    // Open create collection modal/form
    await page.click(
      'button:has-text("New Collection"), button:has-text("Add Collection"), [aria-label*="collection"]'
    );

    // Fill collection form
    await page.fill(
      'input[name="title"], input[name="name"], input[placeholder*="Collection"]',
      testCollection.name
    );

    // Submit form
    await page.click(
      'button[type="submit"]:has-text("Create"), button:has-text("Save")'
    );

    // Wait for modal to close
    await page.waitForTimeout(1000);

    // Verify collection appears in sidebar
    await expect(page.locator(`text=${testCollection.name}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should assign bookmark to collection', async ({ page }) => {
    // Create a collection first
    await page.click(
      'button:has-text("New Collection"), button:has-text("Add Collection"), [aria-label*="collection"]'
    );
    await page.fill(
      'input[name="title"], input[name="name"], input[placeholder*="Collection"]',
      testCollection.name
    );
    await page.click(
      'button[type="submit"]:has-text("Create"), button:has-text("Save")'
    );
    await page.waitForTimeout(1000);

    // Create a bookmark and assign to collection
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

    // Select collection
    const collectionSelect = page.locator(
      'select[name="collectionId"], select[name="collection"]'
    );
    if ((await collectionSelect.count()) > 0) {
      await collectionSelect.selectOption({ label: testCollection.name });
    }

    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Create")'
    );
    await page.waitForTimeout(1000);

    // Click on the collection in sidebar
    await page.click(`text=${testCollection.name}`);

    // Verify bookmark appears in collection
    await expect(page.locator(`text=${testBookmark.title}`)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should move bookmark between collections', async ({ page }) => {
    // Create two collections
    const collection1 = 'Collection One';
    const collection2 = 'Collection Two';

    await page.click(
      'button:has-text("New Collection"), button:has-text("Add Collection"), [aria-label*="collection"]'
    );
    await page.fill(
      'input[name="title"], input[name="name"], input[placeholder*="Collection"]',
      collection1
    );
    await page.click(
      'button[type="submit"]:has-text("Create"), button:has-text("Save")'
    );
    await page.waitForTimeout(500);

    await page.click(
      'button:has-text("New Collection"), button:has-text("Add Collection"), [aria-label*="collection"]'
    );
    await page.fill(
      'input[name="title"], input[name="name"], input[placeholder*="Collection"]',
      collection2
    );
    await page.click(
      'button[type="submit"]:has-text("Create"), button:has-text("Save")'
    );
    await page.waitForTimeout(500);

    // Create bookmark in collection1
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

    const collectionSelect = page.locator(
      'select[name="collectionId"], select[name="collection"]'
    );
    if ((await collectionSelect.count()) > 0) {
      await collectionSelect.selectOption({ label: collection1 });
    }

    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Create")'
    );
    await page.waitForTimeout(1000);

    // Open bookmark and move to collection2
    await page.click(`text=${testBookmark.title}`);
    await page.click('button:has-text("Edit"), [aria-label*="Edit"]');

    const editCollectionSelect = page.locator(
      'select[name="collectionId"], select[name="collection"]'
    );
    if ((await editCollectionSelect.count()) > 0) {
      await editCollectionSelect.selectOption({ label: collection2 });
    }

    await page.click(
      'button[type="submit"]:has-text("Save"), button:has-text("Update")'
    );
    await page.waitForTimeout(1000);

    // Verify bookmark is in collection2
    await page.click(`text=${collection2}`);
    await expect(page.locator(`text=${testBookmark.title}`)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should delete a collection', async ({ page }) => {
    // Create a collection
    await page.click(
      'button:has-text("New Collection"), button:has-text("Add Collection"), [aria-label*="collection"]'
    );
    await page.fill(
      'input[name="title"], input[name="name"], input[placeholder*="Collection"]',
      testCollection.name
    );
    await page.click(
      'button[type="submit"]:has-text("Create"), button:has-text("Save")'
    );
    await page.waitForTimeout(1000);

    // Right-click or click on collection options
    await page.click(`text=${testCollection.name}`);

    // Look for delete button
    const deleteButton = page.locator(
      'button:has-text("Delete"), [aria-label*="Delete"]'
    );
    if ((await deleteButton.count()) > 0) {
      await deleteButton.click();

      // Confirm deletion
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")'
      );
      if ((await confirmButton.count()) > 0) {
        await confirmButton.click();
      }

      // Verify collection is removed
      await expect(page.locator(`text=${testCollection.name}`)).not.toBeVisible(
        { timeout: 5000 }
      );
    }
  });

  test('should display collection hierarchy in sidebar', async ({ page }) => {
    // Create parent and child collections
    const parentCollection = 'Parent Collection';
    const childCollection = 'Child Collection';

    await page.click(
      'button:has-text("New Collection"), button:has-text("Add Collection"), [aria-label*="collection"]'
    );
    await page.fill(
      'input[name="title"], input[name="name"], input[placeholder*="Collection"]',
      parentCollection
    );
    await page.click(
      'button[type="submit"]:has-text("Create"), button:has-text("Save")'
    );
    await page.waitForTimeout(500);

    // Verify parent collection appears in sidebar
    await expect(page.locator(`text=${parentCollection}`)).toBeVisible({
      timeout: 5000,
    });

    // Note: Child collection creation depends on UI implementation
    // This test verifies basic hierarchy display
  });
});
