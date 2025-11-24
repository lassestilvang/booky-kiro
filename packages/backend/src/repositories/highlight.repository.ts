import { Pool } from 'pg';
import { Highlight } from '@bookmark-manager/shared';
import { BaseRepository } from './base.repository.js';

/**
 * Highlight repository for managing highlights
 */
export class HighlightRepository extends BaseRepository<Highlight> {
  constructor(pool: Pool) {
    super(pool, 'highlights');
  }

  /**
   * Find highlights by bookmark ID
   */
  async findByBookmark(bookmarkId: string): Promise<Highlight[]> {
    const result = await this.pool.query(
      'SELECT * FROM highlights WHERE bookmark_id = $1 ORDER BY created_at',
      [bookmarkId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find highlights by owner ID
   */
  async findByOwner(ownerId: string): Promise<Highlight[]> {
    const result = await this.pool.query(
      'SELECT * FROM highlights WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find all highlights by user ID (for backups)
   */
  async findByUserId(userId: string): Promise<Highlight[]> {
    return this.findByOwner(userId);
  }

  /**
   * Find highlights by owner with pagination
   */
  async findByOwnerPaginated(
    ownerId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ highlights: Highlight[]; total: number }> {
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await this.pool.query(
      'SELECT COUNT(*) FROM highlights WHERE owner_id = $1',
      [ownerId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const result = await this.pool.query(
      'SELECT * FROM highlights WHERE owner_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [ownerId, limit, offset]
    );

    const highlights = result.rows.map((row) => this.mapRow(row));

    return { highlights, total };
  }

  /**
   * Update highlight color
   */
  async updateColor(highlightId: string, color: string): Promise<Highlight | null> {
    const result = await this.pool.query(
      'UPDATE highlights SET color = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [color, highlightId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update highlight annotation
   */
  async updateAnnotation(
    highlightId: string,
    annotationMd: string | null
  ): Promise<Highlight | null> {
    const result = await this.pool.query(
      'UPDATE highlights SET annotation_md = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [annotationMd, highlightId]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  protected mapRow(row: any): Highlight {
    return {
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
    };
  }
}
