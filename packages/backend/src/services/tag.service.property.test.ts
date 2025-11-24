import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import pool from '../db/config.js';
import { runMigrations } from '../db/migrate.js';
import { TagService } from './tag.service.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { Bookmark } from '@bookmark-manager/shared';

/**
 * Property-based tests for tag operations
 * Feature: bookmark-manager-platform
 */

describe('Tag Service Property Tests', () => {
  let tagService: TagService;
  let tagRepository: TagRepository;
  let bookmarkRepository: BookmarkRepository;
  let userRepository: UserRepository;
  let testUserId: string;

  beforeAll(async () => {
    // Run migrations to set up the schema
    await runMigrations();
  });

  afterAll(async () => {
    // Close pool
    await pool.end();
  });

  beforeEach(async () => {
    tagRepository = new TagRepository(pool);
    bookmarkRepository = new BookmarkRepository(pool);
    userRepository = new UserRepository(pool);
    tagService = new TagService(tagRepository);

    // Clean up test data before each test
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM bookmark_tags');
      await client.query('DELETE FROM highlights');
      await client.query('DELETE FROM files');
      await client.query('DELETE FROM bookmarks');
      await client.query('DELETE FROM tags');
      await client.query('DELETE FROM collection_permissions');
      await client.query('DELETE FROM collections');
      await client.query('DELETE FROM reminders');
      await client.query('DELETE FROM backups');
      await client.query('DELETE FROM oauth_tokens');
      await client.query('DELETE FROM oauth_clients');
      await client.query('DELETE FROM users');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Create a test user
    const user = await userRepository.createWithPassword(
      `test-tag-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
      'hashed_password',
      'Test User'
    );
    testUserId = user.id;
  });

  /**
   * Property 10: Tag Normalization
   * Feature: bookmark-manager-platform, Property 10: Tag Normalization
   * Validates: Requirements 3.1
   *
   * For any tag name with varying cases (e.g., "JavaScript", "javascript", "JAVASCRIPT"),
   * adding the tag to bookmarks should normalize all variations to the same tag entity.
   */
  it('Property 10: Tag Normalization - varying cases should normalize to same tag', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a base tag name
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => s.trim().length > 0),
        // Generate different case variations
        fc.constantFrom('lower', 'upper', 'mixed'),
        async (baseName, caseVariation) => {
          // Create different case variations of the same tag name
          let tagName1: string;
          let tagName2: string;
          let tagName3: string;

          const trimmedBase = baseName.trim();

          switch (caseVariation) {
            case 'lower':
              tagName1 = trimmedBase.toLowerCase();
              tagName2 = trimmedBase.toUpperCase();
              tagName3 =
                trimmedBase.charAt(0).toUpperCase() +
                trimmedBase.slice(1).toLowerCase();
              break;
            case 'upper':
              tagName1 = trimmedBase.toUpperCase();
              tagName2 = trimmedBase.toLowerCase();
              tagName3 =
                trimmedBase.charAt(0).toLowerCase() +
                trimmedBase.slice(1).toUpperCase();
              break;
            default:
              tagName1 = trimmedBase;
              tagName2 = trimmedBase.toLowerCase();
              tagName3 = trimmedBase.toUpperCase();
          }

          // Create tags with different case variations
          const tag1 = await tagService.createTag(testUserId, {
            name: tagName1,
          });

          // Try to create the same tag with different case - should return existing tag
          const tag2Result = await tagRepository.findByNormalizedName(
            testUserId,
            tagName2
          );
          const tag3Result = await tagRepository.findByNormalizedName(
            testUserId,
            tagName3
          );

          // All variations should resolve to the same tag entity
          expect(tag2Result).not.toBeNull();
          expect(tag3Result).not.toBeNull();
          expect(tag2Result?.id).toBe(tag1.id);
          expect(tag3Result?.id).toBe(tag1.id);

          // Normalized names should all be the same
          expect(tag1.normalizedName).toBe(trimmedBase.toLowerCase());
          expect(tag2Result?.normalizedName).toBe(trimmedBase.toLowerCase());
          expect(tag3Result?.normalizedName).toBe(trimmedBase.toLowerCase());

          // Clean up
          await tagRepository.delete(tag1.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Tag Merge Consolidation
   * Feature: bookmark-manager-platform, Property 13: Tag Merge Consolidation
   * Validates: Requirements 3.5
   *
   * For any set of source tags and a target tag, merging the source tags to the target
   * should result in all bookmarks previously tagged with source tags now having the target tag.
   */
  it('Property 13: Tag Merge Consolidation - bookmarks should have target tag after merge', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of source tags (1-5)
        fc.integer({ min: 1, max: 5 }),
        // Generate number of bookmarks per tag (1-3)
        fc.integer({ min: 1, max: 3 }),
        async (numSourceTags, bookmarksPerTag) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }

          // Create source tags
          const sourceTags = [];
          for (let i = 0; i < numSourceTags; i++) {
            const tag = await tagService.createTag(testUserId, {
              name: `SourceTag${i}-${Date.now()}-${Math.random()}`,
            });
            sourceTags.push(tag);
          }

          // Create target tag
          const targetTag = await tagService.createTag(testUserId, {
            name: `TargetTag-${Date.now()}-${Math.random()}`,
          });

          // Create bookmarks and tag them with source tags
          const bookmarks: Bookmark[] = [];
          const bookmarkTagMap = new Map<string, string[]>(); // bookmarkId -> tagIds

          for (const sourceTag of sourceTags) {
            for (let i = 0; i < bookmarksPerTag; i++) {
              const bookmark = await bookmarkRepository.create({
                ownerId: testUserId,
                url: `https://example.com/page-${Date.now()}-${Math.random()}`,
                title: `Test Bookmark ${i}`,
                type: 'article',
                domain: 'example.com',
                isDuplicate: false,
                isBroken: false,
                contentIndexed: false,
              });
              bookmarks.push(bookmark);

              // Add source tag to bookmark
              await bookmarkRepository.addTags(bookmark.id, [sourceTag.id]);

              // Track which tags each bookmark has
              if (!bookmarkTagMap.has(bookmark.id)) {
                bookmarkTagMap.set(bookmark.id, []);
              }
              bookmarkTagMap.get(bookmark.id)!.push(sourceTag.id);
            }
          }

          // Get all unique bookmarks that have any source tag
          const uniqueBookmarkIds = Array.from(bookmarkTagMap.keys());

          // Merge source tags into target tag
          await tagService.mergeTags(testUserId, {
            sourceTagIds: sourceTags.map((t) => t.id),
            targetTagId: targetTag.id,
          });

          // Verify all bookmarks now have the target tag
          for (const bookmarkId of uniqueBookmarkIds) {
            const bookmarkTags =
              await bookmarkRepository.getBookmarkTags(bookmarkId);
            const tagIds = bookmarkTags.map((t) => t.id);

            // Should have the target tag
            expect(tagIds).toContain(targetTag.id);

            // Should NOT have any source tags (they were deleted)
            for (const sourceTag of sourceTags) {
              expect(tagIds).not.toContain(sourceTag.id);
            }
          }

          // Verify source tags were deleted
          for (const sourceTag of sourceTags) {
            const deletedTag = await tagRepository.findById(sourceTag.id);
            expect(deletedTag).toBeNull();
          }

          // Verify target tag still exists
          const existingTargetTag = await tagRepository.findById(targetTag.id);
          expect(existingTargetTag).not.toBeNull();

          // Clean up
          for (const bookmark of bookmarks) {
            await bookmarkRepository.delete(bookmark.id);
          }
          await tagRepository.delete(targetTag.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});
