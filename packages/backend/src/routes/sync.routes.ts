import { Router, Request, Response } from 'express';
import { SyncService, SyncEntity } from '../services/sync.service.js';
import { Pool } from 'pg';
import Redis from 'ioredis';

/**
 * Sync Routes
 *
 * Provides endpoints for cross-device synchronization
 * Requirements 24.1, 24.3, 24.4
 */

export function createSyncRoutes(db: Pool, redis: Redis): Router {
  const router = Router();
  const syncService = new SyncService(db, redis);

  /**
   * GET /v1/sync/delta
   * Get delta changes since last sync
   * Requirement 24.1: Delta synchronization
   */
  router.get('/delta', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const lastSyncTimestamp = req.query.lastSyncTimestamp
        ? new Date(req.query.lastSyncTimestamp as string)
        : undefined;

      const deviceId = (req.query.deviceId as string) || 'unknown';

      const response = await syncService.getDeltaChanges(userId, {
        lastSyncTimestamp,
        deviceId,
      });

      res.json(response);
    } catch (error) {
      console.error('Error getting delta changes:', error);
      res.status(500).json({ error: 'Failed to get sync changes' });
    }
  });

  /**
   * POST /v1/sync/apply
   * Apply changes from client
   * Requirement 24.4: Conflict resolution
   */
  router.post('/apply', async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { changes, deviceId } = req.body;

      if (!Array.isArray(changes)) {
        res.status(400).json({ error: 'Changes must be an array' });
        return;
      }

      const conflicts = await syncService.applyChanges(
        userId,
        changes as SyncEntity[],
        deviceId || 'unknown'
      );

      res.json({
        success: true,
        conflicts,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error applying changes:', error);
      res.status(500).json({ error: 'Failed to apply changes' });
    }
  });

  /**
   * POST /v1/sync/offline
   * Handle offline sync on reconnection
   * Requirement 24.3: Offline sync on reconnection
   */
  router.post(
    '/offline',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const userId = (req as any).user?.id;
        if (!userId) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const { offlineChanges, lastSyncTimestamp, deviceId } = req.body;

        if (!Array.isArray(offlineChanges)) {
          res.status(400).json({ error: 'offlineChanges must be an array' });
          return;
        }

        const result = await syncService.handleOfflineSync(
          userId,
          deviceId || 'unknown',
          offlineChanges as SyncEntity[],
          lastSyncTimestamp ? new Date(lastSyncTimestamp) : undefined
        );

        res.json({
          success: true,
          serverChanges: result.serverChanges,
          conflicts: result.conflicts,
          timestamp: result.timestamp,
        });
      } catch (error) {
        console.error('Error handling offline sync:', error);
        res.status(500).json({ error: 'Failed to handle offline sync' });
      }
    }
  );

  return router;
}
