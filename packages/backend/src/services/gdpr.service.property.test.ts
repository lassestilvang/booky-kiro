import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { GDPRService } from './gdpr.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { HighlightRepository } from '../repositories/highlight.repository.js';

/**
 * Feature: bookmark-manager-platform, Property 71: GDPR Data Export
 *
 * For any user requesting data export, the system should provide a
 * complete GDPR-compliant export of all user data.
 *
 * Validates: Requirements 22.2
 */
describe('Property 71: GDPR Data Export', () => {
  let pool: Pool;
  let gdprService: GDPRService;
  let userRepository: UserRepository;
  let bookmarkRepository: BookmarkRepository;
  let collectionRepository: CollectionRepository;
  let tagRepository: TagRepository;
  let highlightRepository: HighlightRepository;
  let testUserId: string;

  beforeAll(async () => {
    // Create test database connection
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bookmark_manager',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Initialize repositories
    userRepository = new UserRepository(pool);
    bookmarkRepository = new BookmarkRepository(pool);
    collectionRepository = new CollectionRepository(pool);
    tagRepository = new TagRepository(pool);
    highlightRepository = new HighlightRepository(pool);

    // Initialize GDPR service
    gdprService = new GDPRService(
      pool,
      userRepository,
      bookmarkRepository,
      collectionRepository,
      tagRepository,
      highlightRepository
    );

    // Create test user directly with SQL to avoid type issues
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, plan) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      ['gdpr-test@example.com', 'hashed_password', 'GDPR Test User', 'pro']
    );
    testUserId = result.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test user and related data
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test (in correct order due to foreign keys)
    await pool.query('DELETE FROM highlights WHERE owner_id = $1', [
      testUserId,
    ]);
    await pool.query(
      'DELETE FROM bookmark_tags WHERE bookmark_id IN (SELECT id FROM bookmarks WHERE owner_id = $1)',
      [testUserId]
    );
    await pool.query('DELETE FROM bookmarks WHERE owner_id = $1', [testUserId]);
    await pool.query('DELETE FROM collections WHERE owner_id = $1', [
      testUserId,
    ]);
    await pool.query('DELETE FROM tags WHERE owner_id = $1', [testUserId]);
    await pool.query('DELETE FROM files WHERE owner_id = $1', [testUserId]);
    await pool.query('DELETE FROM backups WHERE owner_id = $1', [testUserId]);
    await pool.query('DELETE FROM reminders WHERE owner_id = $1', [testUserId]);
  });

  /**
   * Property: Export Completeness - All Bookmarks
   *
   * For any user with bookmarks, the GDPR export should include
   * all bookmarks with complete metadata.
   */
  it('should export all bookmarks with complete metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            url: fc.webUrl(),
            excerpt: fc.option(fc.string({ maxLength: 500 })),
            type: fc.constantFrom(
              'article',
              'video',
              'image',
              'file',
              'document'
            ),
            domain: fc.domain(),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (bookmarksData) => {
          try {
            // Create bookmarks
            const createdBookmarks = [];
            for (const data of bookmarksData) {
              const bookmark = await bookmarkRepository.create({
                ownerId: testUserId,
                title: data.title,
                url: data.url,
                excerpt: data.excerpt || undefined,
                type: data.type as any,
                domain: data.domain,
                contentIndexed: false,
                isDuplicate: false,
                isBroken: false,
              });
              createdBookmarks.push(bookmark);
            }

            // Export user data
            const exportData = await gdprService.exportUserData(testUserId);

            // Verify all bookmarks are in the export
            expect(exportData.bookmarks).toHaveLength(createdBookmarks.length);

            // Verify each bookmark has complete metadata
            for (const created of createdBookmarks) {
              const exported = exportData.bookmarks.find(
                (b) => b.id === created.id
              );
              expect(exported).toBeDefined();
              expect(exported?.title).toBe(created.title);
              expect(exported?.url).toBe(created.url);
              expect(exported?.type).toBe(created.type);
              expect(exported?.domain).toBe(created.domain);
            }

            // Verify export metadata
            expect(exportData.version).toBe('1.0');
            expect(exportData.exportedAt).toBeDefined();
            expect(exportData.user.id).toBe(testUserId);
          } finally {
            // Clean up after this iteration
            await pool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
              testUserId,
            ]);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Export Completeness - All Collections
   *
   * For any user with collections, the GDPR export should include
   * all collections with complete metadata.
   */
  it('should export all collections with complete metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            icon: fc.option(fc.string({ maxLength: 50 })),
            isPublic: fc.boolean(),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        async (collectionsData) => {
          try {
            // Create collections
            const createdCollections = [];
            for (const data of collectionsData) {
              const collection = await collectionRepository.create({
                ownerId: testUserId,
                title: data.title,
                icon: data.icon || undefined,
                isPublic: data.isPublic,
                sortOrder: 0,
              });
              createdCollections.push(collection);
            }

            // Export user data
            const exportData = await gdprService.exportUserData(testUserId);

            // Verify all collections are in the export
            expect(exportData.collections).toHaveLength(
              createdCollections.length
            );

            // Verify each collection has complete metadata
            for (const created of createdCollections) {
              const exported = exportData.collections.find(
                (c) => c.id === created.id
              );
              expect(exported).toBeDefined();
              expect(exported?.title).toBe(created.title);
              expect(exported?.isPublic).toBe(created.isPublic);
            }
          } finally {
            // Clean up after this iteration
            await pool.query('DELETE FROM collections WHERE owner_id = $1', [
              testUserId,
            ]);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Export Completeness - All Tags
   *
   * For any user with tags, the GDPR export should include
   * all tags with complete metadata.
   */
  it('should export all tags with complete metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            color: fc.option(
              fc
                .string({ minLength: 6, maxLength: 6 })
                .map((s) => s.replace(/[^0-9A-Fa-f]/g, '0'))
            ),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (tagsData) => {
          try {
            // Create tags
            const createdTags = [];
            for (const data of tagsData) {
              const tag = await tagRepository.create({
                ownerId: testUserId,
                name: data.name,
                normalizedName: data.name.toLowerCase(),
                color: data.color ? `#${data.color}` : undefined,
              });
              createdTags.push(tag);
            }

            // Export user data
            const exportData = await gdprService.exportUserData(testUserId);

            // Verify all tags are in the export
            expect(exportData.tags).toHaveLength(createdTags.length);

            // Verify each tag has complete metadata
            for (const created of createdTags) {
              const exported = exportData.tags.find((t) => t.id === created.id);
              expect(exported).toBeDefined();
              expect(exported?.name).toBe(created.name);
            }
          } finally {
            // Clean up after this iteration
            await pool.query('DELETE FROM tags WHERE owner_id = $1', [
              testUserId,
            ]);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Export Structure Consistency
   *
   * For any user, the GDPR export should always have the same
   * structure with all required fields.
   */
  it('should always export with consistent structure', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(testUserId), async (userId) => {
        // Export user data
        const exportData = await gdprService.exportUserData(userId);

        // Verify required top-level fields
        expect(exportData).toHaveProperty('version');
        expect(exportData).toHaveProperty('exportedAt');
        expect(exportData).toHaveProperty('user');
        expect(exportData).toHaveProperty('bookmarks');
        expect(exportData).toHaveProperty('collections');
        expect(exportData).toHaveProperty('tags');
        expect(exportData).toHaveProperty('highlights');
        expect(exportData).toHaveProperty('files');
        expect(exportData).toHaveProperty('backups');
        expect(exportData).toHaveProperty('reminders');
        expect(exportData).toHaveProperty('collectionPermissions');
        expect(exportData).toHaveProperty('statistics');

        // Verify user object structure
        expect(exportData.user).toHaveProperty('id');
        expect(exportData.user).toHaveProperty('email');
        expect(exportData.user).toHaveProperty('name');
        expect(exportData.user).toHaveProperty('plan');
        expect(exportData.user).toHaveProperty('createdAt');
        expect(exportData.user).toHaveProperty('updatedAt');

        // Verify statistics object structure
        expect(exportData.statistics).toHaveProperty('totalBookmarks');
        expect(exportData.statistics).toHaveProperty('totalCollections');
        expect(exportData.statistics).toHaveProperty('totalTags');
        expect(exportData.statistics).toHaveProperty('totalHighlights');
        expect(exportData.statistics).toHaveProperty('totalFiles');
        expect(exportData.statistics).toHaveProperty('totalBackups');
        expect(exportData.statistics).toHaveProperty('totalReminders');
        expect(exportData.statistics).toHaveProperty('storageUsedBytes');

        // Verify arrays are defined
        expect(Array.isArray(exportData.bookmarks)).toBe(true);
        expect(Array.isArray(exportData.collections)).toBe(true);
        expect(Array.isArray(exportData.tags)).toBe(true);
        expect(Array.isArray(exportData.highlights)).toBe(true);
        expect(Array.isArray(exportData.files)).toBe(true);
        expect(Array.isArray(exportData.backups)).toBe(true);
        expect(Array.isArray(exportData.reminders)).toBe(true);
        expect(Array.isArray(exportData.collectionPermissions)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Export Statistics Accuracy
   *
   * For any user, the statistics in the GDPR export should
   * accurately reflect the actual counts of user data.
   */
  it('should export accurate statistics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          bookmarkCount: fc.integer({ min: 0, max: 3 }),
          collectionCount: fc.integer({ min: 0, max: 2 }),
          tagCount: fc.integer({ min: 0, max: 3 }),
        }),
        async (counts) => {
          try {
            // Create bookmarks
            for (let i = 0; i < counts.bookmarkCount; i++) {
              await bookmarkRepository.create({
                ownerId: testUserId,
                title: `Bookmark ${i}`,
                url: `https://example.com/${i}`,
                type: 'article' as unknown,
                domain: 'example.com',
                contentIndexed: false,
                isDuplicate: false,
                isBroken: false,
              });
            }

            // Create collections
            for (let i = 0; i < counts.collectionCount; i++) {
              await collectionRepository.create({
                ownerId: testUserId,
                title: `Collection ${i}`,
                isPublic: false,
                sortOrder: i,
              });
            }

            // Create tags
            for (let i = 0; i < counts.tagCount; i++) {
              await tagRepository.create({
                ownerId: testUserId,
                name: `Tag ${i}`,
                normalizedName: `tag ${i}`,
              });
            }

            // Export user data
            const exportData = await gdprService.exportUserData(testUserId);

            // Verify statistics match actual counts
            expect(exportData.statistics.totalBookmarks).toBe(
              counts.bookmarkCount
            );
            expect(exportData.statistics.totalCollections).toBe(
              counts.collectionCount
            );
            expect(exportData.statistics.totalTags).toBe(counts.tagCount);

            // Verify array lengths match statistics
            expect(exportData.bookmarks).toHaveLength(counts.bookmarkCount);
            expect(exportData.collections).toHaveLength(counts.collectionCount);
            expect(exportData.tags).toHaveLength(counts.tagCount);
          } finally {
            // Clean up after this iteration
            await pool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
              testUserId,
            ]);
            await pool.query('DELETE FROM collections WHERE owner_id = $1', [
              testUserId,
            ]);
            await pool.query('DELETE FROM tags WHERE owner_id = $1', [
              testUserId,
            ]);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Export Timestamp Validity
   *
   * For any export, the exportedAt timestamp should be a valid
   * ISO 8601 date string representing a recent time.
   */
  it('should export with valid and recent timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(testUserId), async (userId) => {
        const beforeExport = new Date();

        // Export user data
        const exportData = await gdprService.exportUserData(userId);

        const afterExport = new Date();

        // Verify timestamp is valid ISO 8601
        const exportedAt = new Date(exportData.exportedAt);
        expect(exportedAt.toISOString()).toBe(exportData.exportedAt);

        // Verify timestamp is recent (within test execution time)
        expect(exportedAt.getTime()).toBeGreaterThanOrEqual(
          beforeExport.getTime()
        );
        expect(exportedAt.getTime()).toBeLessThanOrEqual(afterExport.getTime());
      }),
      { numRuns: 10 }
    );
  });
});
