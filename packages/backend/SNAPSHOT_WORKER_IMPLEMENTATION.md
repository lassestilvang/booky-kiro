# Snapshot Worker Implementation

## Overview

The snapshot worker has been successfully implemented to process snapshot jobs for Pro users. It handles fetching web pages, extracting main content, generating thumbnails, and storing snapshots in object storage.

## Implementation Details

### Core Functionality

The snapshot worker (`packages/backend/src/queue/workers/snapshot.worker.ts`) implements the following workflow:

1. **Page Fetching**: Uses Playwright to fetch web pages with proper user agent and viewport settings
2. **Content Extraction**: Removes boilerplate elements (nav, header, footer, ads, etc.) and extracts main content using Cheerio
3. **Thumbnail Generation**: Captures JPEG screenshots at 80% quality for grid view display
4. **Storage**: Stores both HTML snapshots and thumbnails in MinIO (S3-compatible storage)
5. **Database Updates**: Updates bookmark records with snapshot paths and cover URLs
6. **Job Enqueueing**: Automatically enqueues indexing jobs for full-text search

### Key Features

- **Browser Reuse**: Maintains a single Playwright browser instance across jobs for efficiency
- **Boilerplate Removal**: Intelligently removes common page elements like navigation, ads, and footers
- **Main Content Detection**: Attempts to find main content using semantic selectors (article, main, etc.)
- **Error Handling**: Proper error handling with BullMQ retry logic (exponential backoff)
- **Pro User Filtering**: Only processes snapshots for Pro tier users

### Dependencies Added

- `playwright`: For headless browser automation and page fetching
- `cheerio`: For HTML parsing and content extraction
- `@types/cheerio`: TypeScript types for Cheerio

### Configuration

Environment variables added to `.env` and `.env.example`:

- `MINIO_SNAPSHOT_BUCKET`: Bucket name for storing snapshots (default: "snapshots")

### Storage Structure

Snapshots are organized in MinIO as follows:

```
snapshots/
├── {userId}/
│   ├── {bookmarkId}/
│   │   ├── page.html      # Cleaned HTML content
│   │   └── thumbnail.jpg  # Screenshot thumbnail
```

## Property-Based Tests

Six correctness properties have been validated through property-based testing:

### Property 15: Content Extraction Quality

**Validates**: Requirements 5.4

For any web page content, extracting main content produces text without common boilerplate patterns (navigation menus, advertisements, footers).

**Test Result**: ✅ PASSED (100 runs)

### Property 27: Snapshot Creation

**Validates**: Requirements 9.1

For any HTML content, the snapshot creation process preserves the content structure and makes it retrievable.

**Test Result**: ✅ PASSED (100 runs)

### Property 29: Thumbnail Generation

**Validates**: Requirements 9.3

For any snapshot created, a thumbnail is generated as a valid image buffer.

**Test Result**: ✅ PASSED (100 runs)

### Property 30: Snapshot Storage Format

**Validates**: Requirements 9.4

For any snapshot created, the stored snapshot contains the complete HTML structure with all elements preserved.

**Test Result**: ✅ PASSED (50 runs)

### Property 60: Snapshot Workflow Completion

**Validates**: Requirements 18.2

For any snapshot job processed, the background worker fetches HTML, extracts content, stores the snapshot, and prepares for indexing.

**Test Result**: ✅ PASSED (50 runs)

### Property 63: Snapshot Completion Status Update

**Validates**: Requirements 18.5

For any completed snapshot, the bookmark record is updated with the snapshot path.

**Test Result**: ✅ PASSED (100 runs)

## Integration Points

### Queue System

- Consumes jobs from the `snapshot-processing` queue
- Enqueues jobs to the `content-indexing` queue after completion
- Configured with 3 retry attempts and exponential backoff

### Database

- Updates `bookmarks` table with `content_snapshot_path` and `cover_url`
- Uses `BookmarkRepository` for database operations

### Object Storage

- Stores HTML and thumbnails in MinIO
- Automatically creates buckets if they don't exist
- Uses proper content-type headers for stored objects

## Usage

The snapshot worker is automatically started when the backend application runs. It processes jobs from the queue in the background with:

- **Concurrency**: 5 concurrent jobs
- **Rate Limiting**: Maximum 10 jobs per second
- **Retry Logic**: 3 attempts with exponential backoff starting at 2 seconds

## Next Steps

The snapshot worker is now ready for integration with:

1. **Index Worker** (Task 14): Will consume the enqueued indexing jobs to extract text and index in search engine
2. **Bookmark Creation Flow**: Automatically enqueues snapshot jobs when Pro users create bookmarks
3. **Maintenance Worker** (Task 15): Will handle snapshot cleanup and retention policies

## Testing

Run the property-based tests:

```bash
cd packages/backend
pnpm test:run snapshot.worker.property.test.ts
```

All 6 property tests pass successfully, validating the correctness of the snapshot worker implementation.
