import { Router, Request, Response } from 'express';
import { ReminderService } from '../services/reminder.service.js';
import { createAuthMiddleware, requireProPlan } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';
import {
  CreateReminderRequest,
  UpdateReminderRequest,
} from '@bookmark-manager/shared';

/**
 * Create reminder routes
 */
export function createReminderRoutes(
  reminderService: ReminderService,
  authService: AuthService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  // All reminder endpoints require authentication and Pro plan
  router.use(authMiddleware);
  router.use(requireProPlan);

  /**
   * GET /v1/reminders - List all reminders for the authenticated user
   */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const activeOnly = req.query.active === 'true';

      const reminders = activeOnly
        ? await reminderService.getActiveReminders(userId)
        : await reminderService.getUserReminders(userId);

      res.json({ reminders });
    } catch (error) {
      console.error('Error listing reminders:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list reminders',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * GET /v1/reminders/:id - Get a specific reminder
   */
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const reminderId = req.params.id;

      const reminder = await reminderService.getReminderById(reminderId, userId);

      if (!reminder) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Reminder not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      res.json(reminder);
    } catch (error: any) {
      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to access this reminder',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      console.error('Error getting reminder:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get reminder',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * GET /v1/bookmarks/:bookmarkId/reminders - Get reminders for a specific bookmark
   */
  router.get(
    '/bookmarks/:bookmarkId/reminders',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const userId = req.user!.userId;
        const bookmarkId = req.params.bookmarkId;

        const reminders = await reminderService.getBookmarkReminders(bookmarkId, userId);

        res.json({ reminders });
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

        if (error.message.includes('Unauthorized')) {
          res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'You do not have permission to access this bookmark',
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || 'unknown',
            },
          });
          return;
        }

        console.error('Error getting bookmark reminders:', error);
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to get bookmark reminders',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  );

  /**
   * POST /v1/reminders - Create a new reminder
   */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const data: CreateReminderRequest = req.body;

      // Validate required fields
      if (!data.bookmarkId || !data.remindAt) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: bookmarkId, remindAt',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const reminder = await reminderService.createReminder(userId, data);

      res.status(201).json(reminder);
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

      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to create reminders for this bookmark',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (error.message.includes('must be in the future')) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      console.error('Error creating reminder:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create reminder',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * PUT /v1/reminders/:id - Update a reminder
   */
  router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const reminderId = req.params.id;
      const data: UpdateReminderRequest = req.body;

      const reminder = await reminderService.updateReminder(reminderId, userId, data);

      res.json(reminder);
    } catch (error: any) {
      if (error.message === 'Reminder not found') {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Reminder not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to update this reminder',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (error.message.includes('must be in the future')) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      console.error('Error updating reminder:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update reminder',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * POST /v1/reminders/:id/dismiss - Dismiss (mark as completed) a reminder
   */
  router.post('/:id/dismiss', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const reminderId = req.params.id;

      const reminder = await reminderService.dismissReminder(reminderId, userId);

      res.json(reminder);
    } catch (error: any) {
      if (error.message === 'Reminder not found') {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Reminder not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to dismiss this reminder',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      console.error('Error dismissing reminder:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to dismiss reminder',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * DELETE /v1/reminders/:id - Delete a reminder
   */
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const reminderId = req.params.id;

      await reminderService.deleteReminder(reminderId, userId);

      res.status(204).send();
    } catch (error: any) {
      if (error.message === 'Reminder not found') {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Reminder not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to delete this reminder',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      console.error('Error deleting reminder:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete reminder',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  return router;
}
