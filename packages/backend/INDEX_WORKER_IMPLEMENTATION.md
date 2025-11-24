# Index Worker Implementation

## Overview

This document describes the implementation of the content indexing worker (Task 14) for the Bookmark Manager Platform.

## Implementation Summary

### Task 14.1: Create Content Indexing Worker

**File:** `packages/backend/src/queue/workers/index.worker.ts`

The index worker processes content indexing jobs asynchronously. It performs the following operations:

1. **Retrieve Snapshot from MinIO**: Fetches the stored HTML or PDF snapshot from object storage
2. **Extract Text**: Extracts text content based on the file type:
   - HTML: Uses cheerio to parse and extract text from body (removes script/style tags)
   - PDF: Uses pdf-parse library to extract embedded text
3. **Clean and Normalize Text**: Applies text cleaning operations:
   - Normalizes line breaks (converts \r\n and \r to \n)
   - Removes excessive whitespace (multiple spaces to single space)
   - Removes excessive line breaks (more than 2 consecutive)
   - Trims each line and the overall text
4. **Index in Search Engine**: Creates a search document with all bookmark metadata and indexes it in MeiliSearch
5. **Update Bookmark Status**: Marks the bookmark as indexed in the database

**Key Features:**

- Supports both HTML and PDF content extraction
- Handles bookmark relations (tags, highlights) for comprehensive indexing
- Includes error handling with automatic retry via BullMQ
- Graceful shutdown support

**Dependencies Added:**

- `pdf-parse`: For extracting text from PDF files
- `@types/pdf-parse`: TypeScript definitions

### Task 14.2: Write Property Tests for Index Worker

**File:** `packages/backend/src/queue/workers/index.worker.property.test.ts`

Implemented property-based tests using fast-check to validate correctness properties:

#### Property 23: Content Indexing Cleanliness

**Validates:** Requirements 8.2

Tests that indexed content does not contain script or style tags. The test generates random HTML with scripts, styles, and main content, then verifies:

- Script tags and their content are removed
- Style tags and their content are removed
- Main content is preserved

#### Property 26 & 48: PDF Text Extraction and Cleaning

**Validates:** Requirements 8.5, 15.2

Tests that extracted PDF text is properly cleaned and normalized. The test generates text with various noise patterns (excessive whitespace, line breaks, carriage returns) and verifies:

- No excessive whitespace (no more than 1 space between words)
- No excessive line breaks (no more than 2 consecutive)
- No carriage returns
- Text is properly trimmed
- Original content is preserved (90%+ of words retained)

#### Additional Properties Tested:

1. **Text Extraction Preserves Structure**: Verifies that extracting text from HTML preserves logical content structure
2. **Empty Content Handling**: Verifies that empty or whitespace-only content is cleaned to an empty string

**Test Results:** All property tests pass with 100 iterations each.

## Architecture Integration

The index worker integrates with:

1. **Queue System (BullMQ)**: Processes jobs from the `content-indexing` queue
2. **MinIO**: Retrieves snapshots from object storage
3. **PostgreSQL**: Updates bookmark indexed status via BookmarkRepository
4. **MeiliSearch**: Indexes documents via SearchService
5. **Snapshot Worker**: Receives jobs enqueued by the snapshot worker after snapshot creation

## Configuration

Environment variables used:

- `MINIO_ENDPOINT`: MinIO server endpoint (default: localhost)
- `MINIO_PORT`: MinIO server port (default: 9000)
- `MINIO_USE_SSL`: Whether to use SSL (default: false)
- `MINIO_ACCESS_KEY`: MinIO access key (default: minioadmin)
- `MINIO_SECRET_KEY`: MinIO secret key (default: minioadmin)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL connection settings

## Worker Configuration

- **Concurrency**: 5 concurrent jobs
- **Rate Limiting**: Max 10 jobs per second
- **Retry Strategy**: 3 attempts with exponential backoff (inherited from queue config)

## Testing

Run the property tests:

```bash
npm run test:run -- src/queue/workers/index.worker.property.test.ts
```

## Future Enhancements

Potential improvements for future iterations:

1. Support for additional file formats (EPUB, DOCX)
2. Language detection and language-specific text processing
3. Content summarization for long documents
4. Metadata extraction (author, publish date, etc.)
5. Image OCR for text extraction from images

## Related Files

- `packages/backend/src/queue/config.ts`: Queue configuration and job types
- `packages/backend/src/queue/workers/snapshot.worker.ts`: Snapshot worker that enqueues index jobs
- `packages/backend/src/services/search.service.ts`: Search service for indexing
- `packages/backend/src/repositories/bookmark.repository.ts`: Bookmark repository for database operations
