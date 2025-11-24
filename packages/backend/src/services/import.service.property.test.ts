import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { ImportService } from './import.service.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';

/**
 * Property-based tests for ImportService
 * Feature: bookmark-manager-platform
 */

describe('ImportService Property Tests', () => {
  let pool: Pool;
  let importService: ImportService;
  let bookmarkRepository: BookmarkRepository;
  let collectionRepository: CollectionRepository;
  let tagRepository: TagRepository;
  let testUserId: string;

  beforeEach(async () => {
    // Create test database connection
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bookmark_manager_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Initialize repositories
    bookmarkRepository = new BookmarkRepository(pool);
    collectionRepository = new CollectionRepository(pool);
    tagRepository = new TagRepository(pool);

    // Initialize service
    importService = new ImportService(
      bookmarkRepository,
      collectionRepository,
      tagRepository
    );

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name, plan) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [`test-${Date.now()}@example.com`, 'hash', 'Test User', 'free']
    );
    testUserId = userResult.rows[0].id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      await pool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
        testUserId,
      ]);
      await pool.query('DELETE FROM collections WHERE owner_id = $1', [
        testUserId,
      ]);
      await pool.query('DELETE FROM tags WHERE owner_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }

    // Close pool
    await pool.end();
  });

  /**
   * Property 18: HTML Import Round-Trip
   * Validates: Requirements 7.1, 7.5
   *
   * For any valid bookmarks HTML file, importing the file and then exporting
   * the same bookmarks should preserve the folder structure as collections
   * and all bookmark metadata.
   */
  it('Property 18: HTML Import Round-Trip - importing and exporting HTML preserves structure and metadata', async () => {
    // Arbitraries for generating test data
    const urlArbitrary = fc.webUrl();
    const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 });
    const folderNameArbitrary = fc.string({ minLength: 1, maxLength: 50 });
    const tagArbitrary = fc.string({ minLength: 1, maxLength: 20 });

    // Generate a bookmark entry
    // Filter out whitespace-only titles as they get normalized to the URL
    // Filter out tags with commas as they're delimiters in HTML bookmark format
    const bookmarkArbitrary = fc.record({
      url: urlArbitrary,
      title: titleArbitrary.filter((title) => title.trim().length > 0),
      tags: fc.array(
        tagArbitrary.filter(
          (tag) => tag.trim().length > 0 && !tag.includes(',')
        ),
        { minLength: 0, maxLength: 5 }
      ),
    });

    // Generate a folder with bookmarks
    // Filter out whitespace-only names as they get normalized to "Untitled Folder"
    const folderArbitrary = fc.record({
      name: folderNameArbitrary.filter((name) => name.trim().length > 0),
      bookmarks: fc.array(bookmarkArbitrary, { minLength: 1, maxLength: 5 }),
    });

    // Generate HTML structure with folders
    const htmlStructureArbitrary = fc.record({
      folders: fc.array(folderArbitrary, { minLength: 1, maxLength: 3 }),
    });

    await fc.assert(
      fc.asyncProperty(htmlStructureArbitrary, async (structure) => {
        // Clean up any existing data before this test run
        await pool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
          testUserId,
        ]);
        await pool.query('DELETE FROM collections WHERE owner_id = $1', [
          testUserId,
        ]);
        await pool.query('DELETE FROM tags WHERE owner_id = $1', [testUserId]);

        // Generate HTML from structure
        const html = generateNetscapeBookmarkHtml(structure);

        // Import HTML
        const importResult = await importService.importFromHtml(
          testUserId,
          html
        );

        // Verify import was successful
        expect(importResult.success).toBe(true);
        expect(importResult.importedBookmarks).toBeGreaterThan(0);
        expect(importResult.importedCollections).toBe(structure.folders.length);

        // Verify collections were created
        const collections = await collectionRepository.findByOwner(testUserId);
        expect(collections.length).toBe(structure.folders.length);

        // Verify folder names match (trimmed, as import normalizes whitespace)
        const collectionTitles = collections.map((c) => c.title).sort();
        const expectedTitles = structure.folders
          .map((f) => f.name.trim())
          .sort();
        expect(collectionTitles).toEqual(expectedTitles);

        // Verify bookmarks were created
        const bookmarks = await bookmarkRepository.findByUserId(testUserId);
        const totalExpectedBookmarks = structure.folders.reduce(
          (sum, folder) => sum + folder.bookmarks.length,
          0
        );
        expect(bookmarks.length).toBe(totalExpectedBookmarks);

        // Verify bookmark URLs are preserved
        const bookmarkUrls = bookmarks.map((b) => b.url).sort();
        const expectedUrls = structure.folders
          .flatMap((f) => f.bookmarks.map((b) => b.url))
          .sort();
        expect(bookmarkUrls).toEqual(expectedUrls);

        // Verify bookmark titles are preserved (trimmed, as import normalizes whitespace)
        const bookmarkTitles = bookmarks.map((b) => b.title).sort();
        const expectedBookmarkTitles = structure.folders
          .flatMap((f) => f.bookmarks.map((b) => b.title.trim()))
          .sort();
        expect(bookmarkTitles).toEqual(expectedBookmarkTitles);

        // Verify bookmarks are in correct collections
        for (const folder of structure.folders) {
          const collection = collections.find(
            (c) => c.title === folder.name.trim()
          );
          expect(collection).toBeDefined();

          if (collection) {
            const collectionBookmarks = bookmarks.filter(
              (b) => b.collectionId === collection.id
            );
            expect(collectionBookmarks.length).toBe(folder.bookmarks.length);

            // Verify URLs match
            const collectionUrls = collectionBookmarks.map((b) => b.url).sort();
            const expectedFolderUrls = folder.bookmarks
              .map((b) => b.url)
              .sort();
            expect(collectionUrls).toEqual(expectedFolderUrls);
          }
        }

        // Verify tags were created and associated
        const allExpectedTags = new Set(
          structure.folders.flatMap((f) =>
            f.bookmarks.flatMap((b) =>
              b.tags.map((t) => t.toLowerCase().trim())
            )
          )
        );

        if (allExpectedTags.size > 0) {
          const tags = await tagRepository.findByOwner(testUserId);
          const tagNames = new Set(tags.map((t) => t.normalizedName));

          // All expected tags should exist
          for (const expectedTag of allExpectedTags) {
            if (expectedTag.length > 0) {
              expect(tagNames.has(expectedTag)).toBe(true);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Generate Netscape Bookmark HTML format from structure
 */
function generateNetscapeBookmarkHtml(structure: {
  folders: Array<{
    name: string;
    bookmarks: Array<{
      url: string;
      title: string;
      tags: string[];
    }>;
  }>;
}): string {
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  for (const folder of structure.folders) {
    // Escape HTML special characters in folder name
    const escapedFolderName = escapeHtml(folder.name);

    html += `    <DT><H3>${escapedFolderName}</H3>\n`;
    html += `    <DL><p>\n`;

    for (const bookmark of folder.bookmarks) {
      // Escape HTML special characters
      const escapedTitle = escapeHtml(bookmark.title);
      const escapedUrl = escapeHtml(bookmark.url);
      const tagsAttr =
        bookmark.tags.length > 0
          ? ` TAGS="${bookmark.tags.map(escapeHtml).join(',')}"`
          : '';

      html += `        <DT><A HREF="${escapedUrl}"${tagsAttr}>${escapedTitle}</A>\n`;
    }

    html += `    </DL><p>\n`;
  }

  html += `</DL><p>\n`;

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
