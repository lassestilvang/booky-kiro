import { Router, Request, Response } from 'express';
import { GDPRService } from '../services/gdpr.service.js';

/**
 * Create GDPR compliance routes
 */
export function createGDPRRoutes(gdprService: GDPRService): Router {
  const router = Router();

  /**
   * GET /gdpr/export
   * Export complete user data (GDPR compliance)
   */
  router.get('/export', async (req: Request, res: Response) => {
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

      // Generate complete data export
      const exportData = await gdprService.exportUserData(req.user.userId);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="gdpr-export-${req.user.userId}-${Date.now()}.json"`
      );

      res.status(200).json(exportData);
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'User not found' ? 404 : 500;
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
   * DELETE /gdpr/account
   * Delete user account and all data (GDPR right to be forgotten)
   */
  router.delete('/account', async (req: Request, res: Response) => {
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

      // Delete user account and all associated data
      await gdprService.deleteUserAccount(req.user.userId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === 'User not found' ? 404 : 500;
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

  return router;
}
