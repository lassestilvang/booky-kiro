import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pool from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Get list of applied migrations
    const appliedResult = await client.query(
      'SELECT migration_name FROM schema_migrations ORDER BY migration_name'
    );
    const appliedMigrations = new Set(
      appliedResult.rows.map((row) => row.migration_name)
    );

    // Get list of migration files
    const migrationsDir = join(__dirname, '../../migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    // Run pending migrations
    for (const file of migrationFiles) {
      if (!appliedMigrations.has(file)) {
        console.log(`Running migration: ${file}`);

        const migrationPath = join(migrationsDir, file);
        const sql = readFileSync(migrationPath, 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          console.log(`✓ Migration ${file} applied successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`✗ Migration ${file} failed:`, error);
          throw error;
        }
      } else {
        console.log(`Skipping already applied migration: ${file}`);
      }
    }

    console.log('All migrations completed successfully');
  } finally {
    client.release();
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}
