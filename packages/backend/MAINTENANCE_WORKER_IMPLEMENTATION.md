# Maintenance Worker Implementation

## Overview

Implemented the maintenance worker for background processing of duplicate detection and broken link scanning tasks.

## Files Created

### 1. `src/queue/workers/maintenance.worker.ts`

Main maintenance worker implementation with two job types:

**Duplicate Detection:**
- Normalizes URLs by removing tracking parameters (utm_*, fbclid, gclid, etc.)
- Removes URL fragments (hash)
- Converts URLs to lowercase for consistent comparison
- Computes content hashes for duplicate detection
- Flags bookmarks as duplicates when:
  - Normalized URLs match existing bookmarks
  - Content hashes match (for different URLs with same content)

**Broken Link Scanner:**
- Requests each saved URL with 10-second timeout
- Marks bookmarks as broken on 4xx/5xx status codes
- Marks bookmarks as broken on network errors or timeouts
- Fixes previously broken links that are now working
- Includes 100ms delay between requests to avoid overwhelming servers

### 2. `src/queue/workers/maintenance.worker.property.test.ts`

Comprehensive property-based tests covering:

**Property 64: URL Normalization**
- Removes tracking parameters from URLs
- Removes URL fragments (hash)
- Normalizes URLs to lowercase
- Preserves non-tracking query parameters

**Property 65: Duplicate Flagging**
- Identifies URLs with same normalized form as duplicates
- Identifies different URLs as non-duplicates

**Property 66: Content Hash Duplicate Detection**
- Computes consistent hashes for same content
- Handles whitespace and case variations
- Identifies content with same hash as duplicates

**Property 67: Broken Link Detection**
- Identifies 4xx status codes as broken links
- Identifies 5xx status codes as broken links
- Identifies 2xx/3xx status codes as working links

**Property 68: Broken Link Filtering**
- Filters bookmarks by broken status correctly
- Returns empty array when no broken bookmarks exist

## Key Features

1. **URL Normalization**: Removes common tracking parameters and normalizes URLs for accurate duplicate detection
2. **Content Hashing**: Uses SHA-256 hashing to detect duplicates with different URLs but identical content
3. **Broken Link Detection**: Validates URLs and marks broken links with proper retry logic
4. **Scalable Processing**: Processes bookmarks per user or across all users
5. **Error Handling**: Includes proper error handling and retry logic via BullMQ

## Testing

All property-based tests pass with 100+ iterations per property, validating:
- URL normalization correctness
- Duplicate detection accuracy
- Broken link detection reliability
- Filter query correctness

## Integration

The maintenance worker integrates with:
- BullMQ job queue for async processing
- PostgreSQL for bookmark storage
- BookmarkRepository for data access
- Existing queue configuration in `src/queue/config.ts`

## Usage

Jobs can be enqueued using:

```typescript
import { enqueueMaintenanceJob } from './queue/config.js';

// Detect duplicates for a specific user
await enqueueMaintenanceJob({
  type: 'duplicate-detection',
  userId: 'user-id',
});

// Scan broken links for all users
await enqueueMaintenanceJob({
  type: 'broken-link-scan',
});
```

## Requirements Validated

- **Requirement 19.1**: URL normalization by removing tracking parameters ✓
- **Requirement 19.2**: Duplicate flagging for matching normalized URLs ✓
- **Requirement 19.3**: Content hash duplicate detection ✓
- **Requirement 20.1**: Broken link detection via URL requests ✓
- **Requirement 20.2**: Marking bookmarks as broken on 4xx/5xx ✓
- **Requirement 20.3**: Handling timeouts and network errors ✓
- **Requirement 20.5**: Filtering bookmarks by broken status ✓
