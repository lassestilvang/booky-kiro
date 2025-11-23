import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CollectionService } from './collection.service.js';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import pool from '../db/config.js';
import { runMigrations } from '../db/migrate.js';

let userRepo: UserRepository;
let collectionRepo: CollectionRepository;
let bookmarkRepo: BookmarkRepository;
let collectionService: CollectionService;

// Test user ID for all tests
let testUserId: string;

beforeAll(async () => {
  // Run migrations to ensure schema is up to date
  await runMigrations();

  userRepo = new UserRepository(pool);
  collectionRepo = new CollectionRepository(pool);
  bookmarkRepo = new BookmarkRepository(pool);
  collectionService = new CollectionService(collectionRepo, bookmarkRepo);

  // Create a test user
  const testUser = await userRepo.createWithPassword(
    `test-collection-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
    'hashedpassword',
    'Test User'
  );
  testUserId = testUser.id;
});

afterAll(async () => {
  // Cleanup test user and all related data
  if (testUserId) {
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  }
  await pool.end();
});

beforeEach(async () => {
  // Clean up test data before each test
  await pool.query('DELETE FROM bookmarks WHERE owner_id = $1', [testUserId]);
  await pool.query('DELETE FROM collections WHERE owner_id = $1', [testUserId]);
});

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

const collectionArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  icon: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  isPublic: fc.boolean(),
});

const bookmarkArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  url: fc.webUrl(),
  excerpt: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  type: fc.constantFrom('article', 'video', 'image', 'file', 'document'),
  domain: fc.domain(),
  coverUrl: fc.option(fc.webUrl(), { nil: undefined }),
});

// ============================================================================
// Property 9: Collection Deletion Behavior
// Feature: bookmark-manager-platform, Property 9: Collection Deletion Behavior
// Validates: Requirements 2.4
// ============================================================================

describe('Property 9: Collection Deletion Behavior', () => {
  test('deleting a collection with moveToDefault=true moves all bookmarks to null collection', async () => {
    await fc.assert(
      fc.asyncProperty(
        collectionArbitrary,
        fc.array(bookmarkArbitrary, { minLength: 1, maxLength: 10 }),
        async (collectionData, bookmarksData) => {
          // Create collection
          const collection = await collectionService.createCollection(testUserId, {
            title: collectionData.title,
            icon: collectionData.icon,
            isPublic: collectionData.isPublic,
          });

          // Create bookmarks in the collection
          const bookmarkIds: string[] = [];
          for (const bookmarkData of bookmarksData) {
            const bookmark = await bookmarkRepo.create({
              ownerId: testUserId,
              collectionId: collection.id,
              title: bookmarkData.title,
              url: bookmarkData.url,
              excerpt: bookmarkData.excerpt,
              type: bookmarkData.type,
              domain: bookmarkData.domain,
              coverUrl: bookmarkData.coverUrl,
              contentIndexed: false,
              isDuplicate: false,
              isBroken: false,
            });
            bookmarkIds.push(bookmark.id);
          }

          // Delete collection with moveToDefault=true
          await collectionService.deleteCollection(collection.id, testUserId, true);

          // Verify collection is deleted
          const deletedCollection = await collectionRepo.findById(collection.id);
          expect(deletedCollection).toBeNull();

          // Verify all bookmarks still exist but have null collection
          for (const bookmarkId of bookmarkIds) {
            const bookmark = await bookmarkRepo.findById(bookmarkId);
            expect(bookmark).not.toBeNull();
            expect(bookmark?.collectionId).toBeNull();
          }

          // Verify no orphaned bookmarks (all bookmarks should be accounted for)
          const allUserBookmarks = await bookmarkRepo.findWithFilters({
            ownerId: testUserId,
          });
          expect(allUserBookmarks.bookmarks.length).toBeGreaterThanOrEqual(bookmarkIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('deleting a collection with moveToDefault=false deletes all bookmarks', async () => {
    await fc.assert(
      fc.asyncProperty(
        collectionArbitrary,
        fc.array(bookmarkArbitrary, { minLength: 1, maxLength: 10 }),
        async (collectionData, bookmarksData) => {
          // Create collection
          const collection = await collectionService.createCollection(testUserId, {
            title: collectionData.title,
            icon: collectionData.icon,
            isPublic: collectionData.isPublic,
          });

          // Create bookmarks in the collection
          const bookmarkIds: string[] = [];
          for (const bookmarkData of bookmarksData) {
            const bookmark = await bookmarkRepo.create({
              ownerId: testUserId,
              collectionId: collection.id,
              title: bookmarkData.title,
              url: bookmarkData.url,
              excerpt: bookmarkData.excerpt,
              type: bookmarkData.type,
              domain: bookmarkData.domain,
              coverUrl: bookmarkData.coverUrl,
              contentIndexed: false,
              isDuplicate: false,
              isBroken: false,
            });
            bookmarkIds.push(bookmark.id);
          }

          // Delete collection with moveToDefault=false
          await collectionService.deleteCollection(collection.id, testUserId, false);

          // Verify collection is deleted
          const deletedCollection = await collectionRepo.findById(collection.id);
          expect(deletedCollection).toBeNull();

          // Verify all bookmarks are deleted
          for (const bookmarkId of bookmarkIds) {
            const bookmark = await bookmarkRepo.findById(bookmarkId);
            expect(bookmark).toBeNull();
          }

          // Verify no orphaned bookmarks
          const allUserBookmarks = await bookmarkRepo.findWithFilters({
            ownerId: testUserId,
          });
          // Should have no bookmarks from this collection
          const orphanedBookmarks = allUserBookmarks.bookmarks.filter((b) =>
            bookmarkIds.includes(b.id)
          );
          expect(orphanedBookmarks.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('deleting an empty collection succeeds without errors', async () => {
    await fc.assert(
      fc.asyncProperty(collectionArbitrary, async (collectionData) => {
        // Create collection
        const collection = await collectionService.createCollection(testUserId, {
          title: collectionData.title,
          icon: collectionData.icon,
          isPublic: collectionData.isPublic,
        });

        // Delete empty collection
        await collectionService.deleteCollection(collection.id, testUserId, true);

        // Verify collection is deleted
        const deletedCollection = await collectionRepo.findById(collection.id);
        expect(deletedCollection).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});
