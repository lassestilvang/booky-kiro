/**
 * Concurrent User Load Test
 *
 * Tests the system's ability to handle multiple concurrent users performing
 * various operations (creating bookmarks, searching, managing collections).
 *
 * Requirements: 23.1 - API response times < 200ms (95th percentile)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import {
  config,
  thresholds,
  authenticate,
  authHeaders,
  generateBookmark,
  generateCollection,
  generateSearchQuery,
} from './config.js';

// Custom metrics
const errorRate = new Rate('errors');

// Load test configuration
export const options = {
  stages: [
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Spike to 100 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    ...thresholds,
    'http_req_duration{operation:create_bookmark}': ['p(95)<200'],
    'http_req_duration{operation:list_bookmarks}': ['p(95)<200'],
    'http_req_duration{operation:search}': ['p(95)<200'],
    'http_req_duration{operation:create_collection}': ['p(95)<200'],
  },
};

// Setup function - runs once per VU
export function setup() {
  // Authenticate and return token
  const token = authenticate(http);
  return { token };
}

// Main test function - runs repeatedly for each VU
export default function (data) {
  const token = data.token;
  const headers = authHeaders(token);

  // Scenario 1: Create a bookmark (30% of operations)
  if (Math.random() < 0.3) {
    const bookmark = generateBookmark(__VU * 1000 + __ITER);
    const createRes = http.post(
      `${config.apiBaseUrl}/v1/bookmarks`,
      JSON.stringify(bookmark),
      {
        ...headers,
        tags: { operation: 'create_bookmark' },
      }
    );

    const createSuccess = check(createRes, {
      'create bookmark status is 201': (r) => r.status === 201,
      'create bookmark has id': (r) => JSON.parse(r.body).id !== undefined,
    });

    errorRate.add(!createSuccess);
  }

  // Scenario 2: List bookmarks (40% of operations)
  if (Math.random() < 0.4) {
    const listRes = http.get(
      `${config.apiBaseUrl}/v1/bookmarks?page=1&limit=20`,
      {
        ...headers,
        tags: { operation: 'list_bookmarks' },
      }
    );

    const listSuccess = check(listRes, {
      'list bookmarks status is 200': (r) => r.status === 200,
      'list bookmarks returns array': (r) =>
        Array.isArray(JSON.parse(r.body).results),
    });

    errorRate.add(!listSuccess);
  }

  // Scenario 3: Search bookmarks (20% of operations)
  if (Math.random() < 0.2) {
    const query = generateSearchQuery();
    const searchRes = http.get(`${config.apiBaseUrl}/v1/search?q=${query}`, {
      ...headers,
      tags: { operation: 'search' },
    });

    const searchSuccess = check(searchRes, {
      'search status is 200': (r) => r.status === 200,
      'search returns results': (r) => JSON.parse(r.body).results !== undefined,
    });

    errorRate.add(!searchSuccess);
  }

  // Scenario 4: Create collection (10% of operations)
  if (Math.random() < 0.1) {
    const collection = generateCollection(__VU * 100 + __ITER);
    const collectionRes = http.post(
      `${config.apiBaseUrl}/v1/collections`,
      JSON.stringify(collection),
      {
        ...headers,
        tags: { operation: 'create_collection' },
      }
    );

    const collectionSuccess = check(collectionRes, {
      'create collection status is 201': (r) => r.status === 201,
      'create collection has id': (r) => JSON.parse(r.body).id !== undefined,
    });

    errorRate.add(!collectionSuccess);
  }

  // Think time - simulate user reading/thinking
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

// Teardown function - runs once after all VUs complete
export function teardown(data) {
  console.log('Load test completed');
}
