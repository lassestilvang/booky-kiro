import { Pool } from 'pg';
import { CollectionPermission } from '@bookmark-manager/shared';
import { BaseRepository } from './base.repository.js';

/**
 * Collection permission repository for managing shared collections
 */
export class CollectionPermissionRepository extends BaseRepository<CollectionPermission> {
  constructor(pool: Pool) {
    super(pool, 'collection_permissions');
  }

  /**
   * Find permissions by collection ID
   */
  async findByCollection(
    collectionId: string
  ): Promise<CollectionPermission[]> {
    const result = await this.pool.query(
      'SELECT * FROM collection_permissions WHERE collection_id = $1 ORDER BY created_at',
      [collectionId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find permissions by user ID
   */
  async findByUser(userId: string): Promise<CollectionPermission[]> {
    const result = await this.pool.query(
      'SELECT * FROM collection_permissions WHERE user_id = $1 ORDER BY created_at',
      [userId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find specific permission for a user on a collection
   */
  async findByCollectionAndUser(
    collectionId: string,
    userId: string
  ): Promise<CollectionPermission | null> {
    const result = await this.pool.query(
      'SELECT * FROM collection_permissions WHERE collection_id = $1 AND user_id = $2',
      [collectionId, userId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Create or update permission
   */
  async upsert(
    permission: Partial<CollectionPermission>
  ): Promise<CollectionPermission> {
    const result = await this.pool.query(
      `INSERT INTO collection_permissions (collection_id, user_id, role, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (collection_id, user_id)
       DO UPDATE SET role = $3
       RETURNING *`,
      [permission.collectionId, permission.userId, permission.role]
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * Delete permission by collection and user
   */
  async deleteByCollectionAndUser(
    collectionId: string,
    userId: string
  ): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM collection_permissions WHERE collection_id = $1 AND user_id = $2',
      [collectionId, userId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Delete all permissions for a collection
   */
  async deleteByCollection(collectionId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM collection_permissions WHERE collection_id = $1',
      [collectionId]
    );
  }

  /**
   * Check if user has access to collection
   */
  async hasAccess(collectionId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM collection_permissions WHERE collection_id = $1 AND user_id = $2',
      [collectionId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get user's role for a collection
   */
  async getUserRole(
    collectionId: string,
    userId: string
  ): Promise<'owner' | 'editor' | 'viewer' | null> {
    const result = await this.pool.query(
      'SELECT role FROM collection_permissions WHERE collection_id = $1 AND user_id = $2',
      [collectionId, userId]
    );
    return result.rows.length > 0 ? result.rows[0].role : null;
  }

  protected mapRow(row: any): CollectionPermission {
    return {
      id: row.id,
      collectionId: row.collection_id,
      userId: row.user_id,
      role: row.role,
      createdAt: new Date(row.created_at),
    };
  }
}
