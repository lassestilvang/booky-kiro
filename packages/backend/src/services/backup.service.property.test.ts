import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { BackupService } from './backup.service.js';
import { BackupRepository } from '../repositories/backup.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { CollectionRepository } from '../repositories/collection.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { HighlightRepository } from '../repositories/highlight.repository.js';
import { FileRepository } from '../repositories/file.repository.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import archiver from 'archiver';
import { Readable } from 'stream';

describe('BackupService Property-Based Tests', () => {
  let pool: Pool;
  let backupService: BackupService;
  let backupRepository: BackupRepository;
  let userRepository: UserRepository;
  let bookmarkRepository: BookmarkRepository;
  let collectionRepository: CollectionRepository;
  let tagRepository: TagRepository;
  let highlightRepository: HighlightRepository;
  let fileRepository: FileRepository;
  let tempDir: string;

  beforeEach(async () => {
    // Create database connection
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'bookmark_manager_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Initialize repositories
    backupRepository = new BackupRepository(pool);
    userRepository = new UserRepository(pool);
    bookmarkRepository = new BookmarkRepository(pool);
    collectionRepository = new CollectionRepository(pool);
    tagRepository = new TagRepository(pool);
    highlightRepository = new HighlightRepository(pool);
    fileRepository = new FileRepository(pool);

    // Create temporary directory for backups
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-test-'));

    // Initialize service
    backupService = new BackupService(
      backupRepository,
      userRepository,
      bookmarkRepository,
      collectionRepository,
      tagRepository,
      highlightRepository,
      fileRepository,
      tempDir
    );
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM backups');
    await pool.query('DELETE FROM highlights');
    await pool.query('DELETE FROM bookmark_tags');
    await pool.query('DELETE FROM bookmarks');
    await pool.query('DELETE FROM collections');
    await pool.query('DELETE FROM tags');
    await pool.query('DELETE FROM files');
    await pool.query('DELETE FROM users');

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up temp directory:', error);
    }

    await pool.end();
  });

  /**
   * Feature: bookmark-manager-platform, Property 34: Backup Completeness
   * For any user account, generating a backup should create an archive containing
   * all raindrops, collections, tags, highlights, metadata, and snapshot references
   * Validates: Requirements 11.1, 11.3
   */
  it('Property 34: Backup Completeness - backup contains all user data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          emailSuffix: fc.integer({ min: 0, max: 1000000 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          password: fc.string({ minLength: 8, maxLength: 50 }),
          plan: fc.constantFrom('free', 'pro'),
          collectionsCount: fc.integer({ min: 0, max: 5 }),
          bookmarksCount: fc.integer({ min: 0, max: 10 }),
          highlightsCount: fc.integer({ min: 0, max: 5 }),
        }),
        async (userData) => {
          // Create user with unique email
          const email = `test${userData.emailSuffix}${Date.now()}@example.com`;
          const user = await userRepository.createWithPassword(
            email,
            userData.password,
            userData.name,
            userData.plan as 'free' | 'pro'
          );

          // Create collections
          const collections = [];
          for (let i = 0; i < userData.collectionsCount; i++) {
            const collection = await collectionRepository.create({
              ownerId: user.id,
              title: `Collection ${i}`,
              icon: 'folder',
              isPublic: false,
              sortOrder: i,
            });
            collections.push(collection);
          }

          // Create bookmarks
          const bookmarks = [];
          for (let i = 0; i < userData.bookmarksCount; i++) {
            const bookmark = await bookmarkRepository.create({
              ownerId: user.id,
              collectionId: collections.length > 0 ? collections[0].id : undefined,
              title: `Bookmark ${i}`,
              url: `https://example.com/page${i}`,
              excerpt: `Excerpt ${i}`,
              type: 'article',
              domain: 'example.com',
              isDuplicate: false,
              isBroken: false,
              contentIndexed: false,
            });
            bookmarks.push(bookmark);
          }

          // Create highlights (only if we have bookmarks)
          const highlights = [];
          const actualHighlightsCount = bookmarks.length > 0 ? userData.highlightsCount : 0;
          if (bookmarks.length > 0) {
            for (let i = 0; i < actualHighlightsCount; i++) {
              const highlight = await highlightRepository.create({
                bookmarkId: bookmarks[0].id,
                ownerId: user.id,
                textSelected: `Selected text ${i}`,
                color: '#FFFF00',
                annotationMd: `Annotation ${i}`,
                positionContext: { before: 'before', after: 'after' },
              });
              highlights.push(highlight);
            }
          }

          // Generate backup
          const backup = await backupService.generateBackup(user.id, false);

          // Verify backup was created
          expect(backup).toBeDefined();
          expect(backup.ownerId).toBe(user.id);
          expect(backup.sizeBytes).toBeGreaterThan(0);

          // Read and parse backup file
          const backupStream = await backupService.getBackupStream(backup.id, user.id);
          const chunks: Buffer[] = [];
          for await (const chunk of backupStream) {
            chunks.push(Buffer.from(chunk));
          }
          const backupBuffer = Buffer.concat(chunks);

          // Verify backup file exists and has content
          expect(backupBuffer.length).toBeGreaterThan(0);

          // Extract and verify backup contents
          const AdmZip = (await import('adm-zip')).default;
          const zip = new AdmZip(backupBuffer);
          const zipEntries = zip.getEntries();

          // Verify backup.json exists
          const backupJsonEntry = zipEntries.find((e) => e.entryName === 'backup.json');
          expect(backupJsonEntry).toBeDefined();

          if (backupJsonEntry) {
            const backupData = JSON.parse(backupJsonEntry.getData().toString('utf8'));

            // Verify user data
            expect(backupData.user.id).toBe(user.id);
            expect(backupData.user.email).toBe(email);
            expect(backupData.user.name).toBe(user.name);
            expect(backupData.user.plan).toBe(user.plan);

            // Verify collections
            expect(backupData.collections).toHaveLength(userData.collectionsCount);
            for (const collection of backupData.collections) {
              expect(collection.id).toBeDefined();
              expect(collection.title).toBeDefined();
            }

            // Verify bookmarks
            expect(backupData.bookmarks).toHaveLength(userData.bookmarksCount);
            for (const bookmark of backupData.bookmarks) {
              expect(bookmark.id).toBeDefined();
              expect(bookmark.url).toBeDefined();
              expect(bookmark.title).toBeDefined();
            }

            // Verify highlights (only if we had bookmarks)
            const expectedHighlightsCount = bookmarks.length > 0 ? userData.highlightsCount : 0;
            expect(backupData.highlights).toHaveLength(expectedHighlightsCount);
            for (const highlight of backupData.highlights) {
              expect(highlight.id).toBeDefined();
              expect(highlight.textSelected).toBeDefined();
            }

            // Verify metadata
            expect(backupData.metadata).toBeDefined();
            expect(backupData.metadata.version).toBeDefined();
            expect(backupData.metadata.backupDate).toBeDefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 36: Backup Format Round-Trip
   * For any user account backup, the backup archive should be in a standard format
   * (ZIP with JSON metadata) that can be used to restore the account
   * Validates: Requirements 11.1, 11.3, 11.5
   */
  it('Property 36: Backup Format Round-Trip - backup can be parsed and contains valid JSON', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          emailSuffix: fc.integer({ min: 0, max: 1000000 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          password: fc.string({ minLength: 8, maxLength: 50 }),
          plan: fc.constantFrom('free', 'pro'),
          bookmarksCount: fc.integer({ min: 1, max: 5 }),
        }),
        async (userData) => {
          // Create user with unique email
          const email = `test${userData.emailSuffix}${Date.now()}@example.com`;
          const user = await userRepository.createWithPassword(
            email,
            userData.password,
            userData.name,
            userData.plan as 'free' | 'pro'
          );

          // Create some bookmarks
          for (let i = 0; i < userData.bookmarksCount; i++) {
            await bookmarkRepository.create({
              ownerId: user.id,
              title: `Bookmark ${i}`,
              url: `https://example.com/page${i}`,
              type: 'article',
              domain: 'example.com',
              isDuplicate: false,
              isBroken: false,
              contentIndexed: false,
            });
          }

          // Generate backup
          const backup = await backupService.generateBackup(user.id, false);

          // Get backup stream
          const backupStream = await backupService.getBackupStream(backup.id, user.id);
          const chunks: Buffer[] = [];
          for await (const chunk of backupStream) {
            chunks.push(Buffer.from(chunk));
          }
          const backupBuffer = Buffer.concat(chunks);

          // Verify it's a valid ZIP file
          const AdmZip = (await import('adm-zip')).default;
          let zip: any;
          try {
            zip = new AdmZip(backupBuffer);
          } catch (error) {
            throw new Error('Backup is not a valid ZIP file');
          }

          const zipEntries = zip.getEntries();
          expect(zipEntries.length).toBeGreaterThan(0);

          // Verify backup.json exists and is valid JSON
          const backupJsonEntry = zipEntries.find((e: any) => e.entryName === 'backup.json');
          expect(backupJsonEntry).toBeDefined();

          if (backupJsonEntry) {
            const jsonContent = backupJsonEntry.getData().toString('utf8');
            let backupData: any;

            // Verify it's valid JSON
            try {
              backupData = JSON.parse(jsonContent);
            } catch (error) {
              throw new Error('backup.json is not valid JSON');
            }

            // Verify required structure
            expect(backupData.user).toBeDefined();
            expect(backupData.collections).toBeDefined();
            expect(backupData.bookmarks).toBeDefined();
            expect(backupData.highlights).toBeDefined();
            expect(backupData.files).toBeDefined();
            expect(backupData.metadata).toBeDefined();

            // Verify metadata has version
            expect(backupData.metadata.version).toBeDefined();
            expect(typeof backupData.metadata.version).toBe('string');

            // Verify arrays are arrays
            expect(Array.isArray(backupData.collections)).toBe(true);
            expect(Array.isArray(backupData.bookmarks)).toBe(true);
            expect(Array.isArray(backupData.highlights)).toBe(true);
            expect(Array.isArray(backupData.files)).toBe(true);

            // Verify bookmark count matches
            expect(backupData.bookmarks.length).toBe(userData.bookmarksCount);

            // Verify each bookmark has required fields for restoration
            for (const bookmark of backupData.bookmarks) {
              expect(bookmark.id).toBeDefined();
              expect(bookmark.url).toBeDefined();
              expect(bookmark.title).toBeDefined();
              expect(bookmark.createdAt).toBeDefined();
              expect(Array.isArray(bookmark.tags)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 35: Backup Retention Policy
   * For any Pro user account, the system should retain the last 30 daily automatic backups
   * and remove older backups
   * Validates: Requirements 11.4
   */
  it('Property 35: Backup Retention Policy - keeps only last 30 backups', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          emailSuffix: fc.integer({ min: 0, max: 1000000 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          password: fc.string({ minLength: 8, maxLength: 50 }),
          backupsToCreate: fc.integer({ min: 31, max: 40 }), // Create more than retention limit
        }),
        async (userData) => {
          // Create Pro user
          const email = `test${userData.emailSuffix}${Date.now()}@example.com`;
          const user = await userRepository.createWithPassword(
            email,
            userData.password,
            userData.name,
            'pro'
          );

          // Create a bookmark so backups have content
          await bookmarkRepository.create({
            ownerId: user.id,
            title: 'Test Bookmark',
            url: 'https://example.com/test',
            type: 'article',
            domain: 'example.com',
            isDuplicate: false,
            isBroken: false,
            contentIndexed: false,
          });

          // Generate multiple backups
          const createdBackups = [];
          for (let i = 0; i < userData.backupsToCreate; i++) {
            const backup = await backupService.generateBackup(user.id, true);
            createdBackups.push(backup);
            
            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          // Get all backups for user
          const remainingBackups = await backupService.getUserBackups(user.id);

          // Verify retention policy: should keep only last 30 backups
          expect(remainingBackups.length).toBeLessThanOrEqual(30);

          // Verify the most recent backups are kept
          const remainingIds = remainingBackups.map(b => b.id);
          const mostRecentBackups = createdBackups.slice(-30);
          
          for (const recentBackup of mostRecentBackups) {
            expect(remainingIds).toContain(recentBackup.id);
          }

          // Verify older backups are removed
          if (userData.backupsToCreate > 30) {
            const oldestBackups = createdBackups.slice(0, userData.backupsToCreate - 30);
            for (const oldBackup of oldestBackups) {
              expect(remainingIds).not.toContain(oldBackup.id);
            }
          }
        }
      ),
      { numRuns: 10 } // Fewer runs since this test creates many backups
    );
  });
});
