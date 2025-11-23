import { Router, Request, Response } from 'express';
import { HighlightService } from '../services/highlight.service.js';
import { createAuthMiddleware, requireProPlan } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';
import {
  CreateHighlightRequest,
  UpdateHighlightRequest,
} from '@bookmark-manager/shared';

/**
 * Create highlight routes
 */
export function createHighlightRoutes(
  highlightService: HighlightService,
  authService: AuthService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  // All highlight endpoints require authentication and Pro plan
  router.use(authMiddleware);
  router.use(requireProPlan);

  /**
   * GET /v1/highlights - List all highlights for the authenticated user
   */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await highlightService.getUserHighlights(userId, page, limit);

      res.json(result);
    } catch (error) {
      console.error('Error listing highlights:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list highlights',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * GET /v1/highlights/:id - Get a specific highlight
   */
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const highlightId = req.params.id;

      const highlight = await highlightService.getHighlightById(highlightId, userId);

      if (!highlight) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Highlight not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      res.json(highlight);
    } catch (error: any) {
      if (error.message === 'Access denied') {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to access this highlight',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      console.error('Error getting highlight:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get highlight',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * POST /v1/highlights - Create a new highlight
   */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const data: CreateHighlightRequest = req.body;

      // Validate required fields
      if (!data.bookmarkId || !data.textSelected || !data.positionContext) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: bookmarkId, textSelected, positionContext',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const highlight = await highlightService.createHighlight(userId, data);

      res.status(201).json(highlight);
    } catch (error: any) {
      if (error.message === 'Bookmark not found') {
        res.status(404).json({
          error: {
            code: 'BOOKMARK_NOT_FOUND',
            message: 'The specified bookmark does not exist',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (error.message === 'Access denied') {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to create highlights for this bookmark',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      console.error('Error creating highlight:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create highlight',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * PUT /v1/highlights/:id - Update a highlight
   */
  router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const highlightId = req.params.id;
      const data: UpdateHighlightRequest = req.body;

      const highlight = await highlightService.updateHighlight(highlightId, userId, data);

      res.json(highlight);
    } catch (error: any) {
      if (error.message === 'Highlight not found') {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Highlight not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (error.message === 'Access denied') {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to update this highlight',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      console.error('Error updating highlight:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update highlight',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * DELETE /v1/highlights/:id - Delete a highlight
   */
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const highlightId = req.params.id;

      await highlightService.deleteHighlight(highlightId, userId);

      res.status(204).send();
    } catch (error: any) {
      if (error.message === 'Highlight not found') {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Highlight not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (error.message === 'Access denied') {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to delete this highlight',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      console.error('Error deleting highlight:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete highlight',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  return router;
}
