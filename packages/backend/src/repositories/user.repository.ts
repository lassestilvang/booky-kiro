import { Pool } from 'pg';
import { User } from '@bookmark-manager/shared';
import { BaseRepository } from './base.repository.js';

/**
 * User repository with authentication queries
 */
export class UserRepository extends BaseRepository<User> {
  constructor(pool: Pool) {
    super(pool, 'users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find user by email with password hash (for authentication)
   */
  async findByEmailWithPassword(
    email: string
  ): Promise<(User & { passwordHash: string }) | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...this.mapRow(row),
      passwordHash: row.password_hash,
    };
  }

  /**
   * Create user with password hash
   */
  async createWithPassword(
    email: string,
    passwordHash: string,
    name: string,
    plan: 'free' | 'pro' = 'free'
  ): Promise<User> {
    const result = await this.pool.query(
      `INSERT INTO users (email, password_hash, name, plan)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email, passwordHash, name, plan]
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, passwordHash: string): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Update user plan tier
   */
  async updatePlan(id: string, plan: 'free' | 'pro'): Promise<User | null> {
    const result = await this.pool.query(
      'UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [plan, id]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    totalBookmarks: number;
    totalCollections: number;
    totalTags: number;
    totalHighlights: number;
    storageUsedBytes: number;
  }> {
    const result = await this.pool.query(
      `SELECT
        (SELECT COUNT(*) FROM bookmarks WHERE owner_id = $1) as total_bookmarks,
        (SELECT COUNT(*) FROM collections WHERE owner_id = $1) as total_collections,
        (SELECT COUNT(*) FROM tags WHERE owner_id = $1) as total_tags,
        (SELECT COUNT(*) FROM highlights WHERE owner_id = $1) as total_highlights,
        (SELECT COALESCE(SUM(size_bytes), 0) FROM files WHERE owner_id = $1) as storage_used_bytes`,
      [userId]
    );

    const row = result.rows[0];
    return {
      totalBookmarks: parseInt(row.total_bookmarks, 10),
      totalCollections: parseInt(row.total_collections, 10),
      totalTags: parseInt(row.total_tags, 10),
      totalHighlights: parseInt(row.total_highlights, 10),
      storageUsedBytes: parseInt(row.storage_used_bytes, 10),
    };
  }

  protected mapRow(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      plan: row.plan,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
