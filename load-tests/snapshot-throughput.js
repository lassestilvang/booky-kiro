/**
 * Snapshot Processing Throughput Test
 *
 * Tests the background worker's ability to process snapshot jobs concurrently.
 * Validates that 10 concurrent jobs can be processed without degradation.
 *
 * Requirements: 23.3 - Snapshot processing: 10 concurrent jobs without degradation
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  config,
  authHeaders,
  authenticate,
  generateBookmark,
} from './config.js';

// Custom metrics
const snapshotJobsCreated = new Counter('snapshot_jobs_created');
const snapshotJobsCompleted = new Counter('snapshot_jobs_completed');
const snapshotProcessingTime = new Trend('snapshot_processing_time');
const queueDepth = new Trend('queue_depth');
const errorRate = new Rate('errors');

// Load test configuration
export const options = {
  scenarios: {
    // Scenario 1: Create bookmarks that trigger snapshot jobs
    create_snapshots: {
      executor: 'constant-vus',
      vus: 10, // 10 concurrent users creating bookmarks
      duration: '5m',
      exec: 'createBookmarksWithSnapshots',
    },

    // Scenario 2: Monitor job queue and completion
    monitor_queue: {
      executor: 'constant-vus',
      vus: 1, // Single monitoring thread
      duration: '5m',
      exec: 'monitorJobQueue',
      startTime: '10s', // Start after some jobs are queued
    },
  },
  thresholds: {
    // Snapshot processing should complete within reasonable time
    snapshot_processing_time: ['p(95)<30000'], // 30 seconds

    // Queue depth should not grow unbounded
    queue_depth: ['p(95)<100'],

    // Error rate < 1%
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

// Setup function
export function setup() {
  const token = authenticate(http);
  return { token };
}

// Scenario 1: Create bookmarks that trigger snapshot jobs
export function createBookmarksWithSnapshots(data) {
  const token = data.token;
  const headers = authHeaders(token);

  // Create a bookmark with a real URL that will trigger snapshot processing
  const bookmark = {
    url: `https://example.com/article-${__VU}-${__ITER}`,
    title: `Snapshot Test Article ${__VU}-${__ITER}`,
    excerpt: 'This bookmark will trigger snapshot processing',
    type: 'article',
    tags: ['snapshot-test'],
  };

  const createRes = http.post(
    `${config.apiBaseUrl}/v1/bookmarks`,
    JSON.stringify(bookmark),
    headers
  );

  const success = check(createRes, {
    'create bookmark status is 201': (r) => r.status === 201,
    'bookmark has id': (r) => JSON.parse(r.body).id !== undefined,
  });

  if (success) {
    snapshotJobsCreated.add(1);
    const bookmarkId = JSON.parse(createRes.body).id;

    // Poll for snapshot completion
    const startTime = Date.now();
    let snapshotCompleted = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 attempts * 1 second = 60 seconds max wait

    while (!snapshotCompleted && attempts < maxAttempts) {
      sleep(1);
      attempts++;

      const statusRes = http.get(
        `${config.apiBaseUrl}/v1/bookmarks/${bookmarkId}`,
        headers
      );

      if (statusRes.status === 200) {
        const bookmark = JSON.parse(statusRes.body);
        if (bookmark.contentSnapshotPath) {
          snapshotCompleted = true;
          const processingTime = Date.now() - startTime;
          snapshotProcessingTime.add(processingTime);
          snapshotJobsCompleted.add(1);
        }
      }
    }

    if (!snapshotCompleted) {
      console.warn(
        `Snapshot for bookmark ${bookmarkId} did not complete within 60 seconds`
      );
      errorRate.add(1);
    }
  } else {
    errorRate.add(1);
  }

  // Think time between bookmark creations
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Scenario 2: Monitor job queue depth
export function monitorJobQueue(data) {
  const token = data.token;
  const headers = authHeaders(token);

  // Query for bookmarks with pending snapshots
  const pendingRes = http.get(
    `${config.apiBaseUrl}/v1/bookmarks?contentIndexed=false&limit=100`,
    headers
  );

  if (pendingRes.status === 200) {
    const body = JSON.parse(pendingRes.body);
    const pendingCount = body.total || 0;
    queueDepth.add(pendingCount);

    // Log queue depth periodically
    if (__ITER % 10 === 0) {
      console.log(`Queue depth: ${pendingCount} pending snapshots`);
    }
  }

  sleep(5); // Check every 5 seconds
}

// Teardown function
export function teardown(data) {
  console.log('Snapshot throughput test completed');
  console.log(`Total jobs created: ${snapshotJobsCreated.value}`);
  console.log(`Total jobs completed: ${snapshotJobsCompleted.value}`);
}
