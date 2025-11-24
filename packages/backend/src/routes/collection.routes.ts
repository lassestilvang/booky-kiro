import { Router, Request, Response } from 'express';
import { CollectionService } from '../services/collection.service.js';
import { z } from 'zod';

// Validation schemas
const createCollectionSchema = z.object({
  title: z.string().min(1).max(255),
  icon: z.string().max(100).optional(),
  parentId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
});

const updateCollectionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  icon: z.string().max(100).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const shareCollectionSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'editor', 'viewer']),
});

// Unused for now - keeping for future use
// const deleteCollectionSchema = z.object({
//   moveToDefault: z.boolean().optional().default(true),
// });

/**
 * Create collection management routes
 */
export function createCollectionRoutes(
  collectionService: CollectionService
): Router {
  const router = Router();

  /**
   * GET /collections
   * List all collections for the authenticated user
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

      const collections = await collectionService.getUserCollections(
        req.user.userId
      );

      res.status(200).json({
        collections,
        total: collections.length,
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
   * POST /collections
   * Create a new collection
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
      const data = createCollectionSchema.parse(req.body);

      // Create collection
      const collection = await collectionService.createCollection(
        req.user.userId,
        data
      );

      res.status(201).json({
        collection,
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
   * GET /collections/:id
   * Get collection details
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

      const collection = await collectionService.getCollectionById(
        req.params.id,
        req.user.userId
      );

      if (!collection) {
        res.status(404).json({
          error: {
            code: 'COLLECTION_NOT_FOUND',
            message: 'Collection not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Get bookmark count
      const bookmarkCount = await collectionService.countBookmarks(
        req.params.id,
        req.user.userId
      );

      res.status(200).json({
        collection,
        bookmarkCount,
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
   * PUT /collections/:id
   * Update collection
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
      const data = updateCollectionSchema.parse(req.body);

      // Update collection
      const collection = await collectionService.updateCollection(
        req.params.id,
        req.user.userId,
        data
      );

      res.status(200).json({
        collection,
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
          error.message === 'Collection not found'
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
   * DELETE /collections/:id
   * Delete collection
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

      // Parse query parameter for moveToDefault
      const moveToDefault = req.query.moveToDefault === 'false' ? false : true;

      // Delete collection
      await collectionService.deleteCollection(
        req.params.id,
        req.user.userId,
        moveToDefault
      );

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'Collection not found'
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
   * POST /collections/:id/share
   * Share collection with a user
   */
  router.post('/:id/share', async (req: Request, res: Response) => {
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

      // Check Pro tier
      if (req.user.plan !== 'pro') {
        res.status(403).json({
          error: {
            code: 'PRO_FEATURE',
            message: 'Collection sharing is a Pro feature',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Validate request body
      const data = shareCollectionSchema.parse(req.body);

      // Share collection
      const permission = await collectionService.shareCollection(
        req.params.id,
        req.user.userId,
        data.userId,
        data.role
      );

      res.status(201).json({
        permission,
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
          error.message === 'Collection not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 400;
        res.status(statusCode).json({
          error: {
            code: 'SHARE_FAILED',
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
   * DELETE /collections/:id/share/:userId
   * Revoke collection access from a user
   */
  router.delete('/:id/share/:userId', async (req: Request, res: Response) => {
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

      // Revoke access
      await collectionService.revokeAccess(
        req.params.id,
        req.user.userId,
        req.params.userId
      );

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'Collection not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : error.message === 'Permission not found'
                ? 404
                : 400;
        res.status(statusCode).json({
          error: {
            code: 'REVOKE_FAILED',
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
   * GET /collections/:id/permissions
   * Get all permissions for a collection
   */
  router.get('/:id/permissions', async (req: Request, res: Response) => {
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

      const permissions = await collectionService.getCollectionPermissions(
        req.params.id,
        req.user.userId
      );

      res.status(200).json({
        permissions,
        total: permissions.length,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'Collection not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 500;
        res.status(statusCode).json({
          error: {
            code: 'FETCH_FAILED',
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
   * POST /collections/:id/public
   * Make collection public and generate share slug
   */
  router.post('/:id/public', async (req: Request, res: Response) => {
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

      // Check Pro tier
      if (req.user.plan !== 'pro') {
        res.status(403).json({
          error: {
            code: 'PRO_FEATURE',
            message: 'Public collection sharing is a Pro feature',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const shareSlug = await collectionService.makePublic(
        req.params.id,
        req.user.userId
      );

      res.status(200).json({
        shareSlug,
        publicUrl: `/public/collections/${shareSlug}`,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'Collection not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 400;
        res.status(statusCode).json({
          error: {
            code: 'MAKE_PUBLIC_FAILED',
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
   * DELETE /collections/:id/public
   * Make collection private
   */
  router.delete('/:id/public', async (req: Request, res: Response) => {
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

      await collectionService.makePrivate(req.params.id, req.user.userId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'Collection not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 400;
        res.status(statusCode).json({
          error: {
            code: 'MAKE_PRIVATE_FAILED',
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
   * GET /public/collections/:shareSlug
   * Get public collection by share slug (no auth required)
   */
  router.get('/public/:shareSlug', async (req: Request, res: Response) => {
    try {
      const collection = await collectionService.getPublicCollection(
        req.params.shareSlug
      );

      if (!collection) {
        res.status(404).json({
          error: {
            code: 'COLLECTION_NOT_FOUND',
            message: 'Public collection not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Get bookmark count
      const bookmarkCount = await collectionService.countBookmarks(
        collection.id,
        collection.ownerId
      );

      res.status(200).json({
        collection,
        bookmarkCount,
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

  return router;
}
