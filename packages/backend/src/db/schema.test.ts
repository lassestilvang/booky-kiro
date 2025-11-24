import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import pool from './config.js';
import { runMigrations } from './migrate.js';
import type { BookmarkType } from '@bookmark-manager/shared';

/**
 * Feature: bookmark-manager-platform, Property 1: Bookmark Creation Completeness
 *
 * For any valid bookmark data with all required fields (URL, title, excerpt, cover image,
 * domain, type, timestamps, owner, collection), creating a bookmark should result in all
 * fields being persisted correctly in the database.
 *
 * Validates: Requirements 1.1
 */

/**
 * Feature: bookmark-manager-platform, Property 6: Collection Creation Completeness
 *
 * For any valid collection data with all required fields (title, owner, icon, visibility,
 * timestamps), creating a collection should result in all fields being persisted correctly.
 *
 * Validates: Requirements 2.1
 */

describe('Database Schema Property Tests', () => {
  beforeAll(async () => {
    // Run migrations to set up the schema
    await runMigrations();
  });

  afterAll(async () => {
    // Clean up and close pool
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM bookmark_tags');
      await client.query('DELETE FROM highlights');
      await client.query('DELETE FROM files');
      await client.query('DELETE FROM bookmarks');
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
  });

  describe('Property 1: Bookmark Creation Completeness', () => {
    it('should persist all bookmark fields correctly for any valid bookmark data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary bookmark data
          fc.record({
            title: fc
              .string({ minLength: 1, maxLength: 500 })
              .filter((s) => s.trim().length > 0),
            url: fc.webUrl(),
            excerpt: fc.option(fc.string({ maxLength: 1000 }), {
              nil: undefined,
            }),
            contentSnapshotPath: fc.option(fc.string(), { nil: undefined }),
            contentIndexed: fc.boolean(),
            type: fc.constantFrom<BookmarkType>(
              'article',
              'video',
              'image',
              'file',
              'document'
            ),
            domain: fc.domain(),
            coverUrl: fc.option(fc.webUrl(), { nil: undefined }),
            isDuplicate: fc.boolean(),
            isBroken: fc.boolean(),
            customOrder: fc.option(fc.integer({ min: 0, max: 10000 }), {
              nil: undefined,
            }),
          }),
          async (bookmarkData) => {
            const client = await pool.connect();
            try {
              // Create a test user with unique email
              const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
              const userResult = await client.query(
                `INSERT INTO users (email, password_hash, name, plan) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id`,
                [uniqueEmail, 'hash', 'Test User', 'free']
              );
              const userId = userResult.rows[0].id;

              // Create a test collection
              const collectionResult = await client.query(
                `INSERT INTO collections (owner_id, title, icon) 
                 VALUES ($1, $2, $3) 
                 RETURNING id`,
                [userId, 'Test Collection', 'bookmark']
              );
              const collectionId = collectionResult.rows[0].id;

              // Insert bookmark with all fields
              const insertResult = await client.query(
                `INSERT INTO bookmarks (
                  owner_id, collection_id, title, url, excerpt, 
                  content_snapshot_path, content_indexed, type, domain, 
                  cover_url, is_duplicate, is_broken, custom_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *`,
                [
                  userId,
                  collectionId,
                  bookmarkData.title,
                  bookmarkData.url,
                  bookmarkData.excerpt,
                  bookmarkData.contentSnapshotPath,
                  bookmarkData.contentIndexed,
                  bookmarkData.type,
                  bookmarkData.domain,
                  bookmarkData.coverUrl,
                  bookmarkData.isDuplicate,
                  bookmarkData.isBroken,
                  bookmarkData.customOrder,
                ]
              );

              const insertedBookmark = insertResult.rows[0];

              // Retrieve the bookmark
              const selectResult = await client.query(
                'SELECT * FROM bookmarks WHERE id = $1',
                [insertedBookmark.id]
              );

              const retrievedBookmark = selectResult.rows[0];

              // Verify all fields are persisted correctly
              expect(retrievedBookmark.id).toBe(insertedBookmark.id);
              expect(retrievedBookmark.owner_id).toBe(userId);
              expect(retrievedBookmark.collection_id).toBe(collectionId);
              expect(retrievedBookmark.title).toBe(bookmarkData.title);
              expect(retrievedBookmark.url).toBe(bookmarkData.url);
              expect(retrievedBookmark.excerpt).toBe(
                bookmarkData.excerpt ?? null
              );
              expect(retrievedBookmark.content_snapshot_path).toBe(
                bookmarkData.contentSnapshotPath ?? null
              );
              expect(retrievedBookmark.content_indexed).toBe(
                bookmarkData.contentIndexed
              );
              expect(retrievedBookmark.type).toBe(bookmarkData.type);
              expect(retrievedBookmark.domain).toBe(bookmarkData.domain);
              expect(retrievedBookmark.cover_url).toBe(
                bookmarkData.coverUrl ?? null
              );
              expect(retrievedBookmark.is_duplicate).toBe(
                bookmarkData.isDuplicate
              );
              expect(retrievedBookmark.is_broken).toBe(bookmarkData.isBroken);
              expect(retrievedBookmark.custom_order).toBe(
                bookmarkData.customOrder ?? null
              );
              expect(retrievedBookmark.created_at).toBeInstanceOf(Date);
              expect(retrievedBookmark.updated_at).toBeInstanceOf(Date);
            } finally {
              client.release();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Collection Creation Completeness', () => {
    it('should persist all collection fields correctly for any valid collection data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary collection data
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 255 }),
            icon: fc.string({ minLength: 1, maxLength: 100 }),
            isPublic: fc.boolean(),
            shareSlug: fc.option(
              fc
                .string({ minLength: 5, maxLength: 50 })
                .filter((s) => /^[a-z0-9-]+$/.test(s)),
              { nil: undefined }
            ),
            sortOrder: fc.integer({ min: 0, max: 10000 }),
          }),
          async (collectionData) => {
            const client = await pool.connect();
            try {
              // Create a test user with unique email
              const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
              const userResult = await client.query(
                `INSERT INTO users (email, password_hash, name, plan) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id`,
                [uniqueEmail, 'hash', 'Test User', 'free']
              );
              const userId = userResult.rows[0].id;

              // Make shareSlug unique if provided
              const uniqueShareSlug = collectionData.shareSlug
                ? `${collectionData.shareSlug}-${Date.now()}-${Math.random().toString(36).substring(7)}`
                : null;

              // Insert collection with all fields
              const insertResult = await client.query(
                `INSERT INTO collections (
                  owner_id, title, icon, is_public, share_slug, sort_order
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *`,
                [
                  userId,
                  collectionData.title,
                  collectionData.icon,
                  collectionData.isPublic,
                  uniqueShareSlug,
                  collectionData.sortOrder,
                ]
              );

              const insertedCollection = insertResult.rows[0];

              // Retrieve the collection
              const selectResult = await client.query(
                'SELECT * FROM collections WHERE id = $1',
                [insertedCollection.id]
              );

              const retrievedCollection = selectResult.rows[0];

              // Verify all fields are persisted correctly
              expect(retrievedCollection.id).toBe(insertedCollection.id);
              expect(retrievedCollection.owner_id).toBe(userId);
              expect(retrievedCollection.title).toBe(collectionData.title);
              expect(retrievedCollection.icon).toBe(collectionData.icon);
              expect(retrievedCollection.is_public).toBe(
                collectionData.isPublic
              );
              expect(retrievedCollection.share_slug).toBe(uniqueShareSlug);
              expect(retrievedCollection.sort_order).toBe(
                collectionData.sortOrder
              );
              expect(retrievedCollection.created_at).toBeInstanceOf(Date);
              expect(retrievedCollection.updated_at).toBeInstanceOf(Date);
            } finally {
              client.release();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
