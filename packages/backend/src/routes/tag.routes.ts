import { Router, Request, Response } from 'express';
import { TagService } from '../services/tag.service.js';
import { z } from 'zod';

// Validation schemas
const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const mergeTagsSchema = z.object({
  sourceTagIds: z.array(z.string().uuid()).min(1),
  targetTagId: z.string().uuid(),
});

/**
 * Create tag management routes
 */
export function createTagRoutes(tagService: TagService): Router {
  const router = Router();

  /**
   * GET /tags
   * List all tags for the authenticated user
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

      const tags = await tagService.getUserTags(req.user.userId);

      res.status(200).json({
        tags,
        total: tags.length,
      });
    } catch (error) {
      if (error instanceof Error) {
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
   * POST /tags
   * Create a new tag
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
      const data = createTagSchema.parse(req.body);

      // Create tag
      const tag = await tagService.createTag(req.user.userId, data);

      res.status(201).json({
        tag,
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
        const statusCode = error.message === 'Tag with this name already exists' ? 409 : 400;
        res.status(statusCode).json({
          error: {
            code: error.message === 'Tag with this name already exists' ? 'TAG_EXISTS' : 'CREATE_FAILED',
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
   * GET /tags/:id
   * Get tag details
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

      const tag = await tagService.getTagById(req.params.id, req.user.userId);

      if (!tag) {
        res.status(404).json({
          error: {
            code: 'TAG_NOT_FOUND',
            message: 'Tag not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      res.status(200).json({
        tag,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'Access denied' ? 403 : 500;
        res.status(statusCode).json({
          error: {
            code: error.message === 'Access denied' ? 'ACCESS_DENIED' : 'INTERNAL_ERROR',
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
   * PUT /tags/:id
   * Update tag
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
      const data = updateTagSchema.parse(req.body);

      // Update tag
      const tag = await tagService.updateTag(req.params.id, req.user.userId, data);

      res.status(200).json({
        tag,
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
          error.message === 'Tag not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : error.message === 'Tag with this name already exists'
                ? 409
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
   * DELETE /tags/:id
   * Delete tag
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

      // Delete tag
      await tagService.deleteTag(req.params.id, req.user.userId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'Tag not found'
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
   * POST /tags/merge
   * Merge multiple tags into a target tag
   */
  router.post('/merge', async (req: Request, res: Response) => {
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
      const data = mergeTagsSchema.parse(req.body);

      // Merge tags
      await tagService.mergeTags(req.user.userId, data);

      res.status(200).json({
        success: true,
        message: 'Tags merged successfully',
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
          error.message.includes('not found')
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 400;
        res.status(statusCode).json({
          error: {
            code: 'MERGE_FAILED',
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
