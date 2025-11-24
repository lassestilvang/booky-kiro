import { Pool } from 'pg';
import {
  Bookmark,
  BookmarkWithRelations,
  Tag,
  Highlight,
} from '@bookmark-manager/shared';
import { BaseRepository } from './base.repository.js';

export interface BookmarkFilters {
  ownerId?: string;
  collectionId?: string;
  tags?: string[];
  type?: string[];
  domain?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  isDuplicate?: boolean;
  isBroken?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Bookmark repository with filtering and pagination
 */
export class BookmarkRepository extends BaseRepository<Bookmark> {
  constructor(pool: Pool) {
    super(pool, 'bookmarks');
  }

  /**
   * Find bookmarks by collection
   */
  async findByCollection(collectionId: string): Promise<Bookmark[]> {
    const result = await this.pool.query(
      'SELECT * FROM bookmarks WHERE collection_id = $1 ORDER BY created_at DESC',
      [collectionId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find all bookmarks by user ID (for backups)
   */
  async findByUserId(userId: string): Promise<Bookmark[]> {
    const result = await this.pool.query(
      'SELECT * FROM bookmarks WHERE owner_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find bookmarks with filters and pagination
   */
  async findWithFilters(
    filters: BookmarkFilters,
    pagination?: PaginationOptions
  ): Promise<{ bookmarks: Bookmark[]; total: number }> {
    const {
      page = 1,
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = pagination || {};
    const offset = (page - 1) * limit;

    let query = 'SELECT DISTINCT b.* FROM bookmarks b';
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    // Join with tags if filtering by tags
    // Use HAVING COUNT to ensure ALL tags are present (AND logic, not OR)
    let hasTagFilter = false;
    if (filters.tags && filters.tags.length > 0) {
      hasTagFilter = true;
      query += `
        INNER JOIN bookmark_tags bt ON b.id = bt.bookmark_id
        INNER JOIN tags t ON bt.tag_id = t.id
      `;
      conditions.push(`t.normalized_name = ANY($${paramIndex})`);
      params.push(filters.tags.map((tag) => tag.trim().toLowerCase()));
      paramIndex++;
    }

    // Owner filter
    if (filters.ownerId) {
      conditions.push(`b.owner_id = $${paramIndex}`);
      params.push(filters.ownerId);
      paramIndex++;
    }

    // Collection filter
    if (filters.collectionId) {
      conditions.push(`b.collection_id = $${paramIndex}`);
      params.push(filters.collectionId);
      paramIndex++;
    }

    // Type filter
    if (filters.type && filters.type.length > 0) {
      conditions.push(`b.type = ANY($${paramIndex})`);
      params.push(filters.type);
      paramIndex++;
    }

    // Domain filter
    if (filters.domain && filters.domain.length > 0) {
      conditions.push(`b.domain = ANY($${paramIndex})`);
      params.push(filters.domain);
      paramIndex++;
    }

    // Date range filter
    if (filters.dateFrom) {
      conditions.push(`b.created_at >= $${paramIndex}`);
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      conditions.push(`b.created_at <= $${paramIndex}`);
      params.push(filters.dateTo);
      paramIndex++;
    }

    // Duplicate filter
    if (filters.isDuplicate !== undefined) {
      conditions.push(`b.is_duplicate = $${paramIndex}`);
      params.push(filters.isDuplicate);
      paramIndex++;
    }

    // Broken link filter
    if (filters.isBroken !== undefined) {
      conditions.push(`b.is_broken = $${paramIndex}`);
      params.push(filters.isBroken);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add GROUP BY and HAVING for tag filtering (ensures ALL tags match)
    if (hasTagFilter && filters.tags) {
      // Must include all selected columns in GROUP BY when using SELECT b.*
      query += ` GROUP BY b.id, b.owner_id, b.collection_id, b.title, b.url, b.excerpt, b.content_snapshot_path, b.content_indexed, b.type, b.domain, b.cover_url, b.is_duplicate, b.is_broken, b.custom_order, b.created_at, b.updated_at HAVING COUNT(DISTINCT t.normalized_name) = ${filters.tags.length}`;
    }

    // Count total
    // When using GROUP BY, we need to wrap the query in a subquery to count correctly
    let countQuery: string;
    if (hasTagFilter && filters.tags) {
      countQuery = `SELECT COUNT(*) FROM (${query}) AS subquery`;
    } else {
      countQuery = query.replace(
        'SELECT DISTINCT b.*',
        'SELECT COUNT(DISTINCT b.id)'
      );
    }
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Add sorting and pagination
    query += ` ORDER BY b.${sortBy} ${sortOrder.toUpperCase()}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);
    const bookmarks = result.rows.map((row) => this.mapRow(row));

    return { bookmarks, total };
  }

  /**
   * Find bookmark with tags and highlights
   */
  async findByIdWithRelations(
    id: string
  ): Promise<BookmarkWithRelations | null> {
    const bookmark = await this.findById(id);
    if (!bookmark) return null;

    const tags = await this.getBookmarkTags(id);
    const highlights = await this.getBookmarkHighlights(id);

    return {
      ...bookmark,
      tags,
      highlights,
    };
  }

  /**
   * Get tags for a bookmark
   */
  async getBookmarkTags(bookmarkId: string): Promise<Tag[]> {
    const result = await this.pool.query(
      `SELECT t.* FROM tags t
       INNER JOIN bookmark_tags bt ON t.id = bt.tag_id
       WHERE bt.bookmark_id = $1
       ORDER BY t.name`,
      [bookmarkId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      normalizedName: row.normalized_name,
      color: row.color,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get highlights for a bookmark
   */
  async getBookmarkHighlights(bookmarkId: string): Promise<Highlight[]> {
    const result = await this.pool.query(
      `SELECT * FROM highlights WHERE bookmark_id = $1 ORDER BY created_at`,
      [bookmarkId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      bookmarkId: row.bookmark_id,
      ownerId: row.owner_id,
      textSelected: row.text_selected,
      color: row.color,
      annotationMd: row.annotation_md,
      positionContext: row.position_context,
      snapshotId: row.snapshot_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Add tags to bookmark
   */
  async addTags(bookmarkId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;

    const values = tagIds
      .map((_tagId, index) => `($1, $${index + 2})`)
      .join(', ');

    await this.pool.query(
      `INSERT INTO bookmark_tags (bookmark_id, tag_id)
       VALUES ${values}
       ON CONFLICT DO NOTHING`,
      [bookmarkId, ...tagIds]
    );
  }

  /**
   * Remove tags from bookmark
   */
  async removeTags(bookmarkId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;

    await this.pool.query(
      'DELETE FROM bookmark_tags WHERE bookmark_id = $1 AND tag_id = ANY($2)',
      [bookmarkId, tagIds]
    );
  }

  /**
   * Move bookmark to collection
   */
  async moveToCollection(
    bookmarkId: string,
    collectionId: string | null
  ): Promise<Bookmark | null> {
    const result = await this.pool.query(
      'UPDATE bookmarks SET collection_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [collectionId, bookmarkId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find duplicate bookmarks by URL
   */
  async findDuplicatesByUrl(ownerId: string, url: string): Promise<Bookmark[]> {
    const result = await this.pool.query(
      'SELECT * FROM bookmarks WHERE owner_id = $1 AND url = $2',
      [ownerId, url]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Mark bookmark as duplicate
   */
  async markAsDuplicate(bookmarkId: string): Promise<void> {
    await this.pool.query(
      'UPDATE bookmarks SET is_duplicate = true, updated_at = NOW() WHERE id = $1',
      [bookmarkId]
    );
  }

  /**
   * Mark bookmark as broken
   */
  async markAsBroken(bookmarkId: string, isBroken: boolean): Promise<void> {
    await this.pool.query(
      'UPDATE bookmarks SET is_broken = $1, updated_at = NOW() WHERE id = $2',
      [isBroken, bookmarkId]
    );
  }

  /**
   * Update snapshot path
   */
  async updateSnapshotPath(
    bookmarkId: string,
    snapshotPath: string
  ): Promise<void> {
    await this.pool.query(
      'UPDATE bookmarks SET content_snapshot_path = $1, updated_at = NOW() WHERE id = $2',
      [snapshotPath, bookmarkId]
    );
  }

  /**
   * Update indexed status
   */
  async updateIndexedStatus(
    bookmarkId: string,
    indexed: boolean
  ): Promise<void> {
    await this.pool.query(
      'UPDATE bookmarks SET content_indexed = $1, updated_at = NOW() WHERE id = $2',
      [indexed, bookmarkId]
    );
  }

  /**
   * Bulk move bookmarks to collection
   */
  async bulkMoveToCollection(
    bookmarkIds: string[],
    collectionId: string | null
  ): Promise<number> {
    const result = await this.pool.query(
      'UPDATE bookmarks SET collection_id = $1, updated_at = NOW() WHERE id = ANY($2)',
      [collectionId, bookmarkIds]
    );
    return result.rowCount || 0;
  }

  /**
   * Bulk delete bookmarks
   */
  async bulkDelete(bookmarkIds: string[]): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM bookmarks WHERE id = ANY($1)',
      [bookmarkIds]
    );
    return result.rowCount || 0;
  }

  /**
   * Update custom order for multiple bookmarks
   */
  async updateCustomOrder(
    updates: Array<{ id: string; order: number }>
  ): Promise<void> {
    // Use a transaction to update all orders atomically
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const update of updates) {
        await client.query(
          'UPDATE bookmarks SET custom_order = $1, updated_at = NOW() WHERE id = $2',
          [update.order, update.id]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  protected mapRow(row: any): Bookmark {
    return {
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
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
