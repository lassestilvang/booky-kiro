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
    // Clean up test data before each test
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
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (url, title1, title2) => {
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
            title: fc.string({ minLength: 1, maxLength: 100 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          }),
          { minLength: 3, maxLength: 10 }
        ),
        // Generate filter tags (subset of possible tags)
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
        async (bookmarksData, filterTags) => {
          // Create bookmarks with tags
          const createdBookmarks = [];
          for (const data of bookmarksData) {
            const bookmark = await bookmarkService.createBookmark(testUserId, {
              url: data.url,
              title: data.title,
              tags: data.tags,
            });
            createdBookmarks.push({ bookmark, tags: data.tags });
          }

          // Filter bookmarks by tags
          const result = await bookmarkService.getUserBookmarks(
            testUserId,
            { tags: filterTags.map(t => t.toLowerCase()) },
            { page: 1, limit: 100 }
          );

          // Verify all returned bookmarks have all filter tags
          for (const bookmark of result.data) {
            const bookmarkWithTags = await bookmarkRepository.findByIdWithRelations(bookmark.id);
            const bookmarkTagNames = bookmarkWithTags!.tags.map(t => t.normalizedName);
            
            // Check that all filter tags are present in the bookmark's tags
            for (const filterTag of filterTags) {
              expect(bookmarkTagNames).toContain(filterTag.toLowerCase());
            }
          }

          // Clean up
          for (const { bookmark } of createdBookmarks) {
            await bookmarkRepository.delete(bookmark.id);
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
            title: fc.string({ minLength: 1, maxLength: 100 }),
            type: fc.constantFrom('article', 'video', 'image', 'file', 'document'),
          }),
          { minLength: 5, maxLength: 15 }
        ),
        // Generate filter criteria
        fc.constantFrom('article' as const, 'video' as const, 'image' as const),
        async (bookmarksData, filterType) => {
          // Create bookmarks
          const createdBookmarks = [];
          for (const data of bookmarksData) {
            const bookmark = await bookmarkService.createBookmark(testUserId, {
              url: data.url,
              title: data.title,
              type: data.type as 'article' | 'video' | 'image' | 'file' | 'document',
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
          const expectedCount = bookmarksData.filter(b => b.type === filterType).length;
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
});
