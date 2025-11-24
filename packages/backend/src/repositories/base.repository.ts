import { Pool } from 'pg';

/**
 * Convert camelCase to snake_case
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter, index) =>
    index === 0 ? letter.toLowerCase() : `_${letter.toLowerCase()}`
  );
}

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Base repository providing common CRUD operations
 */
export abstract class BaseRepository<T> {
  constructor(
    protected pool: Pool,
    protected tableName: string
  ) {}

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<T | null> {
    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find all records with optional filtering
   */
  async findAll(filters?: Record<string, any>): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (filters && Object.keys(filters).length > 0) {
      const conditions = Object.keys(filters).map((key, index) => {
        params.push(filters[key]);
        return `${toSnakeCase(key)} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const dbKeys = keys.map(toSnakeCase);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${dbKeys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return this.mapRow(result.rows[0]);
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) {
      return this.findById(id);
    }

    const setClause = keys
      .map((key, index) => `${toSnakeCase(key)} = $${index + 2}`)
      .join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [id, ...values]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Count records with optional filtering
   */
  async count(filters?: Record<string, any>): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${this.tableName}`;
    const params: any[] = [];

    if (filters && Object.keys(filters).length > 0) {
      const conditions = Object.keys(filters).map((key, index) => {
        params.push(filters[key]);
        return `${toSnakeCase(key)} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Map database row to domain model
   * Override in subclasses for custom mapping
   */
  protected mapRow(row: any): T {
    const mapped: any = {};
    for (const key in row) {
      const camelKey = toCamelCase(key);
      mapped[camelKey] = row[key];
    }
    return mapped as T;
  }
}
