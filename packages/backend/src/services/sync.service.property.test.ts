import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { SyncService, SyncEntity } from './sync.service.js';

/**
 * Property-Based Tests for Sync Service
 *
 * Tests Properties 72 and 73 from the design document
 */

describe('SyncService Property Tests', () => {
  let pool: Pool;
  let redis: Redis;
  let syncService: SyncService;
  let testUserId: string;

  beforeEach(async () => {
    // Initialize test database connection
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bookmark_manager_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Initialize Redis connection
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: 1, // Use separate DB for tests
    });

    syncService = new SyncService(pool, redis);

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name, plan)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['test@example.com', 'hash', 'Test User', 'free']
    );
    testUserId = userResult.rows[0].id;
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM bookmarks WHERE owner_id = $1', [testUserId]);
    await pool.query('DELETE FROM collections WHERE owner_id = $1', [
      testUserId,
    ]);
    await pool.query('DELETE FROM tags WHERE owner_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);

    // Close connections
    await pool.end();
    await redis.quit();
  });

  /**
   * Feature: bookmark-manager-platform, Property 72: Offline Synchronization
   *
   * For any device that comes online after being offline, the system should
   * synchronize all changes that occurred during the offline period.
   *
   * Validates: Requirements 24.3
   */
  it('Property 72: Offline Synchronization - syncs all changes from offline period', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            url: fc.webUrl(),
            type: fc.constantFrom(
              'article',
              'video',
              'image',
              'file',
              'document'
            ),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (bookmarks) => {
          // Simulate offline period: create bookmarks on server
          const serverBookmarkIds: string[] = [];
          const offlineTimestamp = new Date(Date.now() - 60000); // 1 minute ago

          for (const bookmark of bookmarks) {
            const result = await pool.query(
              `INSERT INTO bookmarks (owner_id, title, url, type, domain, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                testUserId,
                bookmark.title,
                bookmark.url,
                bookmark.type,
                new URL(bookmark.url).hostname,
                new Date(),
                new Date(),
              ]
            );
            serverBookmarkIds.push(result.rows[0].id);
          }

          // Device comes online and requests delta sync
          const syncResponse = await syncService.getDeltaChanges(testUserId, {
            lastSyncTimestamp: offlineTimestamp,
            deviceId: 'test-device',
          });

          // Verify all server changes are included in sync response
          expect(syncResponse.changes.length).toBeGreaterThanOrEqual(
            bookmarks.length
          );

          // Verify all created bookmarks are in the sync response
          const syncedBookmarkIds = syncResponse.changes
            .filter((c) => c.type === 'bookmark')
            .map((c) => c.id);

          for (const id of serverBookmarkIds) {
            expect(syncedBookmarkIds).toContain(id);
          }

          // Verify timestamp is current
          expect(syncResponse.timestamp.getTime()).toBeGreaterThan(
            offlineTimestamp.getTime()
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 73: Conflict Resolution
   *
   * For any conflicting changes, the system should resolve conflicts using
   * last-write-wins strategy with timestamp comparison.
   *
   * Validates: Requirements 24.4
   */
  it('Property 73: Conflict Resolution - uses last-write-wins with timestamps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title1: fc.string({ minLength: 1, maxLength: 100 }),
          title2: fc.string({ minLength: 1, maxLength: 100 }),
          url: fc.webUrl(),
        }),
        async ({ title1, title2, url }) => {
          // Create a bookmark
          const result = await pool.query(
            `INSERT INTO bookmarks (owner_id, title, url, type, domain, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              testUserId,
              title1,
              url,
              'article',
              new URL(url).hostname,
              new Date(Date.now() - 10000), // 10 seconds ago
              new Date(Date.now() - 10000),
            ]
          );
          const bookmarkId = result.rows[0].id;

          // Update bookmark on server (newer timestamp)
          const serverUpdateTime = new Date(Date.now() - 5000); // 5 seconds ago
          await pool.query(
            `UPDATE bookmarks SET title = $1, updated_at = $2 WHERE id = $3`,
            ['Server Update', serverUpdateTime, bookmarkId]
          );

          // Simulate client trying to apply older change
          const clientChange: SyncEntity = {
            id: bookmarkId,
            type: 'bookmark',
            action: 'update',
            data: {
              id: bookmarkId,
              title: title2,
              url,
              type: 'article',
              domain: new URL(url).hostname,
            },
            timestamp: new Date(Date.now() - 8000), // 8 seconds ago (older than server)
            userId: testUserId,
          };

          // Apply client change
          const conflicts = await syncService.applyChanges(
            testUserId,
            [clientChange],
            'test-device'
          );

          // Verify conflict was detected
          expect(conflicts.length).toBeGreaterThan(0);
          expect(conflicts[0].entityId).toBe(bookmarkId);
          expect(conflicts[0].resolution).toBe('remote'); // Server wins

          // Verify server version is preserved (last-write-wins)
          const finalResult = await pool.query(
            'SELECT title FROM bookmarks WHERE id = $1',
            [bookmarkId]
          );
          expect(finalResult.rows[0].title).toBe('Server Update');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Verify newer client changes win over older server changes
   */
  it('Property 73 (variant): Conflict Resolution - newer client changes win', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title1: fc.string({ minLength: 1, maxLength: 100 }),
          title2: fc.string({ minLength: 1, maxLength: 100 }),
          url: fc.webUrl(),
        }),
        async ({ title1, title2, url }) => {
          // Create a bookmark with older timestamp
          const result = await pool.query(
            `INSERT INTO bookmarks (owner_id, title, url, type, domain, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              testUserId,
              title1,
              url,
              'article',
              new URL(url).hostname,
              new Date(Date.now() - 10000),
              new Date(Date.now() - 10000), // 10 seconds ago
            ]
          );
          const bookmarkId = result.rows[0].id;

          // Simulate client applying newer change
          const clientChange: SyncEntity = {
            id: bookmarkId,
            type: 'bookmark',
            action: 'update',
            data: {
              id: bookmarkId,
              title: title2,
              url,
              type: 'article',
              domain: new URL(url).hostname,
              excerpt: 'Client update',
              collectionId: null,
            },
            timestamp: new Date(), // Current time (newer than server)
            userId: testUserId,
          };

          // Apply client change
          const conflicts = await syncService.applyChanges(
            testUserId,
            [clientChange],
            'test-device'
          );

          // Verify no conflicts (client wins)
          expect(conflicts.length).toBe(0);

          // Verify client version is applied
          const finalResult = await pool.query(
            'SELECT title FROM bookmarks WHERE id = $1',
            [bookmarkId]
          );
          expect(finalResult.rows[0].title).toBe(title2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Verify delta sync only returns changes after timestamp
   */
  it('Delta sync returns only changes after last sync timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            url: fc.webUrl(),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (bookmarks) => {
          // Create some bookmarks before sync point
          const beforeSyncTime = new Date(Date.now() - 60000);
          for (let i = 0; i < Math.floor(bookmarks.length / 2); i++) {
            await pool.query(
              `INSERT INTO bookmarks (owner_id, title, url, type, domain, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                testUserId,
                bookmarks[i].title,
                bookmarks[i].url,
                'article',
                new URL(bookmarks[i].url).hostname,
                beforeSyncTime,
                beforeSyncTime,
              ]
            );
          }

          const syncPoint = new Date(Date.now() - 30000);

          // Create some bookmarks after sync point
          const afterSyncIds: string[] = [];
          for (
            let i = Math.floor(bookmarks.length / 2);
            i < bookmarks.length;
            i++
          ) {
            const result = await pool.query(
              `INSERT INTO bookmarks (owner_id, title, url, type, domain, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                testUserId,
                bookmarks[i].title,
                bookmarks[i].url,
                'article',
                new URL(bookmarks[i].url).hostname,
                new Date(),
                new Date(),
              ]
            );
            afterSyncIds.push(result.rows[0].id);
          }

          // Get delta changes
          const syncResponse = await syncService.getDeltaChanges(testUserId, {
            lastSyncTimestamp: syncPoint,
            deviceId: 'test-device',
          });

          // Verify only changes after sync point are returned
          const syncedIds = syncResponse.changes
            .filter((c) => c.type === 'bookmark')
            .map((c) => c.id);

          // All after-sync bookmarks should be included
          for (const id of afterSyncIds) {
            expect(syncedIds).toContain(id);
          }

          // Verify all returned changes have timestamps after sync point
          for (const change of syncResponse.changes) {
            expect(change.timestamp.getTime()).toBeGreaterThan(
              syncPoint.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
