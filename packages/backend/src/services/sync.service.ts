import { Pool } from 'pg';
import Redis from 'ioredis';

/**
 * Sync Service
 *
 * Handles cross-device synchronization with delta sync and conflict resolution.
 * Implements Requirements 24.1, 24.3, 24.4
 */

export interface SyncEntity {
  id: string;
  type: 'bookmark' | 'collection' | 'tag' | 'highlight' | 'reminder';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  userId: string;
}

export interface SyncRequest {
  lastSyncTimestamp?: Date;
  deviceId: string;
}

export interface SyncResponse {
  changes: SyncEntity[];
  timestamp: Date;
  hasMore: boolean;
}

export interface ConflictResolution {
  entityId: string;
  entityType: string;
  localTimestamp: Date;
  remoteTimestamp: Date;
  resolution: 'local' | 'remote';
}

export class SyncService {
  constructor(
    private db: Pool,
    private redis: Redis
  ) {}

  /**
   * Get all changes since last sync timestamp (delta synchronization)
   * Requirement 24.1: Delta synchronization
   */
  async getDeltaChanges(
    userId: string,
    request: SyncRequest
  ): Promise<SyncResponse> {
    const lastSync = request.lastSyncTimestamp || new Date(0);
    const changes: SyncEntity[] = [];

    // Get bookmark changes
    const bookmarkChanges = await this.getBookmarkChanges(userId, lastSync);
    changes.push(...bookmarkChanges);

    // Get collection changes
    const collectionChanges = await this.getCollectionChanges(userId, lastSync);
    changes.push(...collectionChanges);

    // Get tag changes
    const tagChanges = await this.getTagChanges(userId, lastSync);
    changes.push(...tagChanges);

    // Get highlight changes
    const highlightChanges = await this.getHighlightChanges(userId, lastSync);
    changes.push(...highlightChanges);

    // Get reminder changes
    const reminderChanges = await this.getReminderChanges(userId, lastSync);
    changes.push(...reminderChanges);

    // Sort by timestamp
    changes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const currentTimestamp = new Date();

    return {
      changes,
      timestamp: currentTimestamp,
      hasMore: false, // For pagination in future
    };
  }

  /**
   * Apply changes from client with conflict resolution
   * Requirement 24.4: Conflict resolution using last-write-wins
   */
  async applyChanges(
    userId: string,
    changes: SyncEntity[],
    deviceId: string
  ): Promise<ConflictResolution[]> {
    const conflicts: ConflictResolution[] = [];

    for (const change of changes) {
      try {
        const conflict = await this.applyChange(userId, change, deviceId);
        if (conflict) {
          conflicts.push(conflict);
        }
      } catch (error) {
        console.error(
          `Failed to apply change for ${change.type} ${change.id}:`,
          error
        );
      }
    }

    return conflicts;
  }

  /**
   * Apply a single change with conflict detection
   */
  private async applyChange(
    userId: string,
    change: SyncEntity,
    deviceId: string
  ): Promise<ConflictResolution | null> {
    // Check for conflicts by comparing timestamps
    const existingEntity = await this.getEntity(change.type, change.id);

    if (existingEntity && change.action === 'update') {
      const existingTimestamp = new Date(existingEntity.updated_at);
      const changeTimestamp = change.timestamp;

      // Last-write-wins: if existing is newer, skip this change
      if (existingTimestamp > changeTimestamp) {
        return {
          entityId: change.id,
          entityType: change.type,
          localTimestamp: changeTimestamp,
          remoteTimestamp: existingTimestamp,
          resolution: 'remote',
        };
      }
    }

    // Apply the change
    switch (change.action) {
      case 'create':
        await this.createEntity(change.type, change.data, userId);
        break;
      case 'update':
        await this.updateEntity(change.type, change.id, change.data, userId);
        break;
      case 'delete':
        await this.deleteEntity(change.type, change.id, userId);
        break;
    }

    // Broadcast change to other connected devices
    await this.broadcastChange(userId, change, deviceId);

    return null;
  }

  /**
   * Get bookmark changes since timestamp
   */
  private async getBookmarkChanges(
    userId: string,
    since: Date
  ): Promise<SyncEntity[]> {
    const result = await this.db.query(
      `SELECT b.*, 
              COALESCE(
                json_agg(
                  DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
                ) FILTER (WHERE t.id IS NOT NULL),
                '[]'
              ) as tags
       FROM bookmarks b
       LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
       LEFT JOIN tags t ON bt.tag_id = t.id
       WHERE b.owner_id = $1 AND b.updated_at > $2
       GROUP BY b.id
       ORDER BY b.updated_at ASC`,
      [userId, since]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: 'bookmark' as const,
      action: 'update' as const,
      data: {
        id: row.id,
        ownerId: row.owner_id,
        collectionId: row.collection_id,
        title: row.title,
        url: row.url,
        excerpt: row.excerpt,
        contentSnapshotPath: row.content_snapshot_path,
        contentIndexed: row.content_indexed,
        type: row.type,
        domain: row.domain,
        coverUrl: row.cover_url,
        isDuplicate: row.is_duplicate,
        isBroken: row.is_broken,
        customOrder: row.custom_order,
        tags: row.tags,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      timestamp: new Date(row.updated_at),
      userId,
    }));
  }

  /**
   * Get collection changes since timestamp
   */
  private async getCollectionChanges(
    userId: string,
    since: Date
  ): Promise<SyncEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM collections 
       WHERE owner_id = $1 AND updated_at > $2
       ORDER BY updated_at ASC`,
      [userId, since]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: 'collection' as const,
      action: 'update' as const,
      data: {
        id: row.id,
        ownerId: row.owner_id,
        title: row.title,
        icon: row.icon,
        isPublic: row.is_public,
        shareSlug: row.share_slug,
        parentId: row.parent_id,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      timestamp: new Date(row.updated_at),
      userId,
    }));
  }

  /**
   * Get tag changes since timestamp
   */
  private async getTagChanges(
    userId: string,
    since: Date
  ): Promise<SyncEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM tags 
       WHERE owner_id = $1 AND created_at > $2
       ORDER BY created_at ASC`,
      [userId, since]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: 'tag' as const,
      action: 'create' as const,
      data: {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        normalizedName: row.normalized_name,
        color: row.color,
        createdAt: row.created_at,
      },
      timestamp: new Date(row.created_at),
      userId,
    }));
  }

  /**
   * Get highlight changes since timestamp
   */
  private async getHighlightChanges(
    userId: string,
    since: Date
  ): Promise<SyncEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM highlights 
       WHERE owner_id = $1 AND updated_at > $2
       ORDER BY updated_at ASC`,
      [userId, since]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: 'highlight' as const,
      action: 'update' as const,
      data: {
        id: row.id,
        bookmarkId: row.bookmark_id,
        ownerId: row.owner_id,
        textSelected: row.text_selected,
        color: row.color,
        annotationMd: row.annotation_md,
        positionContext: row.position_context,
        snapshotId: row.snapshot_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      timestamp: new Date(row.updated_at),
      userId,
    }));
  }

  /**
   * Get reminder changes since timestamp
   */
  private async getReminderChanges(
    userId: string,
    since: Date
  ): Promise<SyncEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM reminders 
       WHERE owner_id = $1 AND created_at > $2
       ORDER BY created_at ASC`,
      [userId, since]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: 'reminder' as const,
      action: 'create' as const,
      data: {
        id: row.id,
        bookmarkId: row.bookmark_id,
        ownerId: row.owner_id,
        remindAt: row.remind_at,
        notificationChannels: row.notification_channels,
        completed: row.completed,
        createdAt: row.created_at,
      },
      timestamp: new Date(row.created_at),
      userId,
    }));
  }

  /**
   * Get entity by type and ID for conflict detection
   */
  private async getEntity(type: string, id: string): Promise<any | null> {
    const tableMap: Record<string, string> = {
      bookmark: 'bookmarks',
      collection: 'collections',
      tag: 'tags',
      highlight: 'highlights',
      reminder: 'reminders',
    };

    const table = tableMap[type];
    if (!table) return null;

    const result = await this.db.query(`SELECT * FROM ${table} WHERE id = $1`, [
      id,
    ]);

    return result.rows[0] || null;
  }

  /**
   * Create entity
   */
  private async createEntity(
    type: string,
    data: any,
    userId: string
  ): Promise<void> {
    // Implementation depends on entity type
    // This is a simplified version
    switch (type) {
      case 'bookmark':
        await this.db.query(
          `INSERT INTO bookmarks (id, owner_id, title, url, type, domain, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            data.id,
            userId,
            data.title,
            data.url,
            data.type,
            data.domain,
            data.createdAt,
            data.updatedAt,
          ]
        );
        break;
      // Add other entity types as needed
    }
  }

  /**
   * Update entity
   */
  private async updateEntity(
    type: string,
    id: string,
    data: any,
    userId: string
  ): Promise<void> {
    // Implementation depends on entity type
    switch (type) {
      case 'bookmark':
        await this.db.query(
          `UPDATE bookmarks 
           SET title = $1, excerpt = $2, collection_id = $3, updated_at = $4
           WHERE id = $5 AND owner_id = $6`,
          [data.title, data.excerpt, data.collectionId, new Date(), id, userId]
        );
        break;
      // Add other entity types as needed
    }
  }

  /**
   * Delete entity
   */
  private async deleteEntity(
    type: string,
    id: string,
    userId: string
  ): Promise<void> {
    const tableMap: Record<string, string> = {
      bookmark: 'bookmarks',
      collection: 'collections',
      tag: 'tags',
      highlight: 'highlights',
      reminder: 'reminders',
    };

    const table = tableMap[type];
    if (!table) return;

    await this.db.query(
      `DELETE FROM ${table} WHERE id = $1 AND owner_id = $2`,
      [id, userId]
    );
  }

  /**
   * Broadcast change to other connected devices via Redis pub/sub
   * Requirement 24.1: Real-time updates
   */
  private async broadcastChange(
    userId: string,
    change: SyncEntity,
    excludeDeviceId: string
  ): Promise<void> {
    const channel = `sync:${userId}`;
    const message = JSON.stringify({
      ...change,
      excludeDeviceId,
    });

    await this.redis.publish(channel, message);
  }

  /**
   * Subscribe to sync changes for a user
   */
  async subscribeToChanges(
    userId: string,
    callback: (change: SyncEntity) => void
  ): Promise<() => void> {
    const subscriber = this.redis.duplicate();
    await subscriber.connect();

    const channel = `sync:${userId}`;
    await subscriber.subscribe(channel);

    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        const change = JSON.parse(message);
        callback(change);
      }
    });

    // Return unsubscribe function
    return async () => {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    };
  }

  /**
   * Handle offline sync on reconnection
   * Requirement 24.3: Offline sync on reconnection
   */
  async handleOfflineSync(
    userId: string,
    deviceId: string,
    offlineChanges: SyncEntity[],
    lastSyncTimestamp?: Date
  ): Promise<{
    serverChanges: SyncEntity[];
    conflicts: ConflictResolution[];
    timestamp: Date;
  }> {
    // Get server changes since last sync
    const serverResponse = await this.getDeltaChanges(userId, {
      lastSyncTimestamp,
      deviceId,
    });

    // Apply offline changes with conflict resolution
    const conflicts = await this.applyChanges(userId, offlineChanges, deviceId);

    return {
      serverChanges: serverResponse.changes,
      conflicts,
      timestamp: serverResponse.timestamp,
    };
  }
}
