import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { CollectionService } from './collection.service.js';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { CollectionPermissionRepository } from '../repositories/permission.repository.js';
import { CollectionRole } from '@bookmark-manager/shared';

// Test database configuration
const testPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bookmark_manager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

describe('Collection Service - Property-Based Tests', () => {
  let collectionService: CollectionService;
  let collectionRepository: CollectionRepository;
  let bookmarkRepository: BookmarkRepository;
  let permissionRepository: CollectionPermissionRepository;

  beforeEach(() => {
    collectionRepository = new CollectionRepository(testPool);
    bookmarkRepository = new BookmarkRepository(testPool);
    permissionRepository = new CollectionPermissionRepository(testPool);
    collectionService = new CollectionService(
      collectionRepository,
      bookmarkRepository,
      permissionRepository
    );
  });

  afterEach(async () => {
    // Clean up test data
    await testPool.query('DELETE FROM collection_permissions');
    await testPool.query('DELETE FROM bookmarks');
    await testPool.query('DELETE FROM collections');
    await testPool.query('DELETE FROM users');
  });

  /**
   * Feature: bookmark-manager-platform, Property 9: Collection Deletion Behavior
   * Validates: Requirements 2.4
   *
   * For any collection with contained bookmarks, deleting the collection should either
   * move all bookmarks to a default collection or delete them based on user preference,
   * with no orphaned bookmarks.
   */
  it('Property 9: Collection Deletion Behavior - no orphaned bookmarks after collection deletion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(
          fc.record({
            title: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim().length > 0),
            url: fc.webUrl(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.boolean(), // deleteBookmarks flag
        async (ownerId, collectionId, bookmarksData, deleteBookmarks) => {
          // Create owner user
          await testPool.query(
            `INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'free', NOW(), NOW())`,
            [ownerId, `owner-${ownerId}@test.com`, 'Owner', 'hash']
          );

          // Create collection
          await testPool.query(
            `INSERT INTO collections (id, owner_id, title, icon, is_public, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, false, 0, NOW(), NOW())`,
            [collectionId, ownerId, 'Test Collection', '📁']
          );

          // Create bookmarks in the collection
          const bookmarkIds: string[] = [];
          for (const bookmarkData of bookmarksData) {
            const result = await testPool.query(
              `INSERT INTO bookmarks (owner_id, collection_id, title, url, type, domain, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'article', 'example.com', NOW(), NOW())
               RETURNING id`,
              [ownerId, collectionId, bookmarkData.title, bookmarkData.url]
            );
            bookmarkIds.push(result.rows[0].id);
          }

          // Delete the collection
          await collectionService.deleteCollection(
            collectionId,
            ownerId,
            deleteBookmarks
          );

          // Verify collection is deleted
          const collection = await collectionRepository.findById(collectionId);
          expect(collection).toBeNull();

          if (deleteBookmarks) {
            // Verify all bookmarks are deleted
            for (const bookmarkId of bookmarkIds) {
              const bookmark = await bookmarkRepository.findById(bookmarkId);
              expect(bookmark).toBeNull();
            }
          } else {
            // Verify all bookmarks are moved to null collection (uncategorized)
            for (const bookmarkId of bookmarkIds) {
              const bookmark = await bookmarkRepository.findById(bookmarkId);
              expect(bookmark).not.toBeNull();
              expect(bookmark?.collectionId).toBeNull();
            }
          }

          // Verify no orphaned bookmarks (bookmarks with non-existent collection_id)
          const orphanedResult = await testPool.query(
            `SELECT b.* FROM bookmarks b
             LEFT JOIN collections c ON b.collection_id = c.id
             WHERE b.owner_id = $1 AND b.collection_id IS NOT NULL AND c.id IS NULL`,
            [ownerId]
          );
          expect(orphanedResult.rows.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 37: Permission Creation
   * Validates: Requirements 12.1
   *
   * For any Pro user sharing a collection with another user, the system should create
   * a permission record with the specified role (owner, editor, viewer).
   */
  it('Property 37: Permission Creation - sharing creates permission with specified role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom<CollectionRole>('owner', 'editor', 'viewer'),
        async (ownerId, targetUserId, collectionId, role) => {
          // Ensure owner and target are different
          fc.pre(ownerId !== targetUserId);

          // Create owner user
          await testPool.query(
            `INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'pro', NOW(), NOW())`,
            [ownerId, `owner-${ownerId}@test.com`, 'Owner', 'hash']
          );

          // Create target user
          await testPool.query(
            `INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'free', NOW(), NOW())`,
            [targetUserId, `target-${targetUserId}@test.com`, 'Target', 'hash']
          );

          // Create collection
          await testPool.query(
            `INSERT INTO collections (id, owner_id, title, icon, is_public, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, false, 0, NOW(), NOW())`,
            [collectionId, ownerId, 'Test Collection', '📁']
          );

          // Share collection
          const permission = await collectionService.shareCollection(
            collectionId,
            ownerId,
            targetUserId,
            role
          );

          // Verify permission was created with correct role
          expect(permission).toBeDefined();
          expect(permission.collectionId).toBe(collectionId);
          expect(permission.userId).toBe(targetUserId);
          expect(permission.role).toBe(role);

          // Verify permission exists in database
          const dbPermission =
            await permissionRepository.findByCollectionAndUser(
              collectionId,
              targetUserId
            );
          expect(dbPermission).not.toBeNull();
          expect(dbPermission?.role).toBe(role);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 39: Collaborative Editing Visibility
   * Validates: Requirements 12.3
   *
   * For any user with editor permission on a shared collection, modifications made
   * should be immediately visible to all users with access to the collection.
   */
  it('Property 39: Collaborative Editing Visibility - editor changes visible to all', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (ownerId, editorId, viewerId, originalTitle, newTitle) => {
          // Ensure all users are different
          fc.pre(
            ownerId !== editorId &&
              ownerId !== viewerId &&
              editorId !== viewerId
          );
          fc.pre(originalTitle !== newTitle);

          // Create users
          await testPool.query(
            `INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'pro', NOW(), NOW())`,
            [ownerId, `owner-${ownerId}@test.com`, 'Owner', 'hash']
          );

          await testPool.query(
            `INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'pro', NOW(), NOW())`,
            [editorId, `editor-${editorId}@test.com`, 'Editor', 'hash']
          );

          await testPool.query(
            `INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'free', NOW(), NOW())`,
            [viewerId, `viewer-${viewerId}@test.com`, 'Viewer', 'hash']
          );

          // Create collection
          const collectionResult = await testPool.query(
            `INSERT INTO collections (owner_id, title, icon, is_public, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, false, 0, NOW(), NOW())
             RETURNING id`,
            [ownerId, originalTitle, '📁']
          );
          const collectionId = collectionResult.rows[0].id;

          // Share with editor and viewer
          await collectionService.shareCollection(
            collectionId,
            ownerId,
            editorId,
            'editor'
          );
          await collectionService.shareCollection(
            collectionId,
            ownerId,
            viewerId,
            'viewer'
          );

          // Editor updates the collection
          await collectionService.updateCollection(collectionId, editorId, {
            title: newTitle,
          });

          // Verify owner sees the change
          const ownerView = await collectionService.getCollectionById(
            collectionId,
            ownerId
          );
          expect(ownerView?.title).toBe(newTitle);

          // Verify viewer sees the change
          const viewerView = await collectionService.getCollectionById(
            collectionId,
            viewerId
          );
          expect(viewerView?.title).toBe(newTitle);

          // Verify editor sees the change
          const editorView = await collectionService.getCollectionById(
            collectionId,
            editorId
          );
          expect(editorView?.title).toBe(newTitle);

          // All users should see the same updated title
          expect(ownerView?.title).toBe(viewerView?.title);
          expect(ownerView?.title).toBe(editorView?.title);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 38: Public Share Slug Uniqueness
   * Validates: Requirements 12.2
   *
   * For any collection published publicly, the system should generate a unique share slug
   * that enables unauthenticated read-only access.
   */
  it('Property 38: Public Share Slug Uniqueness - each public collection gets unique slug', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 2,
          maxLength: 10,
        }),
        async (ownerId, collectionTitles) => {
          // Create owner user
          await testPool.query(
            `INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'pro', NOW(), NOW())`,
            [ownerId, `owner-${ownerId}@test.com`, 'Owner', 'hash']
          );

          const shareSlugs: string[] = [];

          // Create multiple collections and make them public
          for (const title of collectionTitles) {
            const collectionResult = await testPool.query(
              `INSERT INTO collections (owner_id, title, icon, is_public, sort_order, created_at, updated_at)
               VALUES ($1, $2, $3, false, 0, NOW(), NOW())
               RETURNING id`,
              [ownerId, title, '📁']
            );
            const collectionId = collectionResult.rows[0].id;

            // Make collection public and get share slug
            const shareSlug = await collectionService.makePublic(
              collectionId,
              ownerId
            );
            shareSlugs.push(shareSlug);

            // Verify the collection can be retrieved by share slug
            const publicCollection =
              await collectionService.getPublicCollection(shareSlug);
            expect(publicCollection).not.toBeNull();
            expect(publicCollection?.id).toBe(collectionId);
            expect(publicCollection?.isPublic).toBe(true);
          }

          // Verify all share slugs are unique
          const uniqueSlugs = new Set(shareSlugs);
          expect(uniqueSlugs.size).toBe(shareSlugs.length);

          // Verify each slug is non-empty and has reasonable length
          for (const slug of shareSlugs) {
            expect(slug).toBeTruthy();
            expect(slug.length).toBeGreaterThan(0);
            expect(slug.length).toBeLessThanOrEqual(50);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
