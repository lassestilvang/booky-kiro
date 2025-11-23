import { Worker, Job } from 'bullmq';
import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { Client as MinioClient } from 'minio';
import { Pool } from 'pg';
import {
  QUEUE_NAMES,
  SnapshotJobData,
  createRedisConnection,
  enqueueIndexJob,
} from '../config.js';
import { BookmarkRepository } from '../../repositories/bookmark.repository.js';

/**
 * Snapshot Worker
 * 
 * Processes snapshot jobs for Pro users:
 * 1. Fetch page HTML with Playwright
 * 2. Extract main content (remove ads, nav, etc.)
 * 3. Generate screenshot thumbnail
 * 4. Store snapshot in S3/MinIO
 * 5. Update bookmark record with snapshot paths
 * 6. Enqueue indexing job
 */

// Initialize MinIO client
const minioClient = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

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

// Bucket name for snapshots
const SNAPSHOT_BUCKET = process.env.MINIO_SNAPSHOT_BUCKET || 'snapshots';

// Browser instance (reused across jobs)
let browserInstance: Browser | null = null;

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

/**
 * Fetch page HTML and screenshot
 */
async function fetchPage(url: string): Promise<{ html: string; screenshot: Buffer }> {
  const browser = await getBrowser();
  const page: Page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (compatible; BookmarkManager/1.0; +https://bookmarkmanager.com)',
  });

  try {
    // Navigate to page with timeout
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait a bit for dynamic content
    await page.waitForTimeout(1000);

    // Get HTML content
    const html = await page.content();

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      fullPage: false, // Only visible viewport
    });

    return { html, screenshot };
  } finally {
    await page.close();
  }
}

/**
 * Extract main content from HTML and strip boilerplate
 * Removes common boilerplate elements like navigation, ads, footers
 */
function extractMainContent(html: string): string {
  const $ = cheerio.load(html);

  // Remove common boilerplate elements
  const boilerplateSelectors = [
    'nav',
    'header',
    'footer',
    '.navigation',
    '.nav',
    '.menu',
    '.sidebar',
    '.advertisement',
    '.ad',
    '.ads',
    '.social-share',
    '.comments',
    '.related-posts',
    '.cookie-banner',
    '.popup',
    '.modal',
    'script',
    'style',
    'iframe',
    'noscript',
  ];

  boilerplateSelectors.forEach((selector) => {
    $(selector).remove();
  });

  // Try to find main content area
  const mainContentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.main-content',
    '.article-content',
    '.post-content',
    '#content',
    '#main',
  ];

  let mainContent = '';
  for (const selector of mainContentSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      mainContent = element.html() || '';
      break;
    }
  }

  // If no main content found, use body
  if (!mainContent) {
    mainContent = $('body').html() || '';
  }

  // Clean up the HTML
  const cleaned = cheerio.load(mainContent);

  // Remove empty elements
  cleaned('*').each(function () {
    const el = cleaned(this);
    if (el.text().trim() === '' && el.children().length === 0) {
      el.remove();
    }
  });

  return cleaned.html() || '';
}

/**
 * Store snapshot and thumbnail in MinIO
 */
async function storeSnapshot(
  userId: string,
  bookmarkId: string,
  html: string,
  screenshot: Buffer
): Promise<{ snapshotPath: string; thumbnailPath: string }> {
  // Ensure bucket exists
  const bucketExists = await minioClient.bucketExists(SNAPSHOT_BUCKET);
  if (!bucketExists) {
    await minioClient.makeBucket(SNAPSHOT_BUCKET, 'us-east-1');
  }

  // Paths in MinIO
  const snapshotPath = `${userId}/${bookmarkId}/page.html`;
  const thumbnailPath = `${userId}/${bookmarkId}/thumbnail.jpg`;

  // Upload HTML
  const htmlBuffer = Buffer.from(html, 'utf-8');
  await minioClient.putObject(
    SNAPSHOT_BUCKET,
    snapshotPath,
    htmlBuffer,
    htmlBuffer.length,
    {
      'Content-Type': 'text/html; charset=utf-8',
    }
  );

  // Upload thumbnail
  await minioClient.putObject(
    SNAPSHOT_BUCKET,
    thumbnailPath,
    screenshot,
    screenshot.length,
    {
      'Content-Type': 'image/jpeg',
    }
  );

  return {
    snapshotPath: `${SNAPSHOT_BUCKET}/${snapshotPath}`,
    thumbnailPath: `${SNAPSHOT_BUCKET}/${thumbnailPath}`,
  };
}

/**
 * Process snapshot job
 */
async function processSnapshotJob(job: Job<SnapshotJobData>) {
  const { bookmarkId, url, userId, userPlan } = job.data;

  console.log(
    `Processing snapshot job for bookmark ${bookmarkId}, URL: ${url}, User: ${userId}, Plan: ${userPlan}`
  );

  try {
    // Only process snapshots for Pro users
    if (userPlan !== 'pro') {
      console.log(`Skipping snapshot for free user ${userId}`);
      return {
        bookmarkId,
        status: 'skipped',
        message: 'Snapshots only available for Pro users',
      };
    }

    // 1. Fetch page HTML and screenshot
    console.log(`Fetching page: ${url}`);
    const { html, screenshot } = await fetchPage(url);

    // 2. Extract main content
    console.log(`Extracting main content from ${url}`);
    const cleanedContent = extractMainContent(html);

    // 3. Store snapshot and thumbnail in MinIO
    console.log(`Storing snapshot for bookmark ${bookmarkId}`);
    const { snapshotPath, thumbnailPath } = await storeSnapshot(
      userId,
      bookmarkId,
      cleanedContent,
      screenshot
    );

    // 4. Update bookmark record with snapshot path
    console.log(`Updating bookmark ${bookmarkId} with snapshot path`);
    await bookmarkRepo.updateSnapshotPath(bookmarkId, snapshotPath);

    // Update cover URL with thumbnail if not already set
    const bookmark = await bookmarkRepo.findById(bookmarkId);
    if (bookmark && !bookmark.coverUrl) {
      await dbPool.query(
        'UPDATE bookmarks SET cover_url = $1, updated_at = NOW() WHERE id = $2',
        [thumbnailPath, bookmarkId]
      );
    }

    // 5. Enqueue indexing job
    console.log(`Enqueueing index job for bookmark ${bookmarkId}`);
    await enqueueIndexJob({
      bookmarkId,
      snapshotPath,
      type: bookmark?.type || 'article',
    });

    return {
      bookmarkId,
      status: 'completed',
      snapshotPath,
      thumbnailPath,
      message: 'Snapshot created successfully',
    };
  } catch (error) {
    console.error(`Error processing snapshot for bookmark ${bookmarkId}:`, error);
    throw error; // Let BullMQ handle retries
  }
}

// Create and export the worker
export const snapshotWorker = new Worker(
  QUEUE_NAMES.SNAPSHOT,
  processSnapshotJob,
  {
    connection: createRedisConnection(),
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Worker event handlers
snapshotWorker.on('completed', (job) => {
  console.log(`Snapshot job ${job.id} completed successfully`);
});

snapshotWorker.on('failed', (job, err) => {
  console.error(`Snapshot job ${job?.id} failed:`, err.message);
});

snapshotWorker.on('error', (err) => {
  console.error('Snapshot worker error:', err);
});

// Graceful shutdown
export async function closeSnapshotWorker() {
  await snapshotWorker.close();
  
  // Close browser instance
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
  
  // Close database pool
  await dbPool.end();
}
