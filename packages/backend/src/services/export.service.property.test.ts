import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { ExportService } from './export.service.js';
import { ImportService } from './import.service.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { Bookmark, Collection, Tag } from '@bookmark-manager/shared';

// Test database configuration
const testPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bookmark_manager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Initialize repositories
const bookmarkRepository = new BookmarkRepository(testPool);
const collectionRepository = new CollectionRepository(testPool);
const tagRepository = new TagRepository(testPool);
const userRepository = new UserRepository(testPool);

// Initialize services
const exportService = new ExportService(
  bookmarkRepository,
  collectionRepository,
  tagRepository
);
const importService = new ImportService(
  bookmarkRepository,
  collectionRepository,
  tagRepository
);

// Test user ID
let testUserId: string;

beforeAll(async () => {
  // Create a test user
  const user = await userRepository.create({
    email: `export-test-${Date.now()}@example.com`,
    passwordHash: 'test-hash',
    name: 'Export Test User',
    plan: 'pro',
  });
  testUserId = user.id;
});

afterAll(async () => {
  // Clean up test user and related data
  await testPool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  await testPool.end();
});

beforeEach(async () => {
  // Clean up test data before each test
  // Delete in correct order to respect foreign key constraints
  await testPool.query(
    'DELETE FROM bookmark_tags WHERE bookmark_id IN (SELECT id FROM bookmarks WHERE owner_id = $1)',
    [testUserId]
  );
  await testPool.query('DELETE FROM highlights WHERE owner_id = $1', [
    testUserId,
  ]);
  await testPool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
    testUserId,
  ]);
  await testPool.query('DELETE FROM collections WHERE owner_id = $1', [
    testUserId,
  ]);
  await testPool.query('DELETE FROM tags WHERE owner_id = $1', [testUserId]);
});

// Arbitraries for property-based testing
const urlArbitrary = fc.webUrl();

const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 });

const excerptArbitrary = fc.option(
  fc.string({ minLength: 0, maxLength: 500 }),
  {
    nil: undefined,
  }
);

const typeArbitrary = fc.constantFrom(
  'article',
  'video',
  'image',
  'file',
  'document'
);

const tagNameArbitrary = fc.string({ minLength: 1, maxLength: 50 });

const bookmarkArbitrary = fc.record({
  url: urlArbitrary,
  title: titleArbitrary,
  excerpt: excerptArbitrary,
  type: typeArbitrary,
  tags: fc.array(tagNameArbitrary, { minLength: 0, maxLength: 5 }),
});

const collectionArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  icon: fc.option(fc.string({ minLength: 1, maxLength: 10 }), {
    nil: undefined,
  }),
});

describe('ExportService Property Tests', () => {
  /**
   * Feature: bookmark-manager-platform, Property 19: Export Completeness
   * Validates: Requirements 7.2
   *
   * For any collection with bookmarks, exporting the collection should generate
   * a file containing all bookmarks with complete metadata and tags.
   */
  it('Property 19: Export Completeness - exported collection contains all bookmarks with metadata and tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        collectionArbitrary,
        fc.array(bookmarkArbitrary, { minLength: 1, maxLength: 10 }),
        async (collectionData, bookmarksData) => {
          // Create collection
          const collection = await collectionRepository.create({
            ownerId: testUserId,
            title: collectionData.title,
            icon: collectionData.icon || '📁',
            isPublic: false,
            sortOrder: 0,
          });

          // Create bookmarks in the collection
          const createdBookmarks: Bookmark[] = [];
          for (const bookmarkData of bookmarksData) {
            const domain = new URL(bookmarkData.url).hostname;

            const bookmark = await bookmarkRepository.create({
              ownerId: testUserId,
              url: bookmarkData.url,
              title: bookmarkData.title,
              excerpt: bookmarkData.excerpt,
              collectionId: collection.id,
              type: bookmarkData.type,
              domain,
              isDuplicate: false,
              isBroken: false,
              contentIndexed: false,
            });

            // Add tags
            if (bookmarkData.tags.length > 0) {
              const tagIds: string[] = [];
              for (const tagName of bookmarkData.tags) {
                const normalizedName = tagName.toLowerCase().trim();
                let tag = await tagRepository.findByNormalizedName(
                  testUserId,
                  normalizedName
                );
                if (!tag) {
                  tag = await tagRepository.create({
                    ownerId: testUserId,
                    name: tagName,
                    normalizedName,
                  });
                }
                tagIds.push(tag.id);
              }
              await bookmarkRepository.addTags(bookmark.id, tagIds);
            }

            createdBookmarks.push(bookmark);
          }

          // Export to JSON format (most complete)
          const exportedJson = await exportService.exportBookmarks(
            testUserId,
            'json',
            collection.id
          );

          const exportData = JSON.parse(exportedJson);

          // Verify all bookmarks are present
          expect(exportData.bookmarks).toHaveLength(createdBookmarks.length);

          // Verify each bookmark has complete metadata
          for (const createdBookmark of createdBookmarks) {
            const exportedBookmark = exportData.bookmarks.find(
              (b: any) => b.url === createdBookmark.url
            );

            expect(exportedBookmark).toBeDefined();
            expect(exportedBookmark.title).toBe(createdBookmark.title);
            expect(exportedBookmark.url).toBe(createdBookmark.url);
            expect(exportedBookmark.type).toBe(createdBookmark.type);
            expect(exportedBookmark.domain).toBe(createdBookmark.domain);
            expect(exportedBookmark.collectionId).toBe(collection.id);

            // Verify tags are included
            const originalTags =
              bookmarksData.find((b) => b.url === createdBookmark.url)?.tags ||
              [];
            if (originalTags.length > 0) {
              expect(exportedBookmark.tags).toBeDefined();
              expect(exportedBookmark.tags.length).toBeGreaterThan(0);
            }
          }

          // Verify collection is included
          expect(exportData.collections).toBeDefined();
          const exportedCollection = exportData.collections.find(
            (c: any) => c.id === collection.id
          );
          expect(exportedCollection).toBeDefined();
          expect(exportedCollection.title).toBe(collection.title);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 20: Filtered Export Accuracy
   * Validates: Requirements 7.3
   *
   * For any search query with filters, exporting the search results should generate
   * a file containing only the bookmarks that match the filter criteria.
   */
  it('Property 20: Filtered Export Accuracy - exported bookmarks match filter criteria', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(bookmarkArbitrary, { minLength: 5, maxLength: 15 }),
        fc.constantFrom('article', 'video', 'image'),
        async (bookmarksData, filterType) => {
          // Create a unique test user for this iteration
          const iterationUser = await userRepository.create({
            email: `export-filter-test-${Date.now()}-${Math.random()}@example.com`,
            passwordHash: 'test-hash',
            name: 'Export Filter Test User',
            plan: 'pro',
          });

          try {
            // Create bookmarks with different types
            const createdBookmarks: Bookmark[] = [];
            for (const bookmarkData of bookmarksData) {
              const domain = new URL(bookmarkData.url).hostname;

              const bookmark = await bookmarkRepository.create({
                ownerId: iterationUser.id,
                url: bookmarkData.url,
                title: bookmarkData.title,
                excerpt: bookmarkData.excerpt,
                type: bookmarkData.type,
                domain,
                isDuplicate: false,
                isBroken: false,
                contentIndexed: false,
              });

              createdBookmarks.push(bookmark);
            }

            // Export with type filter
            const exportedJson = await exportService.exportBookmarks(
              iterationUser.id,
              'json',
              undefined,
              { type: [filterType] }
            );

            const exportData = JSON.parse(exportedJson);

            // Verify all exported bookmarks match the filter
            for (const exportedBookmark of exportData.bookmarks) {
              expect(exportedBookmark.type).toBe(filterType);
            }

            // Verify count matches expected
            const expectedCount = createdBookmarks.filter(
              (b) => b.type === filterType
            ).length;
            expect(exportData.bookmarks).toHaveLength(expectedCount);
          } finally {
            // Clean up test user and all related data
            await testPool.query('DELETE FROM users WHERE id = $1', [
              iterationUser.id,
            ]);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 21: JSON Export Completeness
   * Validates: Requirements 7.4
   *
   * For any collection exported to JSON format, the export should include all
   * metadata fields, tags, and snapshot references for every bookmark.
   */
  it('Property 21: JSON Export Completeness - JSON export includes all metadata fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        collectionArbitrary,
        fc.array(bookmarkArbitrary, { minLength: 1, maxLength: 10 }),
        async (collectionData, bookmarksData) => {
          // Create collection
          const collection = await collectionRepository.create({
            ownerId: testUserId,
            title: collectionData.title,
            icon: collectionData.icon || '📁',
            isPublic: false,
            sortOrder: 0,
          });

          // Create bookmarks with full metadata
          const createdBookmarks: Bookmark[] = [];
          for (const bookmarkData of bookmarksData) {
            const domain = new URL(bookmarkData.url).hostname;

            const bookmark = await bookmarkRepository.create({
              ownerId: testUserId,
              url: bookmarkData.url,
              title: bookmarkData.title,
              excerpt: bookmarkData.excerpt,
              collectionId: collection.id,
              type: bookmarkData.type,
              domain,
              coverUrl: `https://example.com/cover-${Date.now()}.jpg`,
              contentSnapshotPath: `/snapshots/${testUserId}/${Date.now()}/page.html`,
              contentIndexed: true,
              isDuplicate: false,
              isBroken: false,
              customOrder: createdBookmarks.length,
            });

            // Add tags
            if (bookmarkData.tags.length > 0) {
              const tagIds: string[] = [];
              for (const tagName of bookmarkData.tags) {
                const normalizedName = tagName.toLowerCase().trim();
                let tag = await tagRepository.findByNormalizedName(
                  testUserId,
                  normalizedName
                );
                if (!tag) {
                  tag = await tagRepository.create({
                    ownerId: testUserId,
                    name: tagName,
                    normalizedName,
                  });
                }
                tagIds.push(tag.id);
              }
              await bookmarkRepository.addTags(bookmark.id, tagIds);
            }

            createdBookmarks.push(bookmark);
          }

          // Export to JSON
          const exportedJson = await exportService.exportBookmarks(
            testUserId,
            'json',
            collection.id
          );

          const exportData = JSON.parse(exportedJson);

          // Verify JSON structure
          expect(exportData).toHaveProperty('version');
          expect(exportData).toHaveProperty('exportedAt');
          expect(exportData).toHaveProperty('bookmarks');
          expect(exportData).toHaveProperty('collections');
          expect(exportData).toHaveProperty('tags');

          // Verify each bookmark has all metadata fields
          for (const createdBookmark of createdBookmarks) {
            const exportedBookmark = exportData.bookmarks.find(
              (b: unknown) => b.id === createdBookmark.id
            );

            expect(exportedBookmark).toBeDefined();

            // Verify all required fields are present
            expect(exportedBookmark).toHaveProperty('id');
            expect(exportedBookmark).toHaveProperty('url');
            expect(exportedBookmark).toHaveProperty('title');
            expect(exportedBookmark).toHaveProperty('excerpt');
            expect(exportedBookmark).toHaveProperty('collectionId');
            expect(exportedBookmark).toHaveProperty('type');
            expect(exportedBookmark).toHaveProperty('domain');
            expect(exportedBookmark).toHaveProperty('coverUrl');
            expect(exportedBookmark).toHaveProperty('contentSnapshotPath');
            expect(exportedBookmark).toHaveProperty('contentIndexed');
            expect(exportedBookmark).toHaveProperty('isDuplicate');
            expect(exportedBookmark).toHaveProperty('isBroken');
            expect(exportedBookmark).toHaveProperty('customOrder');
            expect(exportedBookmark).toHaveProperty('tags');
            expect(exportedBookmark).toHaveProperty('highlights');
            expect(exportedBookmark).toHaveProperty('createdAt');
            expect(exportedBookmark).toHaveProperty('updatedAt');

            // Verify snapshot reference is included
            expect(exportedBookmark.contentSnapshotPath).toBe(
              createdBookmark.contentSnapshotPath
            );

            // Verify tags are included
            expect(Array.isArray(exportedBookmark.tags)).toBe(true);
          }

          // Verify tags are exported
          if (exportData.tags.length > 0) {
            for (const tag of exportData.tags) {
              expect(tag).toHaveProperty('id');
              expect(tag).toHaveProperty('name');
              expect(tag).toHaveProperty('normalizedName');
              expect(tag).toHaveProperty('color');
              expect(tag).toHaveProperty('createdAt');
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
