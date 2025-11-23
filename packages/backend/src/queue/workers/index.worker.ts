import { Worker, Job } from 'bullmq';
import { Client as MinioClient } from 'minio';
import { Pool } from 'pg';
import * as cheerio from 'cheerio';
// pdf-parse needs to be imported dynamically due to ESM/CJS compatibility issues
let pdfParse: any = null;
import {
  QUEUE_NAMES,
  IndexJobData,
  createRedisConnection,
} from '../config.js';
import { BookmarkRepository } from '../../repositories/bookmark.repository.js';
import { SearchService, BookmarkSearchDocument } from '../../services/search.service.js';

/**
 * Index Worker
 * 
 * Processes content indexing jobs:
 * 1. Retrieve snapshot from S3/MinIO
 * 2. Extract text based on type (HTML, PDF, etc.)
 * 3. Clean and normalize text
 * 4. Index document in search engine
 * 5. Update bookmark indexed status
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
const searchService = new SearchService();

/**
 * Retrieve snapshot from MinIO
 */
async function retrieveSnapshot(snapshotPath: string): Promise<Buffer> {
  // Parse bucket and object path from snapshotPath
  // Format: "bucket-name/path/to/object"
  const parts = snapshotPath.split('/');
  const bucket = parts[0];
  const objectPath = parts.slice(1).join('/');

  const chunks: Buffer[] = [];
  const stream = await minioClient.getObject(bucket, objectPath);

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Extract text from HTML content
 */
function extractHTMLText(html: string): string {
  const $ = cheerio.load(html);

  // Remove script and style tags
  $('script, style').remove();

  // Get text content
  const text = $('body').text();

  return text;
}

/**
 * Extract text from PDF buffer
 */
async function extractPDFText(buffer: Buffer): Promise<string> {
  try {
    // Lazy load pdf-parse on first use
    if (!pdfParse) {
      const module = await import('pdf-parse');
      pdfParse = module.default || module;
    }
    
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Failed to extract PDF text:', error);
    throw new Error('Failed to extract PDF text');
  }
}

/**
 * Clean and normalize text
 * Removes excessive whitespace, normalizes line breaks, and trims
 */
function cleanText(text: string): string {
  return text
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive whitespace
    .replace(/[ \t]+/g, ' ')
    // Remove excessive line breaks (more than 2)
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    // Trim overall
    .trim();
}

/**
 * Process index job
 */
async function processIndexJob(job: Job<IndexJobData>) {
  const { bookmarkId, snapshotPath, type } = job.data;

  console.log(
    `Processing index job for bookmark ${bookmarkId}, snapshot: ${snapshotPath}, type: ${type}`
  );

  try {
    // 1. Retrieve bookmark details
    const bookmark = await bookmarkRepo.findByIdWithRelations(bookmarkId);
    if (!bookmark) {
      throw new Error(`Bookmark ${bookmarkId} not found`);
    }

    let content: string = '';

    // 2. Retrieve snapshot from MinIO and extract text
    if (snapshotPath) {
      console.log(`Retrieving snapshot from ${snapshotPath}`);
      const snapshotBuffer = await retrieveSnapshot(snapshotPath);

      // 3. Extract text based on type
      if (type === 'file' || type === 'document') {
        // Assume PDF for file/document types
        console.log(`Extracting text from PDF`);
        content = await extractPDFText(snapshotBuffer);
      } else {
        // HTML content for articles, videos, images
        console.log(`Extracting text from HTML`);
        const html = snapshotBuffer.toString('utf-8');
        content = extractHTMLText(html);
      }

      // 4. Clean and normalize text
      console.log(`Cleaning and normalizing text`);
      content = cleanText(content);
    }

    // 5. Prepare search document
    const searchDocument: BookmarkSearchDocument = {
      id: bookmark.id,
      owner_id: bookmark.ownerId,
      collection_id: bookmark.collectionId || null,
      title: bookmark.title,
      url: bookmark.url,
      domain: bookmark.domain,
      excerpt: bookmark.excerpt || null,
      content: content || null,
      tags: bookmark.tags.map((tag) => tag.name),
      type: bookmark.type,
      created_at: Math.floor(bookmark.createdAt.getTime() / 1000),
      updated_at: Math.floor(bookmark.updatedAt.getTime() / 1000),
      has_snapshot: !!bookmark.contentSnapshotPath,
      highlights_text: bookmark.highlights
        .map((h) => `${h.textSelected} ${h.annotationMd || ''}`)
        .join(' ')
        .trim() || null,
    };

    // 6. Index document in search engine
    console.log(`Indexing document in search engine`);
    await searchService.indexBookmark(searchDocument);

    // 7. Update bookmark indexed status
    console.log(`Updating bookmark ${bookmarkId} indexed status`);
    await bookmarkRepo.updateIndexedStatus(bookmarkId, true);

    return {
      bookmarkId,
      status: 'completed',
      contentLength: content.length,
      message: 'Content indexed successfully',
    };
  } catch (error) {
    console.error(`Error processing index job for bookmark ${bookmarkId}:`, error);
    throw error; // Let BullMQ handle retries
  }
}

// Create and export the worker
export const indexWorker = new Worker(QUEUE_NAMES.INDEX, processIndexJob, {
  connection: createRedisConnection(),
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  },
});

// Worker event handlers
indexWorker.on('completed', (job) => {
  console.log(`Index job ${job.id} completed successfully`);
});

indexWorker.on('failed', (job, err) => {
  console.error(`Index job ${job?.id} failed:`, err.message);
});

indexWorker.on('error', (err) => {
  console.error('Index worker error:', err);
});

// Graceful shutdown
export async function closeIndexWorker() {
  await indexWorker.close();
  await dbPool.end();
}
