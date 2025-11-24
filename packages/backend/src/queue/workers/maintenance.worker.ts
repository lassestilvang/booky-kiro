import { Worker, Job } from 'bullmq';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
  QUEUE_NAMES,
  MaintenanceJobData,
  createRedisConnection,
} from '../config.js';
import { BookmarkRepository } from '../../repositories/bookmark.repository.js';

/**
 * Maintenance Worker
 *
 * Processes maintenance tasks:
 * 1. Duplicate detection - normalize URLs and detect duplicates
 * 2. Broken link scanning - check URLs and mark broken bookmarks
 */

// Initialize database pool
const dbPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bookmark_manager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
});

const bookmarkRepo = new BookmarkRepository(dbPool);

/**
 * Normalize URL by removing tracking parameters and fragments
 * Common tracking parameters: utm_*, fbclid, gclid, etc.
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Remove fragment (hash)
    urlObj.hash = '';

    // List of tracking parameters to remove
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'msclkid',
      'mc_cid',
      'mc_eid',
      '_ga',
      'ref',
      'source',
    ];

    // Remove tracking parameters
    trackingParams.forEach((param) => {
      urlObj.searchParams.delete(param);
    });

    // Sort remaining parameters for consistency
    const sortedParams = new URLSearchParams(
      Array.from(urlObj.searchParams.entries()).sort()
    );
    urlObj.search = sortedParams.toString();

    // Convert to lowercase for case-insensitive comparison
    return urlObj.toString().toLowerCase();
  } catch (error) {
    // If URL parsing fails, return original URL
    console.error(`Failed to normalize URL: ${url}`, error);
    return url.toLowerCase();
  }
}

/**
 * Compute content hash from text content
 */
export function computeContentHash(content: string): string {
  // Normalize content: remove whitespace, lowercase
  const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();

  // Compute SHA-256 hash
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Process duplicate detection for a user
 */
async function detectDuplicates(userId?: string): Promise<void> {
  console.log(
    `Starting duplicate detection${userId ? ` for user ${userId}` : ' for all users'}`
  );

  // Get all bookmarks for the user (or all users if no userId)
  const query = userId
    ? 'SELECT * FROM bookmarks WHERE owner_id = $1 ORDER BY created_at ASC'
    : 'SELECT * FROM bookmarks ORDER BY owner_id, created_at ASC';

  const params = userId ? [userId] : [];
  const result = await dbPool.query(query, params);
  const bookmarks = result.rows;

  console.log(
    `Processing ${bookmarks.length} bookmarks for duplicate detection`
  );

  // Track normalized URLs and content hashes per user
  const urlMap = new Map<string, Map<string, string>>(); // userId -> normalizedUrl -> bookmarkId
  const contentHashMap = new Map<string, Map<string, string>>(); // userId -> contentHash -> bookmarkId

  let duplicatesFound = 0;

  for (const bookmark of bookmarks) {
    const ownerId = bookmark.owner_id;

    // Initialize maps for this user if needed
    if (!urlMap.has(ownerId)) {
      urlMap.set(ownerId, new Map());
    }
    if (!contentHashMap.has(ownerId)) {
      contentHashMap.set(ownerId, new Map());
    }

    const userUrlMap = urlMap.get(ownerId)!;
    const userContentHashMap = contentHashMap.get(ownerId)!;

    // Normalize URL
    const normalizedUrl = normalizeUrl(bookmark.url);

    // Check for URL duplicates
    if (userUrlMap.has(normalizedUrl)) {
      // This is a duplicate by URL
      console.log(
        `Found URL duplicate: ${bookmark.id} (original: ${userUrlMap.get(normalizedUrl)})`
      );
      await bookmarkRepo.markAsDuplicate(bookmark.id);
      duplicatesFound++;
    } else {
      // Store this URL
      userUrlMap.set(normalizedUrl, bookmark.id);
    }

    // Check for content hash duplicates (if snapshot exists)
    if (bookmark.content_snapshot_path) {
      // For now, we'll use the excerpt as a proxy for content
      // In a full implementation, we'd fetch the actual snapshot content
      const contentForHash = bookmark.excerpt || bookmark.title;
      const contentHash = computeContentHash(contentForHash);

      if (userContentHashMap.has(contentHash)) {
        // This is a duplicate by content
        console.log(
          `Found content duplicate: ${bookmark.id} (original: ${userContentHashMap.get(contentHash)})`
        );
        await bookmarkRepo.markAsDuplicate(bookmark.id);
        duplicatesFound++;
      } else {
        // Store this content hash
        userContentHashMap.set(contentHash, bookmark.id);
      }
    }
  }

  console.log(
    `Duplicate detection complete. Found ${duplicatesFound} duplicates.`
  );
}

/**
 * Process broken link scanning for a user
 */
async function scanBrokenLinks(userId?: string): Promise<void> {
  console.log(
    `Starting broken link scan${userId ? ` for user ${userId}` : ' for all users'}`
  );

  // Get all bookmarks for the user (or all users if no userId)
  const query = userId
    ? 'SELECT * FROM bookmarks WHERE owner_id = $1'
    : 'SELECT * FROM bookmarks';

  const params = userId ? [userId] : [];
  const result = await dbPool.query(query, params);
  const bookmarks = result.rows;

  console.log(`Scanning ${bookmarks.length} bookmarks for broken links`);

  let brokenLinksFound = 0;
  let fixedLinks = 0;

  for (const bookmark of bookmarks) {
    try {
      // Request URL with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(bookmark.url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; BookmarkManager/1.0; +https://bookmarkmanager.com)',
        },
      });

      clearTimeout(timeoutId);

      // Check status code
      if (response.status >= 400) {
        // 4xx or 5xx error
        console.log(
          `Broken link detected: ${bookmark.url} (status: ${response.status})`
        );
        await bookmarkRepo.markAsBroken(bookmark.id, true);
        brokenLinksFound++;
      } else if (bookmark.is_broken) {
        // Link was previously broken but is now working
        console.log(`Link fixed: ${bookmark.url}`);
        await bookmarkRepo.markAsBroken(bookmark.id, false);
        fixedLinks++;
      }
    } catch (error: any) {
      // Timeout or network error
      if (error.name === 'AbortError') {
        console.log(`Timeout for URL: ${bookmark.url}`);
      } else {
        console.log(
          `Network error for URL: ${bookmark.url} - ${error.message}`
        );
      }

      // Mark as broken
      await bookmarkRepo.markAsBroken(bookmark.id, true);
      brokenLinksFound++;
    }

    // Add small delay to avoid overwhelming servers
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(
    `Broken link scan complete. Found ${brokenLinksFound} broken links, fixed ${fixedLinks} links.`
  );
}

/**
 * Process maintenance job
 */
async function processMaintenanceJob(job: Job<MaintenanceJobData>) {
  const { type, userId } = job.data;

  console.log(
    `Processing maintenance job: ${type}${userId ? ` for user ${userId}` : ''}`
  );

  try {
    switch (type) {
      case 'duplicate-detection':
        await detectDuplicates(userId);
        break;

      case 'broken-link-scan':
        await scanBrokenLinks(userId);
        break;

      default:
        throw new Error(`Unknown maintenance job type: ${type}`);
    }

    return {
      type,
      userId,
      status: 'completed',
      message: `${type} completed successfully`,
    };
  } catch (error) {
    console.error(`Error processing maintenance job ${type}:`, error);
    throw error; // Let BullMQ handle retries
  }
}

// Create and export the worker
export const maintenanceWorker = new Worker(
  QUEUE_NAMES.MAINTENANCE,
  processMaintenanceJob,
  {
    connection: createRedisConnection(),
    concurrency: 2, // Lower concurrency for maintenance tasks
    limiter: {
      max: 5,
      duration: 1000,
    },
  }
);

// Worker event handlers
maintenanceWorker.on('completed', (job) => {
  console.log(`Maintenance job ${job.id} completed successfully`);
});

maintenanceWorker.on('failed', (job, err) => {
  console.error(`Maintenance job ${job?.id} failed:`, err.message);
});

maintenanceWorker.on('error', (err) => {
  console.error('Maintenance worker error:', err);
});

// Graceful shutdown
export async function closeMaintenanceWorker() {
  await maintenanceWorker.close();
  await dbPool.end();
}
