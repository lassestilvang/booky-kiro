/**
 * Create Demo User Script
 *
 * Creates a demo user account with Pro plan enabled.
 * This script combines user creation and Pro upgrade.
 *
 * Usage: node scripts/create-demo-user.js
 */

const http = require('http');
const https = require('https');
const { Client } = require('../packages/backend/node_modules/pg');
const dotenv = require('../packages/backend/node_modules/dotenv');
dotenv.config({ path: './packages/backend/.env' });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@example.com';
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Demo123!';
const DEMO_USER_NAME = process.env.DEMO_USER_NAME || 'Demo User';

// HTTP request helper
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = protocol.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body,
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

async function createDemoUser() {
  console.log('='.repeat(60));
  console.log('Creating Demo User with Pro Plan');
  console.log('='.repeat(60));

  try {
    // Step 1: Register user via API
    console.log('\n1. Registering user via API...');
    let response = await makeRequest(
      `${API_BASE_URL}/v1/auth/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      JSON.stringify({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
        name: DEMO_USER_NAME,
      })
    );

    if (response.status === 409) {
      console.log('   User already exists');
    } else if (response.status === 201) {
      console.log('   ✓ User created successfully');
    } else {
      throw new Error(
        `Failed to create user: ${response.status} ${response.body}`
      );
    }

    // Step 2: Upgrade to Pro via database
    console.log('\n2. Upgrading user to Pro plan...');
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bookmark_manager',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    await client.connect();
    const result = await client.query(
      `UPDATE users SET plan = 'pro', updated_at = NOW() WHERE email = $1 RETURNING id, email, name, plan`,
      [DEMO_USER_EMAIL]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found in database');
    }

    const user = result.rows[0];
    console.log('   ✓ User upgraded to Pro plan');
    await client.end();

    // Step 3: Verify login
    console.log('\n3. Verifying login...');
    response = await makeRequest(
      `${API_BASE_URL}/v1/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      JSON.stringify({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
      })
    );

    if (response.status !== 200) {
      throw new Error(`Login failed: ${response.status}`);
    }

    console.log('   ✓ Login successful');

    console.log('\n' + '='.repeat(60));
    console.log('✓ Demo user created successfully!');
    console.log('='.repeat(60));
    console.log('\nUser Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Plan: ${user.plan}`);
    console.log('\nLogin Credentials:');
    console.log(`  Email: ${DEMO_USER_EMAIL}`);
    console.log(`  Password: ${DEMO_USER_PASSWORD}`);
    console.log('\nNext Steps:');
    console.log('  1. Run: node scripts/seed-demo-data.js');
    console.log('  2. Login to the web app with the credentials above');
    console.log('  3. Explore Pro features (highlights, sharing, backups)');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n✗ Failed to create demo user:', error.message);
    process.exit(1);
  }
}

createDemoUser();
