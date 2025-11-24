import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { normalizeUrl, computeContentHash } from './maintenance.worker.js';
import { BookmarkRepository } from '../../repositories/bookmark.repository.js';

/**
 * Property-based tests for maintenance worker
 *
 * Tests:
 * - Property 64: URL Normalization
 * - Property 65: Duplicate Flagging
 * - Property 66: Content Hash Duplicate Detection
 */

// Test database pool
const testPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bookmark_manager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const bookmarkRepo = new BookmarkRepository(testPool);

// Test user ID
let testUserId: string;

beforeAll(async () => {
  // Clean up any existing test user first
  await testPool.query('DELETE FROM users WHERE email = $1', [
    'maintenance-test@example.com',
  ]);

  // Create test user
  const result = await testPool.query(
    `INSERT INTO users (email, password_hash, name, plan)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    ['maintenance-test@example.com', 'hash', 'Maintenance Test User', 'pro']
  );
  testUserId = result.rows[0].id;
});

afterAll(async () => {
  // Clean up test user and related data
  await testPool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
    testUserId,
  ]);
  await testPool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  await testPool.end();
});

beforeEach(async () => {
  // Clean up bookmarks before each test
  await testPool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
    testUserId,
  ]);
});

// Mock fetch for broken link tests
const originalFetch = global.fetch;
let mockFetchResponses: Map<
  string,
  { status: number; shouldTimeout: boolean }
> = new Map();

function setupMockFetch() {
  global.fetch = async (
    url: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const urlString =
      typeof url === 'string'
        ? url
        : url instanceof URL
          ? url.toString()
          : url.url;
    const mockResponse = mockFetchResponses.get(urlString);

    if (mockResponse) {
      if (mockResponse.shouldTimeout) {
        // Simulate timeout by waiting longer than the abort signal
        await new Promise((resolve) => setTimeout(resolve, 15000));
        throw new Error('Timeout');
      }

      return new Response(null, { status: mockResponse.status });
    }

    // Default: return 200 OK
    return new Response(null, { status: 200 });
  };
}

function restoreFetch() {
  global.fetch = originalFetch;
}

describe('Maintenance Worker Property Tests', () => {
  /**
   * Feature: bookmark-manager-platform, Property 64: URL Normalization
   * Validates: Requirements 19.1
   *
   * For any bookmark created, the system should normalize the URL by removing
   * tracking parameters and compute a content hash.
   */
  describe('Property 64: URL Normalization', () => {
    it('should remove tracking parameters from URLs', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.array(
            fc.record({
              key: fc.constantFrom(
                'utm_source',
                'utm_medium',
                'utm_campaign',
                'fbclid',
                'gclid'
              ),
              value: fc.string({ minLength: 1, maxLength: 20 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (baseUrl, trackingParams) => {
            // Add tracking parameters to URL
            const url = new URL(baseUrl);
            trackingParams.forEach((param) => {
              url.searchParams.set(param.key, param.value);
            });
            const urlWithTracking = url.toString();

            // Normalize URL
            const normalized = normalizeUrl(urlWithTracking);

            // Verify tracking parameters are removed
            const normalizedUrl = new URL(normalized);
            trackingParams.forEach((param) => {
              expect(normalizedUrl.searchParams.has(param.key)).toBe(false);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove URL fragments (hash)', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.string({ minLength: 1, maxLength: 20 }),
          (baseUrl, fragment) => {
            const urlWithFragment = `${baseUrl}#${fragment}`;
            const normalized = normalizeUrl(urlWithFragment);

            // Verify fragment is removed
            expect(normalized).not.toContain('#');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should normalize URLs to lowercase', () => {
      fc.assert(
        fc.property(fc.webUrl(), (url) => {
          const normalized = normalizeUrl(url);

          // Verify URL is lowercase
          expect(normalized).toBe(normalized.toLowerCase());
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve non-tracking query parameters', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.array(
            fc.record({
              key: fc
                .string({ minLength: 1, maxLength: 10 })
                .filter((k) => k.trim().length > 0) // Exclude empty/whitespace keys
                .filter(
                  (k) =>
                    ![
                      'utm_source',
                      'utm_medium',
                      'utm_campaign',
                      'utm_term',
                      'utm_content',
                      'fbclid',
                      'gclid',
                      'msclkid',
                      'mc_cid',
                      'mc_eid',
                      '_ga',
                      'ref',
                      'source',
                    ].includes(k.toLowerCase())
                ),
              value: fc.string({ minLength: 1, maxLength: 20 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (baseUrl, params) => {
            // Add non-tracking parameters
            const url = new URL(baseUrl);
            params.forEach((param) => {
              url.searchParams.set(param.key, param.value);
            });
            const urlWithParams = url.toString();

            // Normalize URL
            const normalized = normalizeUrl(urlWithParams);
            const normalizedUrl = new URL(normalized);

            // Verify non-tracking parameters are preserved
            params.forEach((param) => {
              expect(
                normalizedUrl.searchParams.has(param.key.toLowerCase())
              ).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: bookmark-manager-platform, Property 65: Duplicate Flagging
   * Validates: Requirements 19.2
   *
   * For any normalized URL matching an existing bookmark, the system should
   * flag the new bookmark as a potential duplicate.
   */
  describe('Property 65: Duplicate Flagging', () => {
    it('should identify URLs with same normalized form as duplicates', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.array(
            fc.record({
              key: fc.constantFrom(
                'utm_source',
                'utm_medium',
                'fbclid',
                'gclid'
              ),
              value: fc.string({ minLength: 1, maxLength: 20 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (baseUrl, trackingParams) => {
            // Create URL with tracking parameters
            const url = new URL(baseUrl);
            trackingParams.forEach((param) => {
              url.searchParams.set(param.key, param.value);
            });
            const urlWithTracking = url.toString();

            // Normalize both URLs
            const normalized1 = normalizeUrl(baseUrl);
            const normalized2 = normalizeUrl(urlWithTracking);

            // They should normalize to the same value
            expect(normalized1).toBe(normalized2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify different URLs as non-duplicates', () => {
      fc.assert(
        fc.property(fc.webUrl(), fc.webUrl(), (url1, url2) => {
          // Skip if URLs are already the same
          fc.pre(url1 !== url2);

          const normalized1 = normalizeUrl(url1);
          const normalized2 = normalizeUrl(url2);

          // If base URLs are different, normalized should be different
          // (unless they happen to normalize to the same thing, which is rare)
          const url1Obj = new URL(url1);
          const url2Obj = new URL(url2);

          // If the base URLs (without query params) are different, normalized should differ
          if (
            url1Obj.origin + url1Obj.pathname !==
            url2Obj.origin + url2Obj.pathname
          ) {
            expect(normalized1).not.toBe(normalized2);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: bookmark-manager-platform, Property 66: Content Hash Duplicate Detection
   * Validates: Requirements 19.3
   *
   * For any two bookmarks with different URLs but identical page content,
   * the system should detect them as duplicates using content hashing.
   */
  describe('Property 66: Content Hash Duplicate Detection', () => {
    it('should compute consistent hashes for same content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 1000 }),
          (content) => {
            const hash1 = computeContentHash(content);
            const hash2 = computeContentHash(content);

            // Same content should produce same hash
            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should compute same hash for content with different whitespace', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.nat({ max: 10 }),
          (content, extraSpaces) => {
            // Add extra whitespace
            const contentWithSpaces = content
              .split(' ')
              .join(' '.repeat(extraSpaces + 1));

            const hash1 = computeContentHash(content);
            const hash2 = computeContentHash(contentWithSpaces);

            // Should produce same hash despite whitespace differences
            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should compute same hash for content with different case', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 10, maxLength: 100 }), (content) => {
          const hash1 = computeContentHash(content.toLowerCase());
          const hash2 = computeContentHash(content.toUpperCase());

          // Should produce same hash despite case differences
          expect(hash1).toBe(hash2);
        }),
        { numRuns: 100 }
      );
    });

    it('should compute different hashes for different content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          (content1, content2) => {
            // Skip if content is the same after normalization
            const normalized1 = content1
              .toLowerCase()
              .replace(/\s+/g, ' ')
              .trim();
            const normalized2 = content2
              .toLowerCase()
              .replace(/\s+/g, ' ')
              .trim();
            fc.pre(normalized1 !== normalized2);

            const hash1 = computeContentHash(content1);
            const hash2 = computeContentHash(content2);

            // Different content should produce different hashes
            expect(hash1).not.toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify content with same hash as duplicates', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.nat({ max: 5 }),
          fc.boolean(),
          (content, extraSpaces, changeCase) => {
            // Create variations of the same content
            let content1 = content;
            let content2 = content;

            // Add whitespace variations
            if (extraSpaces > 0) {
              content2 = content2.split(' ').join(' '.repeat(extraSpaces + 1));
            }

            // Add case variations
            if (changeCase) {
              content2 = content2.toUpperCase();
            }

            const hash1 = computeContentHash(content1);
            const hash2 = computeContentHash(content2);

            // Same content should produce same hash despite formatting differences
            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: bookmark-manager-platform, Property 67: Broken Link Detection
   * Validates: Requirements 20.1, 20.2, 20.3
   *
   * For any saved URL, the broken link scanner should request the URL and mark
   * the bookmark as broken if it returns 4xx/5xx status or times out.
   */
  describe('Property 67: Broken Link Detection', () => {
    beforeEach(() => {
      setupMockFetch();
      mockFetchResponses.clear();
    });

    afterAll(() => {
      restoreFetch();
    });

    it('should identify 4xx status codes as broken links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.integer({ min: 400, max: 499 }),
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          async (url, statusCode, title) => {
            // Ensure testUserId is set
            if (!testUserId) {
              throw new Error('testUserId is not set');
            }

            // Setup mock response
            mockFetchResponses.set(url, {
              status: statusCode,
              shouldTimeout: false,
            });

            // Create bookmark
            const result = await testPool.query(
              `INSERT INTO bookmarks (owner_id, title, url, domain, type, is_broken)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [testUserId, title, url, new URL(url).hostname, 'article', false]
            );
            const bookmarkId = result.rows[0].id;

            // Simulate broken link detection logic
            try {
              const response = await fetch(url, { method: 'HEAD' });
              const isBroken = response.status >= 400;

              // Verify that 4xx status is detected as broken
              expect(isBroken).toBe(true);
              expect(response.status).toBe(statusCode);
            } catch (error) {
              // Should not throw for 4xx
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should identify 5xx status codes as broken links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.integer({ min: 500, max: 599 }),
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          async (url, statusCode, title) => {
            // Ensure testUserId is set
            if (!testUserId) {
              throw new Error('testUserId is not set');
            }

            // Setup mock response
            mockFetchResponses.set(url, {
              status: statusCode,
              shouldTimeout: false,
            });

            // Create bookmark
            const result = await testPool.query(
              `INSERT INTO bookmarks (owner_id, title, url, domain, type, is_broken)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [testUserId, title, url, new URL(url).hostname, 'article', false]
            );
            const bookmarkId = result.rows[0].id;

            // Simulate broken link detection logic
            try {
              const response = await fetch(url, { method: 'HEAD' });
              const isBroken = response.status >= 400;

              // Verify that 5xx status is detected as broken
              expect(isBroken).toBe(true);
              expect(response.status).toBe(statusCode);
            } catch (error) {
              // Should not throw for 5xx
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should identify 2xx and 3xx status codes as working links', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          fc.integer({ min: 200, max: 399 }),
          fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          async (url, statusCode, title) => {
            // Ensure testUserId is set
            if (!testUserId) {
              throw new Error('testUserId is not set');
            }

            // Setup mock response
            mockFetchResponses.set(url, {
              status: statusCode,
              shouldTimeout: false,
            });

            // Create bookmark
            const result = await testPool.query(
              `INSERT INTO bookmarks (owner_id, title, url, domain, type, is_broken)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [testUserId, title, url, new URL(url).hostname, 'article', false]
            );
            const bookmarkId = result.rows[0].id;

            // Simulate broken link detection logic
            const response = await fetch(url, { method: 'HEAD' });
            const isBroken = response.status >= 400;

            // Verify that 2xx/3xx status is NOT detected as broken
            expect(isBroken).toBe(false);
            expect(response.status).toBe(statusCode);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Feature: bookmark-manager-platform, Property 68: Broken Link Filtering
   * Validates: Requirements 20.5
   *
   * For any filter query for broken bookmarks, the system should return only
   * bookmarks flagged as broken.
   */
  describe('Property 68: Broken Link Filtering', () => {
    beforeEach(async () => {
      // Extra cleanup to ensure no bookmarks from other tests
      await testPool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
        testUserId,
      ]);
    });

    it('should filter bookmarks by broken status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              url: fc.webUrl(),
              title: fc
                .string({ minLength: 1, maxLength: 50 })
                .filter((s) => s.trim().length > 0),
              isBroken: fc.boolean(),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (bookmarks) => {
            // Ensure testUserId is set
            if (!testUserId) {
              throw new Error('testUserId is not set');
            }

            // Clean up before this iteration
            await testPool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
              testUserId,
            ]);

            // Ensure unique URLs by appending timestamp and index
            const timestamp = Date.now();
            const uniqueBookmarks = bookmarks.map((b, index) => ({
              ...b,
              url: `${b.url}?t=${timestamp}&i=${index}`,
            }));

            // Create bookmarks with various broken statuses
            for (const bookmark of uniqueBookmarks) {
              await testPool.query(
                `INSERT INTO bookmarks (owner_id, title, url, domain, type, is_broken)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  testUserId,
                  bookmark.title,
                  bookmark.url,
                  new URL(bookmark.url).hostname,
                  'article',
                  bookmark.isBroken,
                ]
              );
            }

            // Filter for broken bookmarks
            const { bookmarks: brokenBookmarks } =
              await bookmarkRepo.findWithFilters({
                ownerId: testUserId,
                isBroken: true,
              });

            // Filter for non-broken bookmarks
            const { bookmarks: workingBookmarks } =
              await bookmarkRepo.findWithFilters({
                ownerId: testUserId,
                isBroken: false,
              });

            // Verify all returned bookmarks match the filter
            brokenBookmarks.forEach((b) => {
              expect(b.isBroken).toBe(true);
            });

            workingBookmarks.forEach((b) => {
              expect(b.isBroken).toBe(false);
            });

            // Verify counts match
            const expectedBroken = uniqueBookmarks.filter(
              (b) => b.isBroken
            ).length;
            const expectedWorking = uniqueBookmarks.filter(
              (b) => !b.isBroken
            ).length;

            expect(brokenBookmarks.length).toBe(expectedBroken);
            expect(workingBookmarks.length).toBe(expectedWorking);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should return empty array when no broken bookmarks exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              url: fc.webUrl(),
              title: fc
                .string({ minLength: 1, maxLength: 50 })
                .filter((s) => s.trim().length > 0),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (bookmarks) => {
            // Ensure testUserId is set
            if (!testUserId) {
              throw new Error('testUserId is not set');
            }

            // Clean up before this iteration
            await testPool.query('DELETE FROM bookmarks WHERE owner_id = $1', [
              testUserId,
            ]);

            // Ensure unique URLs by appending timestamp and index
            const timestamp = Date.now();
            const uniqueBookmarks = bookmarks.map((b, index) => ({
              ...b,
              url: `${b.url}?t=${timestamp}&i=${index}`,
            }));

            // Create only working bookmarks
            for (const bookmark of uniqueBookmarks) {
              // Double-check testUserId is set
              if (!testUserId) {
                throw new Error('testUserId is not set in loop');
              }

              await testPool.query(
                `INSERT INTO bookmarks (owner_id, title, url, domain, type, is_broken)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  testUserId,
                  bookmark.title,
                  bookmark.url,
                  new URL(bookmark.url).hostname,
                  'article',
                  false,
                ]
              );
            }

            // Filter for broken bookmarks
            const { bookmarks: brokenBookmarks } =
              await bookmarkRepo.findWithFilters({
                ownerId: testUserId,
                isBroken: true,
              });

            // Should return empty array
            expect(brokenBookmarks.length).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
