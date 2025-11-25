/**
 * Seed Large Dataset Script
 *
 * Creates 100k bookmarks for load testing search performance.
 * Run this before executing search-performance.js load test.
 *
 * Usage: node scripts/seed-large-dataset.js
 */

const http = require('http');
const https = require('https');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'loadtest@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'LoadTest123!';
const TARGET_BOOKMARKS = parseInt(process.env.TARGET_BOOKMARKS || '100000', 10);
const BATCH_SIZE = 100;
const CONCURRENT_BATCHES = 10;

// Sample data for generating realistic bookmarks
const domains = [
  'github.com',
  'stackoverflow.com',
  'medium.com',
  'dev.to',
  'hackernoon.com',
  'freecodecamp.org',
  'css-tricks.com',
  'smashingmagazine.com',
  'alistapart.com',
  'techcrunch.com',
];

const topics = [
  'javascript',
  'typescript',
  'react',
  'vue',
  'angular',
  'node.js',
  'python',
  'golang',
  'rust',
  'docker',
  'kubernetes',
  'aws',
  'database',
  'postgresql',
  'mongodb',
  'redis',
  'testing',
  'security',
  'performance',
  'architecture',
];

const types = ['article', 'video', 'image', 'document'];

const tags = [
  'programming',
  'web-development',
  'backend',
  'frontend',
  'devops',
  'testing',
  'documentation',
  'tutorial',
  'reference',
  'tools',
  'best-practices',
  'performance',
  'security',
  'architecture',
  'design-patterns',
];

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

// Authenticate and get token
async function authenticate() {
  console.log('Authenticating...');

  const response = await makeRequest(
    `${API_BASE_URL}/v1/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    })
  );

  if (response.status !== 200) {
    throw new Error(
      `Authentication failed: ${response.status} ${response.body}`
    );
  }

  const body = JSON.parse(response.body);
  console.log('Authenticated successfully');
  return body.accessToken;
}

// Generate a realistic bookmark
function generateBookmark(index) {
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const type = types[Math.floor(Math.random() * types.length)];

  // Select 2-4 random tags
  const numTags = Math.floor(Math.random() * 3) + 2;
  const selectedTags = [];
  for (let i = 0; i < numTags; i++) {
    const tag = tags[Math.floor(Math.random() * tags.length)];
    if (!selectedTags.includes(tag)) {
      selectedTags.push(tag);
    }
  }

  return {
    url: `https://${domain}/${topic}-${index}`,
    title: `${topic.charAt(0).toUpperCase() + topic.slice(1)} Tutorial ${index}`,
    excerpt: `Learn about ${topic} with this comprehensive guide. This article covers best practices, common pitfalls, and advanced techniques for ${topic} development.`,
    type: type,
    domain: domain,
    tags: selectedTags,
  };
}

// Create a batch of bookmarks
async function createBookmarkBatch(token, startIndex, batchSize) {
  const bookmarks = [];
  for (let i = 0; i < batchSize; i++) {
    bookmarks.push(generateBookmark(startIndex + i));
  }

  const promises = bookmarks.map((bookmark) =>
    makeRequest(
      `${API_BASE_URL}/v1/bookmarks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      JSON.stringify(bookmark)
    ).catch((err) => {
      console.error(`Failed to create bookmark: ${err.message}`);
      return null;
    })
  );

  const results = await Promise.all(promises);
  const successful = results.filter((r) => r && r.status === 201).length;
  return successful;
}

// Main seeding function
async function seedDatabase() {
  console.log(`Starting database seeding: ${TARGET_BOOKMARKS} bookmarks`);
  console.log(
    `Batch size: ${BATCH_SIZE}, Concurrent batches: ${CONCURRENT_BATCHES}`
  );

  const token = await authenticate();

  let totalCreated = 0;
  const startTime = Date.now();

  while (totalCreated < TARGET_BOOKMARKS) {
    const batchPromises = [];

    for (let i = 0; i < CONCURRENT_BATCHES; i++) {
      const startIndex = totalCreated + i * BATCH_SIZE;
      if (startIndex >= TARGET_BOOKMARKS) break;

      const batchSize = Math.min(BATCH_SIZE, TARGET_BOOKMARKS - startIndex);
      batchPromises.push(createBookmarkBatch(token, startIndex, batchSize));
    }

    const results = await Promise.all(batchPromises);
    const batchTotal = results.reduce((sum, count) => sum + count, 0);
    totalCreated += batchTotal;

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = totalCreated / elapsed;
    const remaining = TARGET_BOOKMARKS - totalCreated;
    const eta = remaining / rate;

    console.log(
      `Progress: ${totalCreated}/${TARGET_BOOKMARKS} (${((totalCreated / TARGET_BOOKMARKS) * 100).toFixed(1)}%) ` +
        `Rate: ${rate.toFixed(1)}/s ETA: ${Math.ceil(eta)}s`
    );
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\nSeeding completed!`);
  console.log(`Total bookmarks created: ${totalCreated}`);
  console.log(`Total time: ${totalTime.toFixed(1)}s`);
  console.log(
    `Average rate: ${(totalCreated / totalTime).toFixed(1)} bookmarks/second`
  );
}

// Run the seeding
seedDatabase().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
