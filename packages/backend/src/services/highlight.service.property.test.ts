import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { HighlightService } from './highlight.service.js';
import { HighlightRepository } from '../repositories/highlight.repository.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { SearchService } from './search.service.js';
import pool from '../db/config.js';
import { runMigrations } from '../db/migrate.js';
import { CreateHighlightRequest } from '@bookmark-manager/shared';

describe('HighlightService Property-Based Tests', () => {
  let highlightService: HighlightService;
  let highlightRepository: HighlightRepository;
  let bookmarkRepository: BookmarkRepository;
  let userRepository: UserRepository;
  let searchService: SearchService;
  let testUserId: string;
  let testBookmarkId: string;

  beforeAll(async () => {
    // Run migrations to ensure schema is up to date
    await runMigrations();

    highlightRepository = new HighlightRepository(pool);
    bookmarkRepository = new BookmarkRepository(pool);
    userRepository = new UserRepository(pool);
    searchService = new SearchService();
    highlightService = new HighlightService(
      highlightRepository,
      bookmarkRepository,
      searchService
    );

    // Create a test user with Pro plan
    const testUser = await userRepository.createWithPassword(
      `test-highlight-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
      'test-password',
      'Test User'
    );
    testUserId = testUser.id;

    // Update user to Pro plan
    await pool.query('UPDATE users SET plan = $1 WHERE id = $2', [
      'pro',
      testUserId,
    ]);

    // Create a test bookmark
    const bookmark = await bookmarkRepository.create({
      ownerId: testUserId,
      url: 'https://example.com/test-article',
      title: 'Test Article',
      type: 'article',
      domain: 'example.com',
      isDuplicate: false,
      isBroken: false,
      contentIndexed: false,
    });
    testBookmarkId = bookmark.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testBookmarkId) {
      await pool.query('DELETE FROM bookmarks WHERE id = $1', [testBookmarkId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up highlights before each test
    await pool.query('DELETE FROM highlights WHERE owner_id = $1', [
      testUserId,
    ]);
  });

  /**
   * Feature: bookmark-manager-platform, Property 31: Highlight Storage Completeness
   *
   * For any highlight created by a Pro user, the system should store the selected text,
   * color, annotation, position context, and snapshot reference.
   *
   * Validates: Requirements 10.1
   */
  it('Property 31: Highlight Storage Completeness - all fields are persisted correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random highlight data
        fc
          .string({ minLength: 1, maxLength: 500 })
          .filter((s) => s.trim().length > 0), // textSelected
        fc.hexaString({ minLength: 6, maxLength: 6 }).map((s) => `#${s}`), // color
        fc.option(fc.string({ minLength: 1, maxLength: 1000 }), {
          nil: undefined,
        }), // annotationMd
        fc.string({ minLength: 1, maxLength: 100 }), // before context
        fc.string({ minLength: 1, maxLength: 100 }), // after context
        fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
          nil: undefined,
        }), // xpath
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
          nil: undefined,
        }), // snapshotId
        async (
          textSelected,
          color,
          annotationMd,
          before,
          after,
          xpath,
          snapshotId
        ) => {
          // Ensure test data is set
          if (!testUserId || !testBookmarkId) {
            throw new Error('Test data is not set');
          }

          // Create highlight
          const highlightData: CreateHighlightRequest = {
            bookmarkId: testBookmarkId,
            textSelected,
            color,
            annotationMd,
            positionContext: {
              before,
              after,
              xpath,
            },
            snapshotId,
          };

          const highlight = await highlightService.createHighlight(
            testUserId,
            highlightData
          );

          // Verify all fields are stored correctly
          expect(highlight.bookmarkId).toBe(testBookmarkId);
          expect(highlight.ownerId).toBe(testUserId);
          expect(highlight.textSelected).toBe(textSelected);
          expect(highlight.color).toBe(color);
          // Database stores undefined as null, so we need to normalize
          expect(highlight.annotationMd ?? undefined).toBe(annotationMd);
          expect(highlight.positionContext.before).toBe(before);
          expect(highlight.positionContext.after).toBe(after);
          expect(highlight.positionContext.xpath ?? undefined).toBe(xpath);
          expect(highlight.snapshotId ?? undefined).toBe(snapshotId);
          expect(highlight.createdAt).toBeInstanceOf(Date);
          expect(highlight.updatedAt).toBeInstanceOf(Date);

          // Retrieve and verify persistence
          const retrieved = await highlightService.getHighlightById(
            highlight.id,
            testUserId
          );
          expect(retrieved).not.toBeNull();
          expect(retrieved!.textSelected).toBe(textSelected);
          expect(retrieved!.color).toBe(color);
          // Database stores undefined as null, so we need to normalize
          expect(retrieved!.annotationMd ?? undefined).toBe(annotationMd);
          expect(retrieved!.positionContext.before).toBe(before);
          expect(retrieved!.positionContext.after).toBe(after);
          expect(retrieved!.positionContext.xpath ?? undefined).toBe(xpath);
          expect(retrieved!.snapshotId ?? undefined).toBe(snapshotId);

          // Clean up
          await highlightRepository.delete(highlight.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 32: Highlight Color Update
   *
   * For any existing highlight, changing the highlight color should update the
   * highlight record immediately and persist the new color.
   *
   * Validates: Requirements 10.3
   */
  it('Property 32: Highlight Color Update - color changes are persisted immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate initial and new colors
        fc.hexaString({ minLength: 6, maxLength: 6 }).map((s) => `#${s}`),
        fc.hexaString({ minLength: 6, maxLength: 6 }).map((s) => `#${s}`),
        fc
          .string({ minLength: 1, maxLength: 500 })
          .filter((s) => s.trim().length > 0),
        async (initialColor, newColor, textSelected) => {
          // Ensure test data is set
          if (!testUserId || !testBookmarkId) {
            throw new Error('Test data is not set');
          }

          // Create highlight with initial color
          const highlight = await highlightService.createHighlight(testUserId, {
            bookmarkId: testBookmarkId,
            textSelected,
            color: initialColor,
            positionContext: {
              before: 'context before',
              after: 'context after',
            },
          });

          // Verify initial color
          expect(highlight.color).toBe(initialColor);

          // Update color
          const updated = await highlightService.updateHighlight(
            highlight.id,
            testUserId,
            { color: newColor }
          );

          // Verify color is updated immediately
          expect(updated.color).toBe(newColor);
          expect(updated.updatedAt.getTime()).toBeGreaterThan(
            highlight.createdAt.getTime()
          );

          // Retrieve and verify persistence
          const retrieved = await highlightService.getHighlightById(
            highlight.id,
            testUserId
          );
          expect(retrieved).not.toBeNull();
          expect(retrieved!.color).toBe(newColor);

          // Clean up
          await highlightRepository.delete(highlight.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 16: Highlight Creation with Context
   *
   * For any text selection from a saved page, creating a highlight should store
   * the selected text along with surrounding context (before/after text and position information).
   *
   * Validates: Requirements 6.4
   */
  it('Property 16: Highlight Creation with Context - context is stored with selection', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate text selection and context
        fc
          .string({ minLength: 1, maxLength: 500 })
          .filter((s) => s.trim().length > 0), // textSelected
        fc.string({ minLength: 1, maxLength: 200 }), // before context
        fc.string({ minLength: 1, maxLength: 200 }), // after context
        fc.option(fc.string({ minLength: 1, maxLength: 300 }), {
          nil: undefined,
        }), // xpath
        async (textSelected, before, after, xpath) => {
          // Ensure test data is set
          if (!testUserId || !testBookmarkId) {
            throw new Error('Test data is not set');
          }

          // Create highlight with context
          const highlight = await highlightService.createHighlight(testUserId, {
            bookmarkId: testBookmarkId,
            textSelected,
            positionContext: {
              before,
              after,
              xpath,
            },
          });

          // Verify selected text is stored
          expect(highlight.textSelected).toBe(textSelected);

          // Verify surrounding context is stored
          expect(highlight.positionContext).toBeDefined();
          expect(highlight.positionContext.before).toBe(before);
          expect(highlight.positionContext.after).toBe(after);
          expect(highlight.positionContext.xpath).toBe(xpath);

          // Retrieve and verify all context is persisted
          const retrieved = await highlightService.getHighlightById(
            highlight.id,
            testUserId
          );
          expect(retrieved).not.toBeNull();
          expect(retrieved!.textSelected).toBe(textSelected);
          expect(retrieved!.positionContext.before).toBe(before);
          expect(retrieved!.positionContext.after).toBe(after);
          expect(retrieved!.positionContext.xpath).toBe(xpath);

          // Clean up
          await highlightRepository.delete(highlight.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: bookmark-manager-platform, Property 33: Highlight Search Integration
   *
   * For any Pro user search query, the search results should include bookmarks
   * where the query terms appear in highlight text or annotations.
   *
   * Validates: Requirements 10.4
   */
  it('Property 33: Highlight Search Integration - search includes highlight text', async () => {
    // First, ensure the test bookmark is indexed in search
    const bookmark =
      await bookmarkRepository.findByIdWithRelations(testBookmarkId);
    if (bookmark) {
      await searchService.indexBookmark({
        id: bookmark.id,
        owner_id: bookmark.ownerId,
        collection_id: bookmark.collectionId || null,
        title: bookmark.title,
        url: bookmark.url,
        domain: bookmark.domain,
        excerpt: bookmark.excerpt || null,
        content: null,
        tags: bookmark.tags.map((tag) => tag.name),
        type: bookmark.type,
        created_at: Math.floor(bookmark.createdAt.getTime() / 1000),
        updated_at: Math.floor(bookmark.updatedAt.getTime() / 1000),
        has_snapshot: !!bookmark.contentSnapshotPath,
        highlights_text: null,
      });
      // Wait for initial indexing
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await fc.assert(
      fc.asyncProperty(
        // Generate unique search terms that won't appear in title/excerpt
        fc
          .string({ minLength: 8, maxLength: 20 })
          .filter((s) => /^[a-z]{8,20}$/.test(s)),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.option(fc.string({ minLength: 1, maxLength: 500 }), {
          nil: undefined,
        }),
        async (uniqueTerm, contextText, annotationText) => {
          // Ensure test data is set
          if (!testUserId || !testBookmarkId) {
            throw new Error('Test data is not set');
          }

          // Create a highlight with the unique term in the selected text
          const textSelected = `This is a test with ${uniqueTerm} in it`;
          const annotation = annotationText
            ? `${annotationText} ${uniqueTerm}`
            : undefined;

          const highlight = await highlightService.createHighlight(testUserId, {
            bookmarkId: testBookmarkId,
            textSelected,
            annotationMd: annotation,
            positionContext: {
              before: contextText,
              after: contextText,
            },
          });

          // Wait for search index to update (MeiliSearch is eventually consistent)
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Search for the unique term
          const searchResults = await searchService.search(
            { q: uniqueTerm },
            testUserId,
            true // Pro user
          );

          // Verify the bookmark appears in search results
          const foundBookmark = searchResults.results.find(
            (r) => r.id === testBookmarkId
          );
          expect(foundBookmark).toBeDefined();
          expect(foundBookmark?.id).toBe(testBookmarkId);

          // Clean up
          await highlightRepository.delete(highlight.id);

          // Re-index to remove highlight text
          await searchService.updateBookmark({
            id: testBookmarkId,
            highlights_text: null,
          });

          // Wait for search index to update after deletion
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      ),
      { numRuns: 10 } // Reduced runs due to search index delays
    );
  });
});
