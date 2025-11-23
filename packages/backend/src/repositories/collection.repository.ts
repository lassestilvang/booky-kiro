import { Pool } from 'pg';
import { Collection } from '@bookmark-manager/shared';
import { BaseRepository } from './base.repository.js';

/**
 * Collection repository with hierarchy support
 */
export class CollectionRepository extends BaseRepository<Collection> {
  constructor(pool: Pool) {
    super(pool, 'collections');
  }

  /**
   * Find collections by owner
   */
  async findByOwner(ownerId: string): Promise<Collection[]> {
    const result = await this.pool.query(
      'SELECT * FROM collections WHERE owner_id = $1 ORDER BY sort_order, created_at',
      [ownerId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find child collections
   */
  async findChildren(parentId: string): Promise<Collection[]> {
    const result = await this.pool.query(
      'SELECT * FROM collections WHERE parent_id = $1 ORDER BY sort_order, created_at',
      [parentId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find root collections (no parent)
   */
  async findRootCollections(ownerId: string): Promise<Collection[]> {
    const result = await this.pool.query(
      'SELECT * FROM collections WHERE owner_id = $1 AND parent_id IS NULL ORDER BY sort_order, created_at',
      [ownerId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find collection by share slug
   */
  async findByShareSlug(shareSlug: string): Promise<Collection | null> {
    const result = await this.pool.query(
      'SELECT * FROM collections WHERE share_slug = $1',
      [shareSlug]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Generate unique share slug
   */
  async generateShareSlug(collectionId: string): Promise<string> {
    const slug = this.generateRandomSlug();
    await this.pool.query(
      'UPDATE collections SET share_slug = $1, updated_at = NOW() WHERE id = $2',
      [slug, collectionId]
    );
    return slug;
  }

  /**
   * Update collection hierarchy
   */
  async moveToParent(
    collectionId: string,
    parentId: string | null
  ): Promise<Collection | null> {
    const result = await this.pool.query(
      'UPDATE collections SET parent_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [parentId, collectionId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update sort order
   */
  async updateSortOrder(
    collectionId: string,
    sortOrder: number
  ): Promise<Collection | null> {
    const result = await this.pool.query(
      'UPDATE collections SET sort_order = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [sortOrder, collectionId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Get collection hierarchy (parent chain)
   */
  async getHierarchy(collectionId: string): Promise<Collection[]> {
    const result = await this.pool.query(
      `WITH RECURSIVE collection_hierarchy AS (
        SELECT * FROM collections WHERE id = $1
        UNION ALL
        SELECT c.* FROM collections c
        INNER JOIN collection_hierarchy ch ON c.id = ch.parent_id
      )
      SELECT * FROM collection_hierarchy ORDER BY created_at`,
      [collectionId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Count bookmarks in collection
   */
  async countBookmarks(collectionId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) FROM bookmarks WHERE collection_id = $1',
      [collectionId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private generateRandomSlug(): string {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let slug = '';
    for (let i = 0; i < 12; i++) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return slug;
  }

  protected mapRow(row: any): Collection {
    return {
      id: row.id,
      ownerId: row.owner_id,
      title: row.title,
      icon: row.icon,
      isPublic: row.is_public,
      shareSlug: row.share_slug,
      parentId: row.parent_id,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
