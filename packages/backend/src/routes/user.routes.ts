import { Router, Request, Response } from 'express';
import { UserService } from '../services/user.service.js';
import { PlanService } from '../services/plan.service.js';
import { z } from 'zod';

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
});

const changePlanSchema = z.object({
  plan: z.enum(['free', 'pro']),
});

/**
 * Create user management routes
 */
export function createUserRoutes(
  userService: UserService,
  planService?: PlanService
): Router {
  const router = Router();

  /**
   * GET /user
   * Retrieve user profile
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

      const user = await userService.getUserProfile(req.user.userId);

      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
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
   * PUT /user
   * Update user profile
   */
  router.put('/', async (req: Request, res: Response) => {
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
      const data = updateProfileSchema.parse(req.body);

      // Update user profile
      const updatedUser = await userService.updateUserProfile(
        req.user.userId,
        data
      );

      res.status(200).json({
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          plan: updatedUser.plan,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        },
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
          error.message === 'User not found'
            ? 404
            : error.message === 'Email already in use'
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
   * DELETE /user
   * Delete user account
   */
  router.delete('/', async (req: Request, res: Response) => {
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

      // Delete user account
      await userService.deleteUserAccount(req.user.userId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'User not found' ? 404 : 400;
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
   * GET /user/stats
   * Get user statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
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

      const stats = await userService.getUserStats(req.user.userId);

      res.status(200).json({ stats });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'User not found' ? 404 : 400;
        res.status(statusCode).json({
          error: {
            code: 'STATS_FAILED',
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
   * PUT /user/plan
   * Change user plan tier (upgrade or downgrade)
   */
  router.put('/plan', async (req: Request, res: Response) => {
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

      if (!planService) {
        res.status(501).json({
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'Plan management service not available',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Validate request body
      const data = changePlanSchema.parse(req.body);

      // Change plan
      const result = await planService.changePlan(req.user.userId, data.plan);

      res.status(200).json({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          plan: result.user.plan,
          createdAt: result.user.createdAt,
          updatedAt: result.user.updatedAt,
        },
        backupTriggered: result.backupTriggered,
        retentionApplied: result.retentionApplied,
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
        const statusCode = error.message === 'User not found' ? 404 : 400;
        res.status(statusCode).json({
          error: {
            code: 'PLAN_CHANGE_FAILED',
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
