import { Router, Request, Response } from 'express';
import { BookmarkService } from '../services/bookmark.service.js';
import { z } from 'zod';

// Validation schemas
const createBookmarkSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500).optional(),
  excerpt: z.string().optional(),
  collectionId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['article', 'video', 'image', 'file', 'document']).optional(),
  coverUrl: z.string().url().optional(),
});

const updateBookmarkSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  excerpt: z.string().optional(),
  collectionId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  coverUrl: z.string().url().optional(),
  customOrder: z.number().int().min(0).optional(),
});

const listBookmarksSchema = z.object({
  collectionId: z.string().uuid().optional(),
  tags: z.string().optional(), // Comma-separated tags
  type: z.string().optional(), // Comma-separated types
  domain: z.string().optional(), // Comma-separated domains
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  isDuplicate: z.enum(['true', 'false']).optional(),
  isBroken: z.enum(['true', 'false']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const bulkActionSchema = z.object({
  bookmarkIds: z.array(z.string().uuid()).min(1),
  action: z.enum(['add_tags', 'remove_tags', 'move', 'delete']),
  params: z
    .object({
      tags: z.array(z.string()).optional(),
      collectionId: z.string().uuid().nullable().optional(),
    })
    .optional(),
});

const updateCustomOrderSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        order: z.number().int().min(0),
      })
    )
    .min(1),
});

/**
 * Create bookmark management routes
 */
export function createBookmarkRoutes(bookmarkService: BookmarkService): Router {
  const router = Router();

  /**
   * GET /bookmarks
   * List bookmarks with filtering and pagination
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Validate query parameters
      const queryParams = listBookmarksSchema.parse(req.query);

      // Parse filters
      const filters: any = {};

      if (queryParams.collectionId) {
        filters.collectionId = queryParams.collectionId;
      }

      if (queryParams.tags) {
        filters.tags = queryParams.tags
          .split(',')
          .map((t) => t.trim().toLowerCase());
      }

      if (queryParams.type) {
        filters.type = queryParams.type.split(',').map((t) => t.trim());
      }

      if (queryParams.domain) {
        filters.domain = queryParams.domain.split(',').map((d) => d.trim());
      }

      if (queryParams.dateFrom) {
        filters.dateFrom = new Date(queryParams.dateFrom);
      }

      if (queryParams.dateTo) {
        filters.dateTo = new Date(queryParams.dateTo);
      }

      if (queryParams.isDuplicate) {
        filters.isDuplicate = queryParams.isDuplicate === 'true';
      }

      if (queryParams.isBroken) {
        filters.isBroken = queryParams.isBroken === 'true';
      }

      // Parse pagination
      const pagination: any = {};

      if (queryParams.page) {
        pagination.page = parseInt(queryParams.page, 10);
      }

      if (queryParams.limit) {
        pagination.limit = parseInt(queryParams.limit, 10);
      }

      if (queryParams.sortBy) {
        pagination.sortBy = queryParams.sortBy;
      }

      if (queryParams.sortOrder) {
        pagination.sortOrder = queryParams.sortOrder;
      }

      // Get bookmarks
      const result = await bookmarkService.getUserBookmarks(
        req.user.userId,
        filters,
        pagination
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else if (error instanceof Error) {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  /**
   * POST /bookmarks
   * Create a new bookmark
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Validate request body
      const data = createBookmarkSchema.parse(req.body);

      // Create bookmark
      const bookmark = await bookmarkService.createBookmark(
        req.user.userId,
        data
      );

      res.status(201).json({
        id: bookmark.id,
        status: 'processing',
        bookmark,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else if (error instanceof Error) {
        res.status(400).json({
          error: {
            code: 'CREATE_FAILED',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  /**
   * GET /bookmarks/:id/snapshot
   * Get archived snapshot content for a bookmark
   */
  router.get('/:id/snapshot', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const snapshot = await bookmarkService.getBookmarkSnapshot(
        req.params.id,
        req.user.userId
      );

      if (!snapshot) {
        res.status(404).json({
          error: {
            code: 'SNAPSHOT_NOT_FOUND',
            message: 'Snapshot not found or not yet available',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      res.status(200).json({
        content: snapshot,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'Bookmark not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 500;
        res.status(statusCode).json({
          error: {
            code:
              error.message === 'Access denied'
                ? 'ACCESS_DENIED'
                : 'INTERNAL_ERROR',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  /**
   * GET /bookmarks/:id
   * Get bookmark details with tags and highlights
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const bookmark = await bookmarkService.getBookmarkById(
        req.params.id,
        req.user.userId
      );

      if (!bookmark) {
        res.status(404).json({
          error: {
            code: 'BOOKMARK_NOT_FOUND',
            message: 'Bookmark not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      res.status(200).json({
        bookmark,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'Access denied' ? 403 : 500;
        res.status(statusCode).json({
          error: {
            code:
              error.message === 'Access denied'
                ? 'ACCESS_DENIED'
                : 'INTERNAL_ERROR',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  /**
   * PUT /bookmarks/:id
   * Update bookmark
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Validate request body
      const data = updateBookmarkSchema.parse(req.body);

      // Update bookmark
      const bookmark = await bookmarkService.updateBookmark(
        req.params.id,
        req.user.userId,
        data
      );

      res.status(200).json({
        bookmark,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else if (error instanceof Error) {
        const statusCode =
          error.message === 'Bookmark not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 400;
        res.status(statusCode).json({
          error: {
            code: 'UPDATE_FAILED',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  /**
   * DELETE /bookmarks/:id
   * Delete bookmark
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Delete bookmark
      await bookmarkService.deleteBookmark(req.params.id, req.user.userId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'Bookmark not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 400;
        res.status(statusCode).json({
          error: {
            code: 'DELETE_FAILED',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  /**
   * PUT /bookmarks/order
   * Update custom order for bookmarks
   */
  router.put('/order', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Validate request body
      const data = updateCustomOrderSchema.parse(req.body);

      // Update custom order
      await bookmarkService.updateCustomOrder(req.user.userId, data.updates);

      res.status(200).json({
        success: true,
        message: 'Custom order updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else if (error instanceof Error) {
        const statusCode = error.message.includes('not found')
          ? 404
          : error.message.includes('Access denied')
            ? 403
            : 400;
        res.status(statusCode).json({
          error: {
            code: 'UPDATE_ORDER_FAILED',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  /**
   * POST /bookmarks/bulk
   * Perform bulk operations on bookmarks
   */
  router.post('/bulk', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Validate request body
      const data = bulkActionSchema.parse(req.body);

      // Check if this is a large batch (>100 items) - for now, process synchronously
      // In production, this should be handled asynchronously via job queue
      if (data.bookmarkIds.length > 100) {
        res.status(400).json({
          error: {
            code: 'BATCH_TOO_LARGE',
            message:
              'Batch size exceeds 100 items. Please use smaller batches.',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      let result: {
        processedCount: number;
        failedCount: number;
        errors: Array<{ bookmarkId: string; error: string }>;
      };

      // Execute the appropriate bulk action
      switch (data.action) {
        case 'add_tags':
          if (!data.params?.tags || data.params.tags.length === 0) {
            res.status(400).json({
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Tags are required for add_tags action',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || 'unknown',
              },
            });
            return;
          }
          result = await bookmarkService.bulkAddTags(
            req.user.userId,
            data.bookmarkIds,
            data.params.tags
          );
          break;

        case 'remove_tags':
          if (!data.params?.tags || data.params.tags.length === 0) {
            res.status(400).json({
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Tags are required for remove_tags action',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || 'unknown',
              },
            });
            return;
          }
          result = await bookmarkService.bulkRemoveTags(
            req.user.userId,
            data.bookmarkIds,
            data.params.tags
          );
          break;

        case 'move':
          if (data.params?.collectionId === undefined) {
            res.status(400).json({
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Collection ID is required for move action',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || 'unknown',
              },
            });
            return;
          }
          result = await bookmarkService.bulkMoveToCollection(
            req.user.userId,
            data.bookmarkIds,
            data.params.collectionId
          );
          break;

        case 'delete':
          result = await bookmarkService.bulkDeleteBookmarks(
            req.user.userId,
            data.bookmarkIds
          );
          break;

        default:
          res.status(400).json({
            error: {
              code: 'INVALID_ACTION',
              message: 'Invalid bulk action',
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || 'unknown',
            },
          });
          return;
      }

      res.status(200).json({
        success: result.failedCount === 0,
        processedCount: result.processedCount,
        failedCount: result.failedCount,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else if (error instanceof Error) {
        res.status(400).json({
          error: {
            code: 'BULK_ACTION_FAILED',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  return router;
}
