/**
 * API Response Time Test
 *
 * Validates that API response times meet the < 200ms (95th percentile) requirement
 * across all major endpoints under normal load.
 *
 * Requirements: 23.1 - API response times < 200ms (95th percentile)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import {
  config,
  authHeaders,
  authenticate,
  generateBookmark,
  generateCollection,
  generateSearchQuery,
} from './config.js';

// Custom metrics for each endpoint category
const authLatency = new Trend('auth_latency');
const bookmarkReadLatency = new Trend('bookmark_read_latency');
const bookmarkWriteLatency = new Trend('bookmark_write_latency');
const collectionLatency = new Trend('collection_latency');
const searchLatency = new Trend('search_latency');
const tagLatency = new Trend('tag_latency');
const errorRate = new Rate('errors');

// Load test configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 }, // Ramp up
    { duration: '5m', target: 50 }, // Normal load
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    // Overall API response time < 200ms (95th percentile) - Requirement 23.1
    http_req_duration: ['p(95)<200', 'p(99)<300'],

    // Per-endpoint thresholds
    auth_latency: ['p(95)<200'],
    bookmark_read_latency: ['p(95)<200'],
    bookmark_write_latency: ['p(95)<200'],
    collection_latency: ['p(95)<200'],
    search_latency: ['p(95)<200'],
    tag_latency: ['p(95)<200'],

    // Error rate < 1%
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

// Setup function
export function setup() {
  const token = authenticate(http);

  // Create some test data for read operations
  const headers = authHeaders(token);

  // Create a collection
  const collection = generateCollection(1);
  const collectionRes = http.post(
    `${config.apiBaseUrl}/v1/collections`,
    JSON.stringify(collection),
    headers
  );
  const collectionId =
    collectionRes.status === 201 ? JSON.parse(collectionRes.body).id : null;

  // Create some bookmarks
  const bookmarkIds = [];
  for (let i = 0; i < 10; i++) {
    const bookmark = generateBookmark(i);
    if (collectionId) {
      bookmark.collectionId = collectionId;
    }

    const bookmarkRes = http.post(
      `${config.apiBaseUrl}/v1/bookmarks`,
      JSON.stringify(bookmark),
      headers
    );

    if (bookmarkRes.status === 201) {
      bookmarkIds.push(JSON.parse(bookmarkRes.body).id);
    }
  }

  return { token, collectionId, bookmarkIds };
}

// Main test function
export default function (data) {
  const token = data.token;
  const headers = authHeaders(token);
  const { collectionId, bookmarkIds } = data;

  // Test 1: Authentication endpoints (5% of requests)
  if (Math.random() < 0.05) {
    const startTime = Date.now();

    const refreshRes = http.post(
      `${config.apiBaseUrl}/v1/auth/refresh`,
      JSON.stringify({ refreshToken: token }),
      headers
    );

    const duration = Date.now() - startTime;
    authLatency.add(duration);

    const success = check(refreshRes, {
      'auth refresh status is 200 or 401': (r) =>
        r.status === 200 || r.status === 401,
      'auth latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 2: List bookmarks (30% of requests)
  if (Math.random() < 0.3) {
    const startTime = Date.now();

    const listRes = http.get(
      `${config.apiBaseUrl}/v1/bookmarks?page=1&limit=20`,
      headers
    );

    const duration = Date.now() - startTime;
    bookmarkReadLatency.add(duration);

    const success = check(listRes, {
      'list bookmarks status is 200': (r) => r.status === 200,
      'list bookmarks latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 3: Get single bookmark (20% of requests)
  if (Math.random() < 0.2 && bookmarkIds.length > 0) {
    const bookmarkId =
      bookmarkIds[Math.floor(Math.random() * bookmarkIds.length)];
    const startTime = Date.now();

    const getRes = http.get(
      `${config.apiBaseUrl}/v1/bookmarks/${bookmarkId}`,
      headers
    );

    const duration = Date.now() - startTime;
    bookmarkReadLatency.add(duration);

    const success = check(getRes, {
      'get bookmark status is 200': (r) => r.status === 200,
      'get bookmark latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 4: Create bookmark (15% of requests)
  if (Math.random() < 0.15) {
    const bookmark = generateBookmark(__VU * 1000 + __ITER);
    if (collectionId) {
      bookmark.collectionId = collectionId;
    }

    const startTime = Date.now();

    const createRes = http.post(
      `${config.apiBaseUrl}/v1/bookmarks`,
      JSON.stringify(bookmark),
      headers
    );

    const duration = Date.now() - startTime;
    bookmarkWriteLatency.add(duration);

    const success = check(createRes, {
      'create bookmark status is 201': (r) => r.status === 201,
      'create bookmark latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 5: Update bookmark (5% of requests)
  if (Math.random() < 0.05 && bookmarkIds.length > 0) {
    const bookmarkId =
      bookmarkIds[Math.floor(Math.random() * bookmarkIds.length)];
    const updates = {
      title: `Updated Title ${__ITER}`,
      excerpt: `Updated excerpt at ${new Date().toISOString()}`,
    };

    const startTime = Date.now();

    const updateRes = http.put(
      `${config.apiBaseUrl}/v1/bookmarks/${bookmarkId}`,
      JSON.stringify(updates),
      headers
    );

    const duration = Date.now() - startTime;
    bookmarkWriteLatency.add(duration);

    const success = check(updateRes, {
      'update bookmark status is 200': (r) => r.status === 200,
      'update bookmark latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 6: List collections (10% of requests)
  if (Math.random() < 0.1) {
    const startTime = Date.now();

    const listRes = http.get(`${config.apiBaseUrl}/v1/collections`, headers);

    const duration = Date.now() - startTime;
    collectionLatency.add(duration);

    const success = check(listRes, {
      'list collections status is 200': (r) => r.status === 200,
      'list collections latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 7: Search (10% of requests)
  if (Math.random() < 0.1) {
    const query = generateSearchQuery();
    const startTime = Date.now();

    const searchRes = http.get(
      `${config.apiBaseUrl}/v1/search?q=${query}&limit=20`,
      headers
    );

    const duration = Date.now() - startTime;
    searchLatency.add(duration);

    const success = check(searchRes, {
      'search status is 200': (r) => r.status === 200,
      'search latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Test 8: List tags (5% of requests)
  if (Math.random() < 0.05) {
    const startTime = Date.now();

    const tagsRes = http.get(`${config.apiBaseUrl}/v1/tags`, headers);

    const duration = Date.now() - startTime;
    tagLatency.add(duration);

    const success = check(tagsRes, {
      'list tags status is 200': (r) => r.status === 200,
      'list tags latency < 200ms': () => duration < 200,
    });

    errorRate.add(!success);
  }

  // Think time
  sleep(Math.random() * 1 + 0.5); // 0.5-1.5 seconds
}

// Teardown function
export function teardown(data) {
  console.log('API response time test completed');
}
