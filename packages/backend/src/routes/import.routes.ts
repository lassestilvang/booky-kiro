import { Router, Request, Response } from 'express';
import { ImportService } from '../services/import.service.js';
import { z } from 'zod';

// Validation schemas
const importHtmlSchema = z.object({
  html: z.string().min(1),
});

const importJsonSchema = z.object({
  data: z.object({
    bookmarks: z.array(z.any()),
    collections: z.array(z.any()),
    tags: z.array(z.any()),
  }),
});

/**
 * Create import routes
 */
export function createImportRoutes(importService: ImportService): Router {
  const router = Router();

  /**
   * POST /import/html
   * Import bookmarks from HTML file
   */
  router.post('/html', async (req: Request, res: Response) => {
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
      const data = importHtmlSchema.parse(req.body);

      // Import bookmarks
      const result = await importService.importFromHtml(
        req.user.userId,
        data.html
      );

      const statusCode = result.success ? 200 : 207; // 207 Multi-Status for partial success

      res.status(statusCode).json(result);
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
            code: 'IMPORT_FAILED',
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
   * POST /import/json
   * Import bookmarks from JSON data
   */
  router.post('/json', async (req: Request, res: Response) => {
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
      const requestData = importJsonSchema.parse(req.body);

      // Import bookmarks
      const result = await importService.importFromJson(
        req.user.userId,
        requestData.data
      );

      const statusCode = result.success ? 200 : 207; // 207 Multi-Status for partial success

      res.status(statusCode).json(result);
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
            code: 'IMPORT_FAILED',
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
