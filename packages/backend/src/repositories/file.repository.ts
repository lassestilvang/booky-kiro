import { Pool } from 'pg';
import { File } from '@bookmark-manager/shared';

/**
 * Repository for file operations
 */
export class FileRepository {
  constructor(private pool: Pool) {}

  /**
   * Create a new file record
   */
  async create(data: Partial<File>): Promise<File> {
    const query = `
      INSERT INTO files (owner_id, bookmark_id, filename, mime_type, size_bytes, s3_path)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id, 
        owner_id as "ownerId", 
        bookmark_id as "bookmarkId",
        filename, 
        mime_type as "mimeType", 
        size_bytes as "sizeBytes", 
        s3_path as "s3Path",
        created_at as "createdAt"
    `;

    const values = [
      data.ownerId,
      data.bookmarkId || null,
      data.filename,
      data.mimeType,
      data.sizeBytes,
      data.s3Path,
    ];

    const result = await this.pool.query(query, values);
    const row = result.rows[0];
    
    // Convert sizeBytes to number (PostgreSQL returns BIGINT as string)
    return {
      ...row,
      sizeBytes: parseInt(row.sizeBytes, 10),
    };
  }

  /**
   * Find a file by ID
   */
  async findById(fileId: string): Promise<File | null> {
    const query = `
      SELECT 
        id, 
        owner_id as "ownerId", 
        bookmark_id as "bookmarkId",
        filename, 
        mime_type as "mimeType", 
        size_bytes as "sizeBytes", 
        s3_path as "s3Path",
        created_at as "createdAt"
      FROM files
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [fileId]);
    if (!result.rows[0]) return null;
    
    const row = result.rows[0];
    // Convert sizeBytes to number (PostgreSQL returns BIGINT as string)
    return {
      ...row,
      sizeBytes: parseInt(row.sizeBytes, 10),
    };
  }

  /**
   * Find files by owner
   */
  async findByOwner(ownerId: string, limit: number = 50, offset: number = 0): Promise<File[]> {
    const query = `
      SELECT 
        id, 
        owner_id as "ownerId", 
        bookmark_id as "bookmarkId",
        filename, 
        mime_type as "mimeType", 
        size_bytes as "sizeBytes", 
        s3_path as "s3Path",
        created_at as "createdAt"
      FROM files
      WHERE owner_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(query, [ownerId, limit, offset]);
    // Convert sizeBytes to number for all rows
    return result.rows.map(row => ({
      ...row,
      sizeBytes: parseInt(row.sizeBytes, 10),
    }));
  }

  /**
   * Find all files by user ID (for backups)
   */
  async findByUserId(userId: string): Promise<File[]> {
    const query = `
      SELECT 
        id, 
        owner_id as "ownerId", 
        bookmark_id as "bookmarkId",
        filename, 
        mime_type as "mimeType", 
        size_bytes as "sizeBytes", 
        s3_path as "s3Path",
        created_at as "createdAt"
      FROM files
      WHERE owner_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);
    // Convert sizeBytes to number for all rows
    return result.rows.map(row => ({
      ...row,
      sizeBytes: parseInt(row.sizeBytes, 10),
    }));
  }

  /**
   * Find files by bookmark
   */
  async findByBookmark(bookmarkId: string): Promise<File[]> {
    const query = `
      SELECT 
        id, 
        owner_id as "ownerId", 
        bookmark_id as "bookmarkId",
        filename, 
        mime_type as "mimeType", 
        size_bytes as "sizeBytes", 
        s3_path as "s3Path",
        created_at as "createdAt"
      FROM files
      WHERE bookmark_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [bookmarkId]);
    // Convert sizeBytes to number for all rows
    return result.rows.map(row => ({
      ...row,
      sizeBytes: parseInt(row.sizeBytes, 10),
    }));
  }

  /**
   * Delete a file record
   */
  async delete(fileId: string): Promise<boolean> {
    const query = 'DELETE FROM files WHERE id = $1';
    const result = await this.pool.query(query, [fileId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get total storage used by a user
   */
  async getTotalStorageByOwner(ownerId: string): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(size_bytes), 0) as total
      FROM files
      WHERE owner_id = $1
    `;

    const result = await this.pool.query(query, [ownerId]);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Count files by owner
   */
  async countByOwner(ownerId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM files WHERE owner_id = $1';
    const result = await this.pool.query(query, [ownerId]);
    return parseInt(result.rows[0].count, 10);
  }
}
