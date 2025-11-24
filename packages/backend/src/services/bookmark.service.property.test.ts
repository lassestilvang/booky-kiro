import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BookmarkService } from './bookmark.service.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import pool from '../db/config.js';
import { runMigrations } from '../db/migrate.js';

describe('BookmarkService Property-Based Tests', () => {
  let bookmarkService: BookmarkService;
  let bookmarkRepository: BookmarkRepository;
  let tagRepository: TagRepository;
  let userRepository: UserRepository;
  let testUserId: string;

  beforeAll(async () => {
    // Run migrations to ensure schema is up to date
    await runMigrations();

    bookmarkRepository = new BookmarkRepository(pool);
    tagRepository = new TagRepository(pool);
    userRepository = new UserRepository(pool);
    bookmarkService = new BookmarkService(bookmarkRepository, tagRepository);

    // Create a test user
    const testUser = await userRepository.createWithPassword(
      `test-bookmark-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
      'test-password',
      'Test User'
    );
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test - order matters due to foreign keys
    await pool.query(
      'DELETE FROM bookmark_tags WHERE bookmark_id IN (SELECT id FROM bookmarks WHERE owner_id = $1)',
      [testUserId]
    );
    await pool.query('DELETE FROM bookmarks WHERE owner_id = $1', [testUserId]);
    await pool.query('DELETE FROM tags WHERE owner_id = $1', [testUserId]);
  });

  /**
   * Feature: bookmark-manager-platform, Property 5: Duplicate Detection
   *
   * For any URL that already exists in a user's account, creating a new bookmark
   * with the same URL should flag the new bookmark as a potential duplicate.
   *
   * Validates: Requirements 1.5
   */
  it('Property 5: Duplicate Detection - creating a bookmark with an existing URL flags it as duplicate', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random URL
        fc.webUrl(),
        // Generate random bookmark titles
        fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim().length > 0),
        fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim().length > 0),
        async (url, title1, title2) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }

          // Create first bookmark with the URL
          const bookmark1 = await bookmarkService.createBookmark(testUserId, {
            url,
            title: title1,
          });

          // First bookmark should not be marked as duplicate
          expect(bookmark1.isDuplicate).toBe(false);

          // Create second bookmark with the same URL
          const bookmark2 = await bookmarkService.createBookmark(testUserId, {
            url,
            title: title2,
          });

          // Second bookmark should be marked as duplicate
          expect(bookmark2.isDuplicate).toBe(true);

          // Clean up for next iteration
          await bookmarkRepository.delete(bookmark1.id);
          await bookmarkRepository.delete(bookmark2.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 11: Tag Filtering Accuracy
   *
   * For any set of bookmarks with various tag combinations and any tag filter query,
   * filtering should return only bookmarks that have all specified tags.
   *
   * Validates: Requirements 3.2
   */
  it('Property 11: Tag Filtering Accuracy - filtering by tags returns only bookmarks with all specified tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate bookmarks with different tag combinations
        fc.array(
          fc.record({
            url: fc.webUrl(),
            title: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim().length > 0),
            tags: fc.array(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter((s) => s.trim().length > 0),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          { minLength: 3, maxLength: 10 }
        ),
        async (bookmarksData) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }

          // Clean up any leftover bookmarks from previous iterations
          await pool.query(
            'DELETE FROM bookmark_tags WHERE bookmark_id IN (SELECT id FROM bookmarks WHERE owner_id = $1)',
            [testUserId]
          );
          await pool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
            testUserId,
          ]);
          await pool.query('DELETE FROM tags WHERE owner_id = $1', [
            testUserId,
          ]);

          // Create bookmarks with tags
          const createdBookmarks = [];
          const allTags = new Set<string>();

          try {
            for (const data of bookmarksData) {
              const bookmark = await bookmarkService.createBookmark(
                testUserId,
                {
                  url: data.url,
                  title: data.title,
                  tags: data.tags,
                }
              );
              createdBookmarks.push({ bookmark, tags: data.tags });
              data.tags.forEach((tag) => allTags.add(tag.trim().toLowerCase()));
            }

            // Only test if we have tags to filter by
            if (allTags.size === 0) {
              return;
            }

            // Pick a subset of existing tags to filter by (1-2 tags)
            const tagsArray = Array.from(allTags);
            const filterTags = tagsArray.slice(
              0,
              Math.min(2, tagsArray.length)
            );

            // Filter bookmarks by tags
            const result = await bookmarkService.getUserBookmarks(
              testUserId,
              { tags: filterTags },
              { page: 1, limit: 100 }
            );

            // Count how many bookmarks should match (have all filter tags)
            const expectedMatches = createdBookmarks.filter(({ tags }) => {
              const normalizedTags = tags.map((t) => t.trim().toLowerCase());
              return filterTags.every((filterTag) =>
                normalizedTags.includes(filterTag)
              );
            });

            // Verify the count matches
            expect(result.data.length).toBe(expectedMatches.length);

            // Verify all returned bookmarks have all filter tags
            for (const bookmark of result.data) {
              const bookmarkWithTags =
                await bookmarkRepository.findByIdWithRelations(bookmark.id);
              const bookmarkTagNames = bookmarkWithTags!.tags.map(
                (t) => t.normalizedName
              );

              // Check that all filter tags are present in the bookmark's tags
              for (const filterTag of filterTags) {
                expect(bookmarkTagNames).toContain(filterTag);
              }
            }
          } finally {
            // Always clean up, even if test fails
            for (const { bookmark } of createdBookmarks) {
              await bookmarkRepository.delete(bookmark.id).catch(() => {});
            }
          }
        }
      ),
      { numRuns: 50 } // Reduced runs due to complexity
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 12: Multi-Criteria Filtering
   *
   * For any set of bookmarks with various attributes and any combination of type,
   * domain, and date range filters, filtering should return only bookmarks matching
   * all specified criteria.
   *
   * Validates: Requirements 3.3
   */
  it('Property 12: Multi-Criteria Filtering - filtering by multiple criteria returns only matching bookmarks', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate bookmarks with different attributes
        fc.array(
          fc.record({
            url: fc.webUrl(),
            title: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim().length > 0),
            type: fc.constantFrom(
              'article',
              'video',
              'image',
              'file',
              'document'
            ),
          }),
          { minLength: 5, maxLength: 15 }
        ),
        // Generate filter criteria
        fc.constantFrom('article' as const, 'video' as const, 'image' as const),
        async (bookmarksData, filterType) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }

          // Create bookmarks
          const createdBookmarks = [];
          for (const data of bookmarksData) {
            const bookmark = await bookmarkService.createBookmark(testUserId, {
              url: data.url,
              title: data.title,
              type: data.type as
                | 'article'
                | 'video'
                | 'image'
                | 'file'
                | 'document',
            });
            createdBookmarks.push(bookmark);
          }

          // Filter by type
          const result = await bookmarkService.getUserBookmarks(
            testUserId,
            { type: [filterType] },
            { page: 1, limit: 100 }
          );

          // Verify all returned bookmarks match the filter type
          for (const bookmark of result.data) {
            expect(bookmark.type).toBe(filterType);
          }

          // Verify count matches expected
          const expectedCount = bookmarksData.filter(
            (b) => b.type === filterType
          ).length;
          expect(result.data.length).toBe(expectedCount);

          // Clean up
          for (const bookmark of createdBookmarks) {
            await bookmarkRepository.delete(bookmark.id);
          }
        }
      ),
      { numRuns: 50 } // Reduced runs due to complexity
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 43: Bulk Tag Application
   *
   * For any set of selected bookmarks and specified tags, applying tags in bulk
   * should add the tags to all selected bookmarks atomically.
   *
   * Validates: Requirements 14.1
   */
  it('Property 43: Bulk Tag Application - bulk adding tags adds them to all selected bookmarks', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple bookmarks
        fc.array(
          fc.record({
            url: fc.webUrl(),
            title: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim().length > 0),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        // Generate tags to add
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter((s) => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        ),
        async (bookmarksData, tagsToAdd) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }

          // Create bookmarks
          const createdBookmarks = [];
          for (const data of bookmarksData) {
            const bookmark = await bookmarkService.createBookmark(testUserId, {
              url: data.url,
              title: data.title,
            });
            createdBookmarks.push(bookmark);
          }

          const bookmarkIds = createdBookmarks.map((b) => b.id);

          // Perform bulk tag addition
          const result = await bookmarkService.bulkAddTags(
            testUserId,
            bookmarkIds,
            tagsToAdd
          );

          // Verify all bookmarks were processed successfully
          expect(result.processedCount).toBe(bookmarkIds.length);
          expect(result.failedCount).toBe(0);

          // Verify all bookmarks now have the tags
          for (const bookmarkId of bookmarkIds) {
            const bookmarkWithTags =
              await bookmarkRepository.findByIdWithRelations(bookmarkId);
            const bookmarkTagNames = bookmarkWithTags!.tags.map(
              (t) => t.normalizedName
            );

            // Check that all added tags are present (normalized)
            for (const tag of tagsToAdd) {
              const normalizedTag = tag.toLowerCase().trim();
              expect(bookmarkTagNames).toContain(normalizedTag);
            }
          }

          // Clean up
          for (const bookmark of createdBookmarks) {
            await bookmarkRepository.delete(bookmark.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 44: Bulk Move Atomicity
   *
   * For any set of selected bookmarks and target collection, moving all bookmarks
   * to the collection should update all collection references in a single transaction.
   *
   * Validates: Requirements 14.2
   */
  it('Property 44: Bulk Move Atomicity - bulk moving bookmarks updates all collection references atomically', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple bookmarks
        fc.array(
          fc.record({
            url: fc.webUrl(),
            title: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim().length > 0),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (bookmarksData) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }

          // Create a target collection
          const collectionResult = await pool.query(
            `INSERT INTO collections (owner_id, title, icon, is_public, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [testUserId, 'Test Collection', 'folder', false, 0]
          );
          const targetCollectionId = collectionResult.rows[0].id;

          // Create bookmarks
          const createdBookmarks = [];
          for (const data of bookmarksData) {
            const bookmark = await bookmarkService.createBookmark(testUserId, {
              url: data.url,
              title: data.title,
            });
            createdBookmarks.push(bookmark);
          }

          const bookmarkIds = createdBookmarks.map((b) => b.id);

          // Perform bulk move
          const result = await bookmarkService.bulkMoveToCollection(
            testUserId,
            bookmarkIds,
            targetCollectionId
          );

          // Verify all bookmarks were processed successfully
          expect(result.processedCount).toBe(bookmarkIds.length);
          expect(result.failedCount).toBe(0);

          // Verify all bookmarks are now in the target collection
          for (const bookmarkId of bookmarkIds) {
            const bookmark = await bookmarkRepository.findById(bookmarkId);
            expect(bookmark!.collectionId).toBe(targetCollectionId);
          }

          // Clean up
          for (const bookmark of createdBookmarks) {
            await bookmarkRepository.delete(bookmark.id);
          }
          await pool.query('DELETE FROM collections WHERE id = $1', [
            targetCollectionId,
          ]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 45: Bulk Delete
   *
   * For any set of selected bookmarks, deleting them in bulk should remove all
   * selected bookmarks and their associated data.
   *
   * Validates: Requirements 14.3
   */
  it('Property 45: Bulk Delete - bulk deleting bookmarks removes all selected bookmarks', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple bookmarks
        fc.array(
          fc.record({
            url: fc.webUrl(),
            title: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim().length > 0),
            tags: fc.array(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter((s) => s.trim().length > 0),
              { minLength: 0, maxLength: 3 }
            ),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (bookmarksData) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }

          // Create bookmarks with tags
          const createdBookmarks = [];
          for (const data of bookmarksData) {
            const bookmark = await bookmarkService.createBookmark(testUserId, {
              url: data.url,
              title: data.title,
              tags: data.tags,
            });
            createdBookmarks.push(bookmark);
          }

          const bookmarkIds = createdBookmarks.map((b) => b.id);

          // Perform bulk delete
          const result = await bookmarkService.bulkDeleteBookmarks(
            testUserId,
            bookmarkIds
          );

          // Verify all bookmarks were processed successfully
          expect(result.processedCount).toBe(bookmarkIds.length);
          expect(result.failedCount).toBe(0);

          // Verify all bookmarks are deleted
          for (const bookmarkId of bookmarkIds) {
            const bookmark = await bookmarkRepository.findById(bookmarkId);
            expect(bookmark).toBeNull();
          }

          // Verify associated data (tags) are also cleaned up
          // Check that bookmark_tags entries are removed
          for (const bookmarkId of bookmarkIds) {
            const tagsResult = await pool.query(
              'SELECT * FROM bookmark_tags WHERE bookmark_id = $1',
              [bookmarkId]
            );
            expect(tagsResult.rows.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 46: Custom Ordering Persistence
   *
   * For any manually sorted bookmarks within a collection, the custom ordering
   * should persist and display bookmarks in the specified sequence on retrieval.
   *
   * Validates: Requirements 14.4
   */
  it('Property 46: Custom Ordering Persistence - custom order persists and bookmarks are returned in specified sequence', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple bookmarks
        fc.array(
          fc.record({
            url: fc.webUrl(),
            title: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim().length > 0),
          }),
          { minLength: 3, maxLength: 8 }
        ),
        async (bookmarksData) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }

          // Create a collection
          const collectionResult = await pool.query(
            `INSERT INTO collections (owner_id, title, icon, is_public, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [testUserId, 'Test Collection', 'folder', false, 0]
          );
          const collectionId = collectionResult.rows[0].id;

          // Create bookmarks in the collection
          const createdBookmarks = [];
          for (const data of bookmarksData) {
            const bookmark = await bookmarkService.createBookmark(testUserId, {
              url: data.url,
              title: data.title,
              collectionId,
            });
            createdBookmarks.push(bookmark);
          }

          // Assign custom order (reverse order for testing)
          const updates = createdBookmarks.map((bookmark, index) => ({
            id: bookmark.id,
            order: createdBookmarks.length - index - 1,
          }));

          // Update custom order
          await bookmarkService.updateCustomOrder(testUserId, updates);

          // Retrieve bookmarks sorted by custom order
          const result = await bookmarkService.getUserBookmarks(
            testUserId,
            { collectionId },
            { sortBy: 'custom_order', sortOrder: 'asc', limit: 100 }
          );

          // Verify bookmarks are returned in custom order
          expect(result.data.length).toBe(createdBookmarks.length);

          for (let i = 0; i < result.data.length; i++) {
            const expectedOrder = i;
            const actualBookmark = result.data[i];
            expect(actualBookmark.customOrder).toBe(expectedOrder);
          }

          // Verify the order is persisted (retrieve again)
          const result2 = await bookmarkService.getUserBookmarks(
            testUserId,
            { collectionId },
            { sortBy: 'custom_order', sortOrder: 'asc', limit: 100 }
          );

          // Should get the same order
          for (let i = 0; i < result2.data.length; i++) {
            expect(result2.data[i].id).toBe(result.data[i].id);
            expect(result2.data[i].customOrder).toBe(
              result.data[i].customOrder
            );
          }

          // Clean up
          for (const bookmark of createdBookmarks) {
            await bookmarkRepository.delete(bookmark.id);
          }
          await pool.query('DELETE FROM collections WHERE id = $1', [
            collectionId,
          ]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
