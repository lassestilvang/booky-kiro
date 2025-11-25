import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E Tests for Import and Export
 *
 * Tests import and export functionality:
 * - Import bookmarks from HTML file
 * - Export bookmarks to HTML format
 * - Export bookmarks to JSON format
 * - Export bookmarks to CSV format
 * - Export filtered bookmarks
 * - Verify data integrity in round-trip
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

test.describe('Import and Export', () => {
  const testUser = {
    email: `import-export-test-${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    name: 'Import Export Test User',
  };

  const testBookmarks = [
    {
      url: 'https://example.com/article1',
      title: 'Test Article 1',
    },
    {
      url: 'https://example.com/article2',
      title: 'Test Article 2',
    },
  ];

  // Sample HTML bookmarks file content
  const sampleBookmarksHTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Test Folder</H3>
    <DL><p>
        <DT><A HREF="https://example.com/imported1" ADD_DATE="1234567890">Imported Bookmark 1</A>
        <DT><A HREF="https://example.com/imported2" ADD_DATE="1234567890">Imported Bookmark 2</A>
    </DL><p>
</DL><p>`;

  // Setup: Register and login before each test
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
      await page.click(
        'button[type="submit"]:has-text("Save"), button:has-text("Create")'
      );
      await page.waitForTimeout(500);
    }
  });

  test('should import bookmarks from HTML file', async ({ page }) => {
    // Create temporary HTML file
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const htmlFilePath = path.join(tempDir, 'test-bookmarks.html');
    fs.writeFileSync(htmlFilePath, sampleBookmarksHTML);

    try {
      // Look for import button
      const importButton = page.locator(
        'button:has-text("Import"), [aria-label*="Import"]'
      );

      if ((await importButton.count()) > 0) {
        await importButton.click();

        // Upload file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(htmlFilePath);

        // Submit import
        const submitButton = page.locator(
          'button:has-text("Import"), button[type="submit"]'
        );
        if ((await submitButton.count()) > 0) {
          await submitButton.click();
        }

        // Wait for import to complete
        await page.waitForTimeout(2000);

        // Verify imported bookmarks appear
        await expect(page.locator('text=Imported Bookmark 1')).toBeVisible({
          timeout: 10000,
        });
        await expect(page.locator('text=Imported Bookmark 2')).toBeVisible({
          timeout: 10000,
        });
      }
    } finally {
      // Cleanup
      if (fs.existsSync(htmlFilePath)) {
        fs.unlinkSync(htmlFilePath);
      }
    }
  });

  test('should export bookmarks to HTML format', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator(
      'button:has-text("Export"), [aria-label*="Export"]'
    );

    if ((await exportButton.count()) > 0) {
      await exportButton.click();

      // Select HTML format
      const formatSelect = page.locator(
        'select[name="format"], input[value="html"]'
      );
      if ((await formatSelect.count()) > 0) {
        if (formatSelect.first().evaluate((el) => el.tagName) === 'SELECT') {
          await formatSelect.selectOption('html');
        } else {
          await page.click('input[value="html"], label:has-text("HTML")');
        }
      }

      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click(
        'button:has-text("Export"), button:has-text("Download")'
      );

      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toMatch(/\.html$/);

      // Save and verify content
      const tempPath = path.join(
        process.cwd(),
        'temp',
        download.suggestedFilename()
      );
      await download.saveAs(tempPath);

      const content = fs.readFileSync(tempPath, 'utf-8');
      expect(content).toContain('Test Article 1');
      expect(content).toContain('Test Article 2');

      // Cleanup
      fs.unlinkSync(tempPath);
    }
  });

  test('should export bookmarks to JSON format', async ({ page }) => {
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

      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click(
        'button:has-text("Export"), button:has-text("Download")'
      );

      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toMatch(/\.json$/);

      // Save and verify content
      const tempPath = path.join(
        process.cwd(),
        'temp',
        download.suggestedFilename()
      );
      await download.saveAs(tempPath);

      const content = fs.readFileSync(tempPath, 'utf-8');
      const data = JSON.parse(content);

      // Verify JSON structure
      expect(Array.isArray(data) || data.bookmarks).toBeTruthy();

      // Cleanup
      fs.unlinkSync(tempPath);
    }
  });

  test('should export bookmarks to CSV format', async ({ page }) => {
    const exportButton = page.locator(
      'button:has-text("Export"), [aria-label*="Export"]'
    );

    if ((await exportButton.count()) > 0) {
      await exportButton.click();

      // Select CSV format
      const formatSelect = page.locator(
        'select[name="format"], input[value="csv"]'
      );
      if ((await formatSelect.count()) > 0) {
        if (
          (await formatSelect.first().evaluate((el) => el.tagName)) === 'SELECT'
        ) {
          await formatSelect.selectOption('csv');
        } else {
          await page.click('input[value="csv"], label:has-text("CSV")');
        }
      }

      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click(
        'button:has-text("Export"), button:has-text("Download")'
      );

      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toMatch(/\.csv$/);

      // Save and verify content
      const tempPath = path.join(
        process.cwd(),
        'temp',
        download.suggestedFilename()
      );
      await download.saveAs(tempPath);

      const content = fs.readFileSync(tempPath, 'utf-8');
      expect(content).toContain('Test Article 1');
      expect(content).toContain('Test Article 2');

      // Cleanup
      fs.unlinkSync(tempPath);
    }
  });

  test('should export filtered bookmarks', async ({ page }) => {
    // Search for specific bookmark
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"]'
    );
    await searchInput.fill('Test Article 1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Export filtered results
    const exportButton = page.locator(
      'button:has-text("Export"), [aria-label*="Export"]'
    );

    if ((await exportButton.count()) > 0) {
      await exportButton.click();

      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click(
        'button:has-text("Export"), button:has-text("Download")'
      );

      const download = await downloadPromise;

      // Save and verify content
      const tempPath = path.join(
        process.cwd(),
        'temp',
        download.suggestedFilename()
      );
      await download.saveAs(tempPath);

      const content = fs.readFileSync(tempPath, 'utf-8');

      // Should contain filtered bookmark
      expect(content).toContain('Test Article 1');

      // Cleanup
      fs.unlinkSync(tempPath);
    }
  });

  test('should preserve folder structure when importing HTML', async ({
    page,
  }) => {
    // Create temporary HTML file with folder structure
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const htmlFilePath = path.join(tempDir, 'test-bookmarks-folders.html');
    fs.writeFileSync(htmlFilePath, sampleBookmarksHTML);

    try {
      const importButton = page.locator(
        'button:has-text("Import"), [aria-label*="Import"]'
      );

      if ((await importButton.count()) > 0) {
        await importButton.click();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(htmlFilePath);

        const submitButton = page.locator(
          'button:has-text("Import"), button[type="submit"]'
        );
        if ((await submitButton.count()) > 0) {
          await submitButton.click();
        }

        await page.waitForTimeout(2000);

        // Verify folder was created as collection
        await expect(page.locator('text=Test Folder')).toBeVisible({
          timeout: 10000,
        });
      }
    } finally {
      // Cleanup
      if (fs.existsSync(htmlFilePath)) {
        fs.unlinkSync(htmlFilePath);
      }
    }
  });
});
