import { Pool } from 'pg';
import { Tag } from '@bookmark-manager/shared';
import { BaseRepository } from './base.repository.js';

/**
 * Tag repository with normalization
 */
export class TagRepository extends BaseRepository<Tag> {
  constructor(pool: Pool) {
    super(pool, 'tags');
  }

  /**
   * Find tags by owner
   */
  async findByOwner(ownerId: string): Promise<Tag[]> {
    const result = await this.pool.query(
      'SELECT * FROM tags WHERE owner_id = $1 ORDER BY name',
      [ownerId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find tag by normalized name
   */
  async findByNormalizedName(
    ownerId: string,
    name: string
  ): Promise<Tag | null> {
    const normalizedName = this.normalizeName(name);
    const result = await this.pool.query(
      'SELECT * FROM tags WHERE owner_id = $1 AND normalized_name = $2',
      [ownerId, normalizedName]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Create tag with normalized name
   */
  async createTag(
    ownerId: string,
    name: string,
    color?: string
  ): Promise<Tag> {
    const normalizedName = this.normalizeName(name);

    // Check if tag already exists
    const existing = await this.findByNormalizedName(ownerId, name);
    if (existing) {
      return existing;
    }

    const result = await this.pool.query(
      `INSERT INTO tags (owner_id, name, normalized_name, color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ownerId, name, normalizedName, color]
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find or create tag by name
   */
  async findOrCreate(ownerId: string, name: string): Promise<Tag> {
    const existing = await this.findByNormalizedName(ownerId, name);
    if (existing) {
      return existing;
    }
    return this.createTag(ownerId, name);
  }

  /**
   * Find or create multiple tags
   */
  async findOrCreateMany(ownerId: string, names: string[]): Promise<Tag[]> {
    const tags: Tag[] = [];
    for (const name of names) {
      const tag = await this.findOrCreate(ownerId, name);
      tags.push(tag);
    }
    return tags;
  }

  /**
   * Merge tags - consolidate source tags into target tag
   */
  async mergeTags(
    sourceTagIds: string[],
    targetTagId: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update all bookmark_tags to point to target tag
      // First, delete any that would create duplicates
      await client.query(
        `DELETE FROM bookmark_tags
         WHERE tag_id = ANY($2)
         AND bookmark_id IN (
           SELECT bookmark_id FROM bookmark_tags WHERE tag_id = $1
         )`,
        [targetTagId, sourceTagIds]
      );
      
      // Then update the remaining ones
      await client.query(
        `UPDATE bookmark_tags
         SET tag_id = $1
         WHERE tag_id = ANY($2)`,
        [targetTagId, sourceTagIds]
      );

      // Delete duplicate bookmark_tags entries
      await client.query(
        `DELETE FROM bookmark_tags bt1
         WHERE tag_id = $1
         AND EXISTS (
           SELECT 1 FROM bookmark_tags bt2
           WHERE bt2.bookmark_id = bt1.bookmark_id
           AND bt2.tag_id = $1
           AND bt2.ctid > bt1.ctid
         )`,
        [targetTagId]
      );

      // Delete source tags
      await client.query('DELETE FROM tags WHERE id = ANY($1)', [sourceTagIds]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get tags used by bookmarks in a collection
   */
  async getTagsByCollection(collectionId: string): Promise<Tag[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT t.* FROM tags t
       INNER JOIN bookmark_tags bt ON t.id = bt.tag_id
       INNER JOIN bookmarks b ON bt.bookmark_id = b.id
       WHERE b.collection_id = $1
       ORDER BY t.name`,
      [collectionId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Get tag usage count
   */
  async getTagUsageCount(tagId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) FROM bookmark_tags WHERE tag_id = $1',
      [tagId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get popular tags for a user
   */
  async getPopularTags(ownerId: string, limit: number = 10): Promise<
    Array<Tag & { usageCount: number }>
  > {
    const result = await this.pool.query(
      `SELECT t.*, COUNT(bt.bookmark_id) as usage_count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
       WHERE t.owner_id = $1
       GROUP BY t.id
       ORDER BY usage_count DESC, t.name
       LIMIT $2`,
      [ownerId, limit]
    );
    return result.rows.map((row) => ({
      ...this.mapRow(row),
      usageCount: parseInt(row.usage_count, 10),
    }));
  }

  /**
   * Normalize tag name (lowercase, trim)
   */
  private normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }

  protected mapRow(row: any): Tag {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      normalizedName: row.normalized_name,
      color: row.color,
      createdAt: new Date(row.created_at),
    };
  }
}
