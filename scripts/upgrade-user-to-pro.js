/**
 * Upgrade User to Pro Plan Script
 *
 * Upgrades a user account to Pro tier directly in the database.
 * This is useful for demo purposes and testing Pro features.
 *
 * Usage: node scripts/upgrade-user-to-pro.js [email]
 */

const { Client } = require('../packages/backend/node_modules/pg');
const dotenv = require('../packages/backend/node_modules/dotenv');
dotenv.config({ path: './packages/backend/.env' });

const userEmail = process.argv[2] || 'demo@example.com';

async function upgradeUserToPro() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'bookmark_manager',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Update user plan to 'pro'
    const result = await client.query(
      `UPDATE users SET plan = 'pro', updated_at = NOW() WHERE email = $1 RETURNING id, email, name, plan`,
      [userEmail]
    );

    if (result.rows.length === 0) {
      console.error(`✗ User not found: ${userEmail}`);
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('\n✓ User upgraded to Pro plan successfully!');
    console.log('\nUser details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Plan: ${user.plan}`);
  } catch (error) {
    console.error('✗ Failed to upgrade user:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

upgradeUserToPro();
