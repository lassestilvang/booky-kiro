import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BookmarkRepository } from './bookmark.repository.js';
import { CollectionRepository } from './collection.repository.js';
import { TagRepository } from './tag.repository.js';
import { UserRepository } from './user.repository.js';
import pool from '../db/config.js';
import { runMigrations } from '../db/migrate.js';

let userRepo: UserRepository;
let collectionRepo: CollectionRepository;
let bookmarkRepo: BookmarkRepository;
let tagRepo: TagRepository;

// Test user ID for all tests
let testUserId: string;

beforeAll(async () => {
  // Run migrations to ensure schema is up to date
  await runMigrations();

  userRepo = new UserRepository(pool);
  collectionRepo = new CollectionRepository(pool);
  bookmarkRepo = new BookmarkRepository(pool);
  tagRepo = new TagRepository(pool);

  // Create a test user
  const testUser = await userRepo.createWithPassword(
    `test-repo-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
    'hashedpassword',
    'Test User'
  );
  testUserId = testUser.id;
  
  // Verify test user was created
  if (!testUserId) {
    throw new Error('Failed to create test user');
  }
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
  await pool.query('DELETE FROM tags WHERE owner_id = $1', [testUserId]);
});

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

const bookmarkArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  url: fc.webUrl(),
  excerpt: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  type: fc.constantFrom('article', 'video', 'image', 'file', 'document'),
  domain: fc.domain(),
  coverUrl: fc.option(fc.webUrl(), { nil: undefined }),
});

const collectionArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  icon: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { nil: undefined }),
  isPublic: fc.boolean(),
  sortOrder: fc.integer({ min: 0, max: 1000 }),
});

const tagNameArbitrary = fc.string({ minLength: 1, maxLength: 50 });

// ============================================================================
// Property 2: Bookmark Retrieval Completeness
// Feature: bookmark-manager-platform, Property 2: Bookmark Retrieval Completeness
// Validates: Requirements 1.2
// ============================================================================

describe('Property 2: Bookmark Retrieval Completeness', () => {
  test('retrieving a bookmark with tags and highlights returns all stored metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookmarkArbitrary,
        fc.array(tagNameArbitrary.filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 }),
        async (bookmarkData, tagNames) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }
          
          // Create bookmark
          const bookmark = await bookmarkRepo.create({
            ownerId: testUserId,
            title: bookmarkData.title,
            url: bookmarkData.url,
            excerpt: bookmarkData.excerpt || null,
            type: bookmarkData.type,
            domain: bookmarkData.domain,
            coverUrl: bookmarkData.coverUrl || null,
            contentIndexed: false,
            isDuplicate: false,
            isBroken: false,
          });

          // Create and add tags
          const tags = await tagRepo.findOrCreateMany(testUserId, tagNames);
          await bookmarkRepo.addTags(
            bookmark.id,
            tags.map((t) => t.id)
          );

          // Retrieve with relations
          const retrieved = await bookmarkRepo.findByIdWithRelations(bookmark.id);

          // Verify all metadata is present
          expect(retrieved).not.toBeNull();
          expect(retrieved!.id).toBe(bookmark.id);
          expect(retrieved!.title).toBe(bookmarkData.title);
          expect(retrieved!.url).toBe(bookmarkData.url);
          expect(retrieved!.type).toBe(bookmarkData.type);
          expect(retrieved!.domain).toBe(bookmarkData.domain);
          expect(retrieved!.tags).toHaveLength(tags.length);
          expect(retrieved!.highlights).toHaveLength(0);

          // Cleanup
          await bookmarkRepo.delete(bookmark.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 3: Bookmark Update Consistency
// Feature: bookmark-manager-platform, Property 3: Bookmark Update Consistency
// Validates: Requirements 1.3
// ============================================================================

describe('Property 3: Bookmark Update Consistency', () => {
  test('updating a bookmark modifies only specified fields and updates timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookmarkArbitrary,
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        async (initialData, newTitle) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }
          
          // Create bookmark
          const bookmark = await bookmarkRepo.create({
            ownerId: testUserId,
            title: initialData.title,
            url: initialData.url,
            excerpt: initialData.excerpt || null,
            type: initialData.type,
            domain: initialData.domain,
            coverUrl: initialData.coverUrl || null,
            contentIndexed: false,
            isDuplicate: false,
            isBroken: false,
          });

          const originalUpdatedAt = bookmark.updatedAt;

          // Wait a bit to ensure timestamp changes
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Update only title
          const updated = await bookmarkRepo.update(bookmark.id, {
            title: newTitle,
          });

          // Verify only title changed
          expect(updated).not.toBeNull();
          expect(updated!.title).toBe(newTitle);
          expect(updated!.url).toBe(initialData.url);
          expect(updated!.type).toBe(initialData.type);
          expect(updated!.domain).toBe(initialData.domain);
          expect(updated!.updatedAt.getTime()).toBeGreaterThan(
            originalUpdatedAt.getTime()
          );

          // Cleanup
          await bookmarkRepo.delete(bookmark.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 4: Bookmark Deletion Cascade
// Feature: bookmark-manager-platform, Property 4: Bookmark Deletion Cascade
// Validates: Requirements 1.4
// ============================================================================

describe('Property 4: Bookmark Deletion Cascade', () => {
  test('deleting a bookmark removes the bookmark and associated highlights', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArbitrary, async (bookmarkData) => {
        // Ensure testUserId is set
        if (!testUserId) {
          throw new Error('testUserId is not set');
        }
        
        // Create bookmark
        const bookmark = await bookmarkRepo.create({
          ownerId: testUserId,
          title: bookmarkData.title,
          url: bookmarkData.url,
          excerpt: bookmarkData.excerpt || null,
          type: bookmarkData.type,
          domain: bookmarkData.domain,
          coverUrl: bookmarkData.coverUrl || null,
          contentIndexed: false,
          isDuplicate: false,
          isBroken: false,
        });

        // Create a highlight
        await pool.query(
          `INSERT INTO highlights (bookmark_id, owner_id, text_selected, color, position_context)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            bookmark.id,
            testUserId,
            'Sample highlight text',
            '#FFFF00',
            JSON.stringify({ before: 'before', after: 'after' }),
          ]
        );

        // Verify highlight exists
        const highlightsBefore = await pool.query(
          'SELECT * FROM highlights WHERE bookmark_id = $1',
          [bookmark.id]
        );
        expect(highlightsBefore.rows.length).toBe(1);

        // Delete bookmark
        const deleted = await bookmarkRepo.delete(bookmark.id);
        expect(deleted).toBe(true);

        // Verify bookmark is gone
        const bookmarkAfter = await bookmarkRepo.findById(bookmark.id);
        expect(bookmarkAfter).toBeNull();

        // Verify highlights are cascaded
        const highlightsAfter = await pool.query(
          'SELECT * FROM highlights WHERE bookmark_id = $1',
          [bookmark.id]
        );
        expect(highlightsAfter.rows.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 7: Bookmark Assignment
// Feature: bookmark-manager-platform, Property 7: Bookmark Assignment
// Validates: Requirements 2.2
// ============================================================================

describe('Property 7: Bookmark Assignment', () => {
  test('assigning a bookmark to a collection updates the collection reference immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookmarkArbitrary,
        collectionArbitrary,
        async (bookmarkData, collectionData) => {
          // Verify testUserId is valid
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }
          
          // Create collection
          const collection = await collectionRepo.create({
            ownerId: testUserId,
            title: collectionData.title,
            icon: collectionData.icon || undefined,
            isPublic: collectionData.isPublic,
            sortOrder: collectionData.sortOrder,
          });

          // Create bookmark without collection
          const bookmark = await bookmarkRepo.create({
            ownerId: testUserId,
            title: bookmarkData.title,
            url: bookmarkData.url,
            excerpt: bookmarkData.excerpt || null,
            type: bookmarkData.type,
            domain: bookmarkData.domain,
            coverUrl: bookmarkData.coverUrl || null,
            contentIndexed: false,
            isDuplicate: false,
            isBroken: false,
          });

          expect(bookmark.collectionId).toBeNull();

          // Assign to collection
          const updated = await bookmarkRepo.moveToCollection(
            bookmark.id,
            collection.id
          );

          // Verify assignment
          expect(updated).not.toBeNull();
          expect(updated!.collectionId).toBe(collection.id);

          // Verify persistence
          const retrieved = await bookmarkRepo.findById(bookmark.id);
          expect(retrieved!.collectionId).toBe(collection.id);

          // Cleanup
          await bookmarkRepo.delete(bookmark.id);
          await collectionRepo.delete(collection.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 8: Bookmark Move Atomicity
// Feature: bookmark-manager-platform, Property 8: Bookmark Move Atomicity
// Validates: Requirements 2.3
// ============================================================================

describe('Property 8: Bookmark Move Atomicity', () => {
  test('moving a bookmark between collections updates the reference atomically', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookmarkArbitrary,
        collectionArbitrary,
        collectionArbitrary,
        async (bookmarkData, collection1Data, collection2Data) => {
          // Ensure testUserId is set
          if (!testUserId) {
            throw new Error('testUserId is not set');
          }
          
          // Create two collections
          const collection1 = await collectionRepo.create({
            ownerId: testUserId,
            title: collection1Data.title,
            icon: collection1Data.icon || undefined,
            isPublic: collection1Data.isPublic,
            sortOrder: collection1Data.sortOrder,
          });

          const collection2 = await collectionRepo.create({
            ownerId: testUserId,
            title: collection2Data.title,
            icon: collection2Data.icon || undefined,
            isPublic: collection2Data.isPublic,
            sortOrder: collection2Data.sortOrder,
          });

          // Create bookmark in collection1
          const bookmark = await bookmarkRepo.create({
            ownerId: testUserId,
            collectionId: collection1.id,
            title: bookmarkData.title,
            url: bookmarkData.url,
            excerpt: bookmarkData.excerpt || null,
            type: bookmarkData.type,
            domain: bookmarkData.domain,
            coverUrl: bookmarkData.coverUrl || null,
            contentIndexed: false,
            isDuplicate: false,
            isBroken: false,
          });

          expect(bookmark.collectionId).toBe(collection1.id);

          // Move to collection2
          const moved = await bookmarkRepo.moveToCollection(
            bookmark.id,
            collection2.id
          );

          // Verify atomic update
          expect(moved).not.toBeNull();
          expect(moved!.collectionId).toBe(collection2.id);

          // Verify no intermediate state
          const retrieved = await bookmarkRepo.findById(bookmark.id);
          expect(retrieved!.collectionId).toBe(collection2.id);

          // Cleanup
          await bookmarkRepo.delete(bookmark.id);
          await collectionRepo.delete(collection1.id);
          await collectionRepo.delete(collection2.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});
