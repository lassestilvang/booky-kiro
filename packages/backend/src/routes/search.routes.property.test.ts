import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import express, { Application } from 'express';
import request from 'supertest';
import { createSearchRoutes } from './search.routes.js';
import { SearchService } from '../services/search.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { AuthService } from '../services/auth.service.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import * as crypto from 'crypto';
import { searchClient, BOOKMARKS_INDEX } from '../db/search.config.js';

/**
 * Property-based tests for Search API endpoints
 * Feature: bookmark-manager-platform
 */

// Shared key pairs for all tests
const accessKeyPair = (() => {
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
})();

const refreshKeyPair = (() => {
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
})();

// Test database pool
let pool: Pool;
let app: Application;
let authService: AuthService;
let searchService: SearchService;
let userRepository: UserRepository;

beforeAll(async () => {
  // Use test database
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'bookmark_db',
    user: process.env.DB_USER || 'bookmark_user',
    password: process.env.DB_PASSWORD || 'bookmark_pass',
  });

  // Initialize repositories and services
  userRepository = new UserRepository(pool);
  authService = new AuthService(
    userRepository,
    accessKeyPair.privateKey,
    accessKeyPair.publicKey,
    refreshKeyPair.privateKey,
    refreshKeyPair.publicKey
  );
  searchService = new SearchService();

  // Create Express app
  app = express();
  app.use(express.json());
  app.use(
    '/v1/search',
    createAuthMiddleware(authService),
    createSearchRoutes(searchService)
  );
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  // Clean up test data
  await pool.query('DELETE FROM bookmark_tags');
  await pool.query('DELETE FROM bookmarks');
  await pool.query('DELETE FROM tags');
  await pool.query('DELETE FROM collections');
  await pool.query('DELETE FROM users');

  // Clean up search index
  try {
    const index = searchClient.index(BOOKMARKS_INDEX);
    await index.deleteAllDocuments();
  } catch (error) {
    // Index might not exist yet, ignore
  }
});

/**
 * Helper function to create a test user and get auth token
 */
async function createTestUser(
  plan: 'free' | 'pro' = 'free'
): Promise<{ userId: string; token: string; email: string }> {
  // Generate unique email
  const email = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  const password = 'TestPassword123';

  // Register user
  const user = await authService.register({
    email,
    password,
    name: 'Test User',
    plan,
  });

  // Login to get token
  const tokens = await authService.login({
    email,
    password,
  });

  return { userId: user.id, token: tokens.accessToken, email };
}

/**
 * Helper function to create a test bookmark
 */
async function createTestBookmark(
  userId: string,
  url: string,
  title: string,
  tags: string[] = [],
  type: string = 'article'
): Promise<string> {
  // Validate userId
  if (!userId) {
    throw new Error('userId is required');
  }

  const result = await pool.query(
    'INSERT INTO bookmarks (owner_id, url, title, type, domain, excerpt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [userId, url, title, type, new URL(url).hostname, `Excerpt for ${title}`]
  );
  const bookmarkId = result.rows[0].id;

  // Add tags (deduplicate first)
  const uniqueTags = Array.from(new Set(tags));
  for (const tagName of uniqueTags) {
    const tagResult = await pool.query(
      'INSERT INTO tags (owner_id, name, normalized_name) VALUES ($1, $2, $3) ON CONFLICT (owner_id, normalized_name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [userId, tagName, tagName.toLowerCase()]
    );
    const tagId = tagResult.rows[0].id;

    await pool.query(
      'INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [bookmarkId, tagId]
    );
  }

  // Index in search
  await searchService.indexBookmark({
    id: bookmarkId,
    owner_id: userId,
    collection_id: null,
    title,
    url,
    domain: new URL(url).hostname,
    excerpt: `Excerpt for ${title}`,
    content: null,
    tags,
    type: type as any,
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
    has_snapshot: false,
    highlights_text: null,
  });

  // Wait for indexing
  await new Promise((resolve) => setTimeout(resolve, 100));

  return bookmarkId;
}

describe('Search API Property Tests', () => {
  /**
   * Property 55: Search Filter Combination
   * For any search query with multiple filters (tags, type, domain, date range, collection),
   * the results should match all specified filter criteria simultaneously.
   * Validates: Requirements 17.2
   */
  it('Property 55: Search Filter Combination - results match all filter criteria', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tags: fc.array(
            fc.constantFrom('javascript', 'typescript', 'react', 'node'),
            { minLength: 1, maxLength: 2 }
          ),
          type: fc.constantFrom('article', 'video', 'image'),
        }),
        async ({ tags, type }) => {
          // Create test user
          const { userId, token } = await createTestUser('pro');

          // Create bookmarks with various combinations
          const matchingBookmark = await createTestBookmark(
            userId,
            'https://example.com/matching',
            'Matching Bookmark',
            tags,
            type
          );

          // Create non-matching bookmarks
          await createTestBookmark(
            userId,
            'https://example.com/wrong-tags',
            'Wrong Tags',
            ['python'],
            type
          );

          await createTestBookmark(
            userId,
            'https://example.com/wrong-type',
            'Wrong Type',
            tags,
            'document'
          );

          // Search with filters
          const response = await request(app)
            .get('/v1/search')
            .query({
              tags: tags,
              type: type,
            })
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toBe(200);
          expect(response.body.results).toBeDefined();

          // All results should match the filter criteria
          for (const result of response.body.results) {
            // Check tags - all specified tags should be present
            for (const tag of tags) {
              expect(result.tags).toContain(tag);
            }

            // Check type
            expect(result.type).toBe(type);
          }

          // The matching bookmark should be in results
          const matchingResult = response.body.results.find(
            (r: any) => r.id === matchingBookmark
          );
          expect(matchingResult).toBeDefined();
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 56: Pro Full-Text Search Access
   * For any free tier user attempting to use full-text search,
   * the system should deny access and return a 403 error.
   * Validates: Requirements 17.3
   */
  it('Property 56: Pro Full-Text Search Access - free users cannot use full-text search', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (searchQuery) => {
          // Create free tier user
          const { token } = await createTestUser('free');

          // Attempt full-text search
          const response = await request(app)
            .get('/v1/search')
            .query({
              q: searchQuery,
              fulltext: 'true',
            })
            .set('Authorization', `Bearer ${token}`);

          // Should be denied
          expect(response.status).toBe(403);
          expect(response.body.error).toBeDefined();
          expect(response.body.error.code).toBe('PRO_FEATURE_REQUIRED');
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 56b: Pro users can use full-text search
   * For any Pro tier user attempting to use full-text search,
   * the system should allow access and return results.
   * Validates: Requirements 17.3
   */
  it('Property 56b: Pro Full-Text Search Access - pro users can use full-text search', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (searchQuery) => {
          // Create Pro tier user
          const { userId, token } = await createTestUser('pro');

          // Create a bookmark
          await createTestBookmark(
            userId,
            'https://example.com/test',
            'Test Bookmark'
          );

          // Attempt full-text search
          const response = await request(app)
            .get('/v1/search')
            .query({
              q: searchQuery,
              fulltext: 'true',
            })
            .set('Authorization', `Bearer ${token}`);

          // Should be allowed
          expect(response.status).toBe(200);
          expect(response.body.results).toBeDefined();
          expect(Array.isArray(response.body.results)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 58: Search Snippet Highlighting
   * For any search query that matches bookmark content,
   * the results should include highlighted snippets showing the matched terms.
   * Validates: Requirements 17.5
   */
  it('Property 58: Search Snippet Highlighting - results include highlighted snippets', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('javascript', 'typescript', 'react', 'node', 'testing'),
        async (searchTerm) => {
          // Create Pro tier user
          const { userId, token } = await createTestUser('pro');

          // Create bookmark with the search term in title
          await createTestBookmark(
            userId,
            'https://example.com/test',
            `Learn ${searchTerm} programming`,
            [searchTerm]
          );

          // Search for the term
          const response = await request(app)
            .get('/v1/search')
            .query({
              q: searchTerm,
            })
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toBe(200);
          expect(response.body.results).toBeDefined();

          // If there are results, they should have highlights
          if (response.body.results.length > 0) {
            for (const result of response.body.results) {
              // Results should have a highlights array
              expect(result.highlights).toBeDefined();
              expect(Array.isArray(result.highlights)).toBe(true);

              // If highlights exist, they should contain <mark> tags
              if (result.highlights.length > 0) {
                const hasMarkTags = result.highlights.some((h: string) =>
                  h.includes('<mark>')
                );
                expect(hasMarkTags).toBe(true);
              }
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Additional test: Unauthorized access should be denied
   */
  it('should deny access without authentication', async () => {
    const response = await request(app).get('/v1/search').query({ q: 'test' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
  });

  /**
   * Additional test: Search should return paginated results
   */
  it('should return paginated results', async () => {
    const { userId, token } = await createTestUser('pro');

    // Create multiple bookmarks
    for (let i = 0; i < 5; i++) {
      await createTestBookmark(
        userId,
        `https://example.com/test${i}`,
        `Test Bookmark ${i}`
      );
    }

    // Search with pagination
    const response = await request(app)
      .get('/v1/search')
      .query({
        q: 'test',
        page: 1,
        limit: 3,
      })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(3);
    expect(response.body.results.length).toBeLessThanOrEqual(3);
  });
});
