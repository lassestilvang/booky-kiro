import { Router, Request, Response } from 'express';
import { ExportService } from '../services/export.service.js';
import { z } from 'zod';
import { BookmarkFilters } from '../repositories/bookmark.repository.js';

// Validation schemas
const exportQuerySchema = z.object({
  format: z.enum(['html', 'csv', 'txt', 'json']).default('html'),
  tags: z.string().optional(),
  type: z.string().optional(),
  domain: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

/**
 * Create export routes
 */
export function createExportRoutes(exportService: ExportService): Router {
  const router = Router();

  /**
   * GET /export/:collectionId
   * Export a specific collection
   */
  router.get('/:collectionId', async (req: Request, res: Response) => {
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
      const query = exportQuerySchema.parse(req.query);

      // Export collection
      const content = await exportService.exportBookmarks(
        req.user.userId,
        query.format,
        req.params.collectionId
      );

      // Set appropriate content type and filename
      const contentType = this.getContentType(query.format);
      const filename = `collection-${req.params.collectionId}.${query.format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.status(200).send(content);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else if (error instanceof Error) {
        const statusCode =
          error.message === 'Collection not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 500;
        res.status(statusCode).json({
          error: {
            code: 'EXPORT_FAILED',
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
   * GET /export
   * Export bookmarks with optional filters
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
      const query = exportQuerySchema.parse(req.query);

      // Build filters
      const filters: Partial<BookmarkFilters> = {};
      if (query.tags) {
        filters.tags = query.tags.split(',').map((t) => t.trim());
      }
      if (query.type) {
        filters.type = query.type as any;
      }
      if (query.domain) {
        filters.domain = query.domain;
      }
      if (query.dateFrom) {
        filters.dateFrom = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        filters.dateTo = new Date(query.dateTo);
      }

      // Export bookmarks
      const content = await exportService.exportBookmarks(
        req.user.userId,
        query.format,
        undefined,
        filters
      );

      // Set appropriate content type and filename
      const contentType = this.getContentType(query.format);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `bookmarks-${timestamp}.${query.format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.status(200).send(content);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else if (error instanceof Error) {
        res.status(500).json({
          error: {
            code: 'EXPORT_FAILED',
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

/**
 * Get content type for export format
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getContentType(format: string): string {
  switch (format) {
    case 'html':
      return 'text/html; charset=utf-8';
    case 'csv':
      return 'text/csv; charset=utf-8';
    case 'txt':
      return 'text/plain; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}
