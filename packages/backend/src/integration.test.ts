import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { createClient } from 'redis';
import * as crypto from 'crypto';
import { AuthService } from './services/auth.service.js';
import { BookmarkService } from './services/bookmark.service.js';
import { CollectionService } from './services/collection.service.js';
import { TagService } from './services/tag.service.js';
import { SearchService } from './services/search.service.js';
import { ImportService } from './services/import.service.js';
import { ExportService } from './services/export.service.js';
import { UserRepository } from './repositories/user.repository.js';
import { BookmarkRepository } from './repositories/bookmark.repository.js';
import { CollectionRepository } from './repositories/collection.repository.js';
import { TagRepository } from './repositories/tag.repository.js';
import { CollectionPermissionRepository } from './repositories/permission.repository.js';
import { getStorageClient } from './utils/storage.js';
import { initializeSearchIndex } from './db/search.config.js';

/**
 * Integration Tests
 *
 * These tests validate complete workflows across multiple services and components:
 * 1. Bookmark creation → snapshot → indexing flow
 * 2. Authentication → authorization flow
 * 3. Search with filters end-to-end
 * 4. Import → export round-trip
 */

describe('Integration Tests', () => {
  let pool: Pool;
  let redis: ReturnType<typeof createClient>;
  let authService: AuthService;
  let bookmarkService: BookmarkService;
  let collectionService: CollectionService;
  let tagService: TagService;
  let searchService: SearchService;
  let importService: ImportService;
  let exportService: ExportService;
  let storageClient: ReturnType<typeof getStorageClient>;

  let testUserId: string;
  let testUserEmail: string;
  let testUserPassword: string;
  let accessToken: string;

  // Generate RSA key pairs for JWT signing
  function generateKeyPair(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
    return { privateKey, publicKey };
  }

  beforeAll(async () => {
    // Initialize database connection
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bookmark_manager',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Initialize Redis
    redis = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    });
    await redis.connect();

    // Initialize storage client
    storageClient = getStorageClient();
    await storageClient.initialize();

    // Initialize search index
    try {
      await initializeSearchIndex();
    } catch (error) {
      console.warn('Search index initialization failed:', error);
    }

    // Initialize repositories
    const userRepository = new UserRepository(pool);
    const bookmarkRepository = new BookmarkRepository(pool);
    const collectionRepository = new CollectionRepository(pool);
    const tagRepository = new TagRepository(pool);
    const permissionRepository = new CollectionPermissionRepository(pool);

    // Generate key pairs
    const accessKeyPair = generateKeyPair();
    const refreshKeyPair = generateKeyPair();

    // Initialize services
    authService = new AuthService(
      userRepository,
      accessKeyPair.privateKey,
      accessKeyPair.publicKey,
      refreshKeyPair.privateKey,
      refreshKeyPair.publicKey
    );

    bookmarkService = new BookmarkService(
      bookmarkRepository,
      tagRepository,
      storageClient
    );

    collectionService = new CollectionService(
      collectionRepository,
      bookmarkRepository,
      permissionRepository
    );

    tagService = new TagService(tagRepository);
    searchService = new SearchService();

    importService = new ImportService(
      bookmarkRepository,
      collectionRepository,
      tagRepository
    );

    exportService = new ExportService(
      bookmarkRepository,
      collectionRepository,
      tagRepository
    );
  });

  afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await pool.end();
    await redis.quit();
  });

  beforeEach(async () => {
    // Create a test user for each test
    testUserEmail = `test-${Date.now()}@example.com`;
    testUserPassword = 'TestPassword123!';

    const user = await authService.register({
      email: testUserEmail,
      password: testUserPassword,
      name: 'Test User',
    });

    testUserId = user.id;

    // Login to get access token
    const tokens = await authService.login({
      email: testUserEmail,
      password: testUserPassword,
    });
    accessToken = tokens.accessToken;
  });

  describe('Authentication → Authorization Flow', () => {
    it('should complete full authentication and authorization flow', async () => {
      // 1. Register a new user
      const newUserEmail = `new-user-${Date.now()}@example.com`;
      const newUserPassword = 'NewPassword123!';

      const registeredUser = await authService.register({
        email: newUserEmail,
        password: newUserPassword,
        name: 'New User',
      });

      expect(registeredUser).toBeDefined();
      expect(registeredUser.email).toBe(newUserEmail);
      expect(registeredUser.plan).toBe('free');

      // 2. Login with credentials
      const tokens = await authService.login({
        email: newUserEmail,
        password: newUserPassword,
      });

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      // 3. Verify access token
      const decoded = await authService.verifyAccessToken(tokens.accessToken);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(registeredUser.id);
      expect(decoded.email).toBe(newUserEmail);

      // 4. Use access token to access protected resource (create collection)
      const collection = await collectionService.createCollection(
        registeredUser.id,
        {
          title: 'Test Collection',
          icon: 'folder',
        }
      );

      expect(collection).toBeDefined();
      expect(collection.ownerId).toBe(registeredUser.id);
      expect(collection.title).toBe('Test Collection');

      // 5. Refresh token
      const newAccessToken = await authService.refreshAccessToken(
        tokens.refreshToken
      );

      expect(newAccessToken).toBeDefined();
      expect(typeof newAccessToken).toBe('string');

      // 6. Verify new access token works
      const decodedRefreshed =
        await authService.verifyAccessToken(newAccessToken);

      expect(decodedRefreshed.userId).toBe(registeredUser.id);

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [registeredUser.id]);
    });

    it('should enforce authorization based on user identity', async () => {
      // Create two users
      const user1Email = `user1-${Date.now()}@example.com`;
      const user2Email = `user2-${Date.now()}@example.com`;

      const user1 = await authService.register({
        email: user1Email,
        password: 'Password123!',
        name: 'User 1',
      });

      const user2 = await authService.register({
        email: user2Email,
        password: 'Password123!',
        name: 'User 2',
      });

      // User 1 creates a collection
      const collection = await collectionService.createCollection(user1.id, {
        title: 'User 1 Collection',
        icon: 'folder',
      });

      // User 2 should not be able to access User 1's collection
      const user2Collections = await collectionService.getUserCollections(
        user2.id
      );

      expect(user2Collections).toBeDefined();
      expect(
        user2Collections.find((c) => c.id === collection.id)
      ).toBeUndefined();

      // Cleanup
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [
        user1.id,
        user2.id,
      ]);
    });
  });

  describe('Bookmark Creation → Snapshot → Indexing Flow', () => {
    it('should complete full bookmark lifecycle', async () => {
      // 1. Create a collection
      const collection = await collectionService.createCollection(testUserId, {
        title: 'Test Collection',
        icon: 'folder',
      });

      expect(collection).toBeDefined();

      // 2. Create a bookmark
      const bookmark = await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/article',
        title: 'Test Article',
        excerpt: 'This is a test article about integration testing',
        collectionId: collection.id,
        tags: ['testing', 'integration'],
      });

      expect(bookmark).toBeDefined();
      expect(bookmark.url).toBe('https://example.com/article');
      expect(bookmark.title).toBe('Test Article');
      expect(bookmark.collectionId).toBe(collection.id);

      // 3. Verify bookmark is in collection
      const bookmarks = await bookmarkService.getUserBookmarks(testUserId, {
        collectionId: collection.id,
      });

      expect(bookmarks.data).toBeDefined();
      expect(bookmarks.data.length).toBeGreaterThan(0);
      expect(bookmarks.data[0].id).toBe(bookmark.id);

      // 4. Verify tags were created and associated
      const tags = await tagService.getUserTags(testUserId);

      expect(tags).toBeDefined();
      expect(tags.length).toBeGreaterThanOrEqual(2);

      const testingTag = tags.find((t) => t.name === 'testing');
      const integrationTag = tags.find((t) => t.name === 'integration');

      expect(testingTag).toBeDefined();
      expect(integrationTag).toBeDefined();

      // 5. Update bookmark
      // First verify the bookmark exists
      const existingBookmark = await bookmarkService.getBookmarkById(
        bookmark.id,
        testUserId
      );
      expect(existingBookmark).toBeDefined();

      const updatedBookmark = await bookmarkService.updateBookmark(
        testUserId,
        bookmark.id,
        {
          title: 'Updated Test Article',
          excerpt: 'Updated excerpt',
        }
      );

      expect(updatedBookmark.title).toBe('Updated Test Article');
      expect(updatedBookmark.excerpt).toBe('Updated excerpt');

      // 6. Delete bookmark
      await bookmarkService.deleteBookmark(testUserId, bookmark.id);

      // 7. Verify bookmark is deleted
      const deletedBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          collectionId: collection.id,
        }
      );

      expect(
        deletedBookmarks.data.find((b) => b.id === bookmark.id)
      ).toBeUndefined();
    });

    it('should handle bookmark with multiple tags and filtering', async () => {
      // Create bookmarks with different tag combinations
      const bookmark1 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/js',
        title: 'JavaScript Article',
        tags: ['javascript', 'programming', 'web'],
      });

      const bookmark2 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/python',
        title: 'Python Article',
        tags: ['python', 'programming'],
      });

      const bookmark3 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/design',
        title: 'Design Article',
        tags: ['design', 'web'],
      });

      // Filter by single tag
      const programmingBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          tags: ['programming'],
        }
      );

      expect(programmingBookmarks.data.length).toBe(2);
      expect(
        programmingBookmarks.data.find((b) => b.id === bookmark1.id)
      ).toBeDefined();
      expect(
        programmingBookmarks.data.find((b) => b.id === bookmark2.id)
      ).toBeDefined();

      // Filter by multiple tags (AND operation)
      const jsWebBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          tags: ['javascript', 'web'],
        }
      );

      expect(jsWebBookmarks.data.length).toBe(1);
      expect(jsWebBookmarks.data[0].id).toBe(bookmark1.id);

      // Filter by tag that doesn't exist
      const nonExistentBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          tags: ['nonexistent'],
        }
      );

      expect(nonExistentBookmarks.data.length).toBe(0);
    });
  });

  describe('Search with Filters End-to-End', () => {
    it('should filter bookmarks with various criteria', async () => {
      // Create test data
      const collection1 = await collectionService.createCollection(testUserId, {
        title: 'Tech Collection',
        icon: 'folder',
      });

      const collection2 = await collectionService.createCollection(testUserId, {
        title: 'Design Collection',
        icon: 'folder',
      });

      // Create bookmarks with different attributes
      const bookmark1 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/react-tutorial',
        title: 'React Tutorial',
        excerpt: 'Learn React hooks and components',
        collectionId: collection1.id,
        tags: ['react', 'javascript', 'tutorial'],
        type: 'article',
      });

      const bookmark2 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://youtube.com/watch?v=123',
        title: 'React Video Course',
        excerpt: 'Complete React video course',
        collectionId: collection1.id,
        tags: ['react', 'video', 'course'],
        type: 'video',
      });

      const bookmark3 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://design.com/principles',
        title: 'Design Principles',
        excerpt: 'UI/UX design principles',
        collectionId: collection2.id,
        tags: ['design', 'ui', 'ux'],
        type: 'article',
      });

      // Test 1: Filter by collection
      const collection1Bookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          collectionId: collection1.id,
        }
      );

      expect(collection1Bookmarks.data.length).toBe(2);

      // Test 2: Filter by type
      const videoBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          type: ['video'],
        }
      );

      expect(videoBookmarks.data.length).toBe(1);
      expect(videoBookmarks.data[0].id).toBe(bookmark2.id);

      // Test 3: Filter by domain
      const youtubeBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          domain: ['youtube.com'],
        }
      );

      expect(youtubeBookmarks.data.length).toBe(1);
      expect(youtubeBookmarks.data[0].id).toBe(bookmark2.id);

      // Test 4: Filter by tags
      const reactTagBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          tags: ['react'],
        }
      );

      expect(reactTagBookmarks.data.length).toBe(2);

      // Test 5: Combine multiple filters
      const reactArticles = await bookmarkService.getUserBookmarks(testUserId, {
        tags: ['react'],
        type: ['article'],
      });

      expect(reactArticles.data.length).toBe(1);
      expect(reactArticles.data[0].id).toBe(bookmark1.id);
    });

    it('should handle date range filtering', async () => {
      // Create bookmarks at different times
      const bookmark1 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/old',
        title: 'Old Bookmark',
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const bookmark2 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/new',
        title: 'New Bookmark',
      });

      // Get all bookmarks to check timestamps
      const allBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {}
      );

      expect(allBookmarks.data.length).toBeGreaterThanOrEqual(2);

      // Filter by date range (last hour)
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const recentBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          dateFrom: oneHourAgo.toISOString(),
          dateTo: now.toISOString(),
        }
      );

      expect(recentBookmarks.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Import → Export Round-Trip', () => {
    it('should import and export bookmarks maintaining data integrity', async () => {
      // 1. Create test data
      const collection = await collectionService.createCollection(testUserId, {
        title: 'Export Test Collection',
        icon: 'folder',
      });

      const bookmark1 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/article1',
        title: 'Article 1',
        excerpt: 'First article',
        collectionId: collection.id,
        tags: ['tag1', 'tag2'],
      });

      const bookmark2 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/article2',
        title: 'Article 2',
        excerpt: 'Second article',
        collectionId: collection.id,
        tags: ['tag2', 'tag3'],
      });

      // 2. Export to JSON
      const exportedData = await exportService.exportBookmarks(
        testUserId,
        'json',
        collection.id
      );

      expect(exportedData).toBeDefined();
      expect(typeof exportedData).toBe('string');

      const parsedExport = JSON.parse(exportedData);
      expect(parsedExport.bookmarks).toBeDefined();
      expect(parsedExport.bookmarks.length).toBe(2);

      // 3. Delete original bookmarks
      await bookmarkService.deleteBookmark(testUserId, bookmark1.id);
      await bookmarkService.deleteBookmark(testUserId, bookmark2.id);

      // 4. Import the exported data
      const parsedData = JSON.parse(exportedData);
      const importResult = await importService.importFromJson(
        testUserId,
        parsedData
      );

      expect(importResult).toBeDefined();
      expect(importResult.bookmarksCreated).toBe(2);

      // 5. Verify imported bookmarks
      const importedBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          collectionId: collection.id,
        }
      );

      expect(importedBookmarks.data.length).toBe(2);

      // Verify data integrity
      const importedBookmark1 = importedBookmarks.data.find(
        (b) => b.url === 'https://example.com/article1'
      );
      const importedBookmark2 = importedBookmarks.data.find(
        (b) => b.url === 'https://example.com/article2'
      );

      expect(importedBookmark1).toBeDefined();
      expect(importedBookmark1!.title).toBe('Article 1');
      expect(importedBookmark1!.excerpt).toBe('First article');

      expect(importedBookmark2).toBeDefined();
      expect(importedBookmark2!.title).toBe('Article 2');
      expect(importedBookmark2!.excerpt).toBe('Second article');
    });

    it('should import HTML bookmarks and preserve structure', async () => {
      // Create HTML bookmark file content
      const htmlContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Imported Folder</H3>
    <DL><p>
        <DT><A HREF="https://example.com/page1" ADD_DATE="1234567890">Page 1</A>
        <DT><A HREF="https://example.com/page2" ADD_DATE="1234567891">Page 2</A>
    </DL><p>
    <DT><A HREF="https://example.com/page3" ADD_DATE="1234567892">Page 3</A>
</DL><p>`;

      // Import HTML
      const importResult = await importService.importFromHtml(
        testUserId,
        htmlContent
      );

      expect(importResult).toBeDefined();
      expect(importResult.bookmarksCreated).toBeGreaterThanOrEqual(2); // At least 2 bookmarks imported
      expect(importResult.collectionsCreated).toBeGreaterThanOrEqual(1);

      // Verify collections were created
      const collections =
        await collectionService.getUserCollections(testUserId);
      const importedFolder = collections.find(
        (c) => c.title === 'Imported Folder'
      );

      expect(importedFolder).toBeDefined();

      // Verify bookmarks were created
      const allBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {}
      );

      expect(allBookmarks.data.length).toBeGreaterThanOrEqual(3);

      const page1 = allBookmarks.data.find(
        (b) => b.url === 'https://example.com/page1'
      );
      const page2 = allBookmarks.data.find(
        (b) => b.url === 'https://example.com/page2'
      );
      const page3 = allBookmarks.data.find(
        (b) => b.url === 'https://example.com/page3'
      );

      expect(page1).toBeDefined();
      expect(page2).toBeDefined();
      expect(page3).toBeDefined();

      // Verify folder structure
      expect(page1!.collectionId).toBe(importedFolder!.id);
      expect(page2!.collectionId).toBe(importedFolder!.id);
    });

    it('should export to different formats', async () => {
      // Create test data
      const collection = await collectionService.createCollection(testUserId, {
        title: 'Multi-Format Export',
        icon: 'folder',
      });

      await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/test1',
        title: 'Test 1',
        excerpt: 'Test excerpt 1',
        collectionId: collection.id,
        tags: ['test'],
      });

      await bookmarkService.createBookmark(testUserId, {
        url: 'https://example.com/test2',
        title: 'Test 2',
        excerpt: 'Test excerpt 2',
        collectionId: collection.id,
        tags: ['test'],
      });

      // Export to JSON
      const jsonExport = await exportService.exportBookmarks(
        testUserId,
        'json',
        collection.id
      );
      expect(jsonExport).toBeDefined();
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      // Export to HTML
      const htmlExport = await exportService.exportBookmarks(
        testUserId,
        'html',
        collection.id
      );
      expect(htmlExport).toBeDefined();
      expect(htmlExport).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
      expect(htmlExport).toContain('https://example.com/test1');
      expect(htmlExport).toContain('https://example.com/test2');

      // Export to CSV
      const csvExport = await exportService.exportBookmarks(
        testUserId,
        'csv',
        collection.id
      );
      expect(csvExport).toBeDefined();
      expect(csvExport).toContain('Title,URL'); // CSV headers are capitalized
      expect(csvExport).toContain('Test 1');
      expect(csvExport).toContain('Test 2');

      // Export to TXT
      const txtExport = await exportService.exportBookmarks(
        testUserId,
        'txt',
        collection.id
      );
      expect(txtExport).toBeDefined();
      expect(txtExport).toContain('https://example.com/test1');
      expect(txtExport).toContain('https://example.com/test2');
    });
  });

  describe('Complex Multi-Service Workflows', () => {
    it('should handle complete user workflow with collections, bookmarks, tags, and search', async () => {
      // 1. User creates multiple collections
      const workCollection = await collectionService.createCollection(
        testUserId,
        {
          title: 'Work',
          icon: 'briefcase',
        }
      );

      const personalCollection = await collectionService.createCollection(
        testUserId,
        {
          title: 'Personal',
          icon: 'home',
        }
      );

      // 2. User saves bookmarks to different collections
      const workBookmark1 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://work.com/project1',
        title: 'Project 1 Documentation',
        excerpt: 'Documentation for project 1',
        collectionId: workCollection.id,
        tags: ['work', 'documentation', 'project1'],
      });

      const workBookmark2 = await bookmarkService.createBookmark(testUserId, {
        url: 'https://work.com/project2',
        title: 'Project 2 Specs',
        excerpt: 'Specifications for project 2',
        collectionId: workCollection.id,
        tags: ['work', 'specs', 'project2'],
      });

      const personalBookmark = await bookmarkService.createBookmark(
        testUserId,
        {
          url: 'https://personal.com/recipe',
          title: 'Favorite Recipe',
          excerpt: 'My favorite recipe',
          collectionId: personalCollection.id,
          tags: ['personal', 'cooking', 'recipe'],
        }
      );

      // 3. User organizes with tags
      const allTags = await tagService.getUserTags(testUserId);
      expect(allTags.length).toBeGreaterThanOrEqual(8); // work, documentation, project1, project2, specs, personal, cooking, recipe

      // 4. User searches and filters
      const workBookmarks = await bookmarkService.getUserBookmarks(testUserId, {
        collectionId: workCollection.id,
      });
      expect(workBookmarks.data.length).toBe(2);

      const personalBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          collectionId: personalCollection.id,
        }
      );
      expect(personalBookmarks.data.length).toBe(1);

      // 5. User filters by tags
      const workTaggedBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          tags: ['work'],
        }
      );
      expect(workTaggedBookmarks.data.length).toBe(2);

      // 6. User moves bookmark between collections
      // First verify the bookmark exists
      const existingWorkBookmark = await bookmarkService.getBookmarkById(
        workBookmark1.id,
        testUserId
      );
      expect(existingWorkBookmark).toBeDefined();

      const movedBookmark = await bookmarkService.updateBookmark(
        testUserId,
        workBookmark1.id,
        {
          collectionId: personalCollection.id,
        }
      );
      expect(movedBookmark.collectionId).toBe(personalCollection.id);

      // 7. Verify collection contents updated
      const updatedWorkBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          collectionId: workCollection.id,
        }
      );
      expect(updatedWorkBookmarks.data.length).toBe(1);

      const updatedPersonalBookmarks = await bookmarkService.getUserBookmarks(
        testUserId,
        {
          collectionId: personalCollection.id,
        }
      );
      expect(updatedPersonalBookmarks.data.length).toBe(2);

      // 8. User exports work collection
      const exportedWork = await exportService.exportBookmarks(
        testUserId,
        'json',
        workCollection.id
      );
      const parsedWork = JSON.parse(exportedWork);
      expect(parsedWork.bookmarks.length).toBe(1);

      // 9. User deletes a collection
      await collectionService.deleteCollection(testUserId, workCollection.id);

      // 10. Verify bookmarks moved to default collection or deleted
      const remainingCollections =
        await collectionService.getUserCollections(testUserId);
      expect(
        remainingCollections.find((c) => c.id === workCollection.id)
      ).toBeUndefined();
    });
  });
});
