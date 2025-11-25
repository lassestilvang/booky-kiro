/**
 * Search Performance Test
 *
 * Tests search query latency with a large dataset (100k bookmarks).
 * Validates full-text search, filtering, and relevance ranking performance.
 *
 * Requirements: 23.3 - Search query latency < 200ms for 100k bookmarks
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import {
  config,
  authHeaders,
  authenticate,
  generateSearchQuery,
  generateTag,
} from './config.js';

// Custom metrics
const searchLatency = new Trend('search_latency');
const fulltextSearchLatency = new Trend('fulltext_search_latency');
const filteredSearchLatency = new Trend('filtered_search_latency');
const errorRate = new Rate('errors');

// Load test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 30 }, // Ramp up to 30 users
    { duration: '5m', target: 30 }, // Stay at 30 users
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    // Search query latency < 200ms for 100k bookmarks (Requirement 23.3)
    search_latency: ['p(95)<200', 'p(99)<300'],
    fulltext_search_latency: ['p(95)<200', 'p(99)<300'],
    filtered_search_latency: ['p(95)<200', 'p(99)<300'],

    // Error rate < 1%
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

// Setup function
export function setup() {
  const token = authenticate(http);

  // Verify dataset size
  const headers = authHeaders(token);
  const statsRes = http.get(`${config.apiBaseUrl}/v1/user/stats`, headers);

  if (statsRes.status === 200) {
    const stats = JSON.parse(statsRes.body);
    console.log(`Testing with ${stats.totalBookmarks} bookmarks`);

    if (stats.totalBookmarks < 100000) {
      console.warn(
        'Warning: Dataset has fewer than 100k bookmarks. Run seed:large-dataset first.'
      );
    }
  }

  return { token };
}

// Main test function
export default function (data) {
  const token = data.token;
  const headers = authHeaders(token);

  // Test 1: Basic title/metadata search (50% of queries)
  if (Math.random() < 0.5) {
    const query = generateSearchQuery();
    const startTime = Date.now();

    const searchRes = http.get(
      `${config.apiBaseUrl}/v1/search?q=${query}&limit=20`,
      headers
    );

    const duration = Date.now() - startTime;
    searchLatency.add(duration);

    const success = check(searchRes, {
      'basic search status is 200': (r) => r.status === 200,
      'basic search returns results': (r) =>
        JSON.parse(r.body).results !== undefined,
      'basic search latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 2: Full-text search (Pro feature) (25% of queries)
  if (Math.random() < 0.25) {
    const query = generateSearchQuery();
    const startTime = Date.now();

    const fulltextRes = http.get(
      `${config.apiBaseUrl}/v1/search?q=${query}&fulltext=true&limit=20`,
      headers
    );

    const duration = Date.now() - startTime;
    fulltextSearchLatency.add(duration);

    const success = check(fulltextRes, {
      'fulltext search status is 200 or 403': (r) =>
        r.status === 200 || r.status === 403,
      'fulltext search latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 3: Filtered search with multiple criteria (25% of queries)
  if (Math.random() < 0.25) {
    const query = generateSearchQuery();
    const tag = generateTag();
    const type = ['article', 'video', 'image'][Math.floor(Math.random() * 3)];
    const startTime = Date.now();

    const filteredRes = http.get(
      `${config.apiBaseUrl}/v1/search?q=${query}&tags=${tag}&type=${type}&limit=20`,
      headers
    );

    const duration = Date.now() - startTime;
    filteredSearchLatency.add(duration);

    const success = check(filteredRes, {
      'filtered search status is 200': (r) => r.status === 200,
      'filtered search returns results': (r) =>
        JSON.parse(r.body).results !== undefined,
      'filtered search latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 4: Fuzzy search (test typo tolerance)
  if (Math.random() < 0.1) {
    // Intentionally misspelled queries
    const fuzzyQueries = ['javascrpt', 'reactt', 'typescrpt', 'databse'];
    const query = fuzzyQueries[Math.floor(Math.random() * fuzzyQueries.length)];

    const fuzzyRes = http.get(
      `${config.apiBaseUrl}/v1/search?q=${query}&limit=20`,
      headers
    );

    check(fuzzyRes, {
      'fuzzy search status is 200': (r) => r.status === 200,
      'fuzzy search returns results': (r) => {
        const body = JSON.parse(r.body);
        return body.results !== undefined && body.results.length > 0;
      },
    });
  }

  // Test 5: Pagination performance
  if (Math.random() < 0.1) {
    const query = generateSearchQuery();
    const page = Math.floor(Math.random() * 10) + 1; // Pages 1-10

    const paginationRes = http.get(
      `${config.apiBaseUrl}/v1/search?q=${query}&page=${page}&limit=20`,
      headers
    );

    check(paginationRes, {
      'pagination search status is 200': (r) => r.status === 200,
      'pagination returns correct page': (r) => {
        const body = JSON.parse(r.body);
        return body.page === page;
      },
    });
  }

  // Think time
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

// Teardown function
export function teardown(data) {
  console.log('Search performance test completed');
}
