# Cross-Device Synchronization Implementation

## Overview

This document describes the implementation of cross-device synchronization for the Bookmark Manager Platform, fulfilling Requirements 24.1, 24.3, and 24.4 from the design specification.

## Features Implemented

### 1. Delta Synchronization (Requirement 24.1)

The system implements delta synchronization to minimize data transfer by only sending changes since the last sync timestamp.

**Endpoint:** `GET /v1/sync/delta`

**Query Parameters:**

- `lastSyncTimestamp` (optional): ISO 8601 timestamp of last sync
- `deviceId` (required): Unique identifier for the device

**Response:**

```json
{
  "changes": [
    {
      "id": "bookmark-id",
      "type": "bookmark",
      "action": "update",
      "data": {
        /* entity data */
      },
      "timestamp": "2025-11-24T12:00:00Z",
      "userId": "user-id"
    }
  ],
  "timestamp": "2025-11-24T12:30:00Z",
  "hasMore": false
}
```

### 2. WebSocket Real-Time Updates (Requirement 24.1)

The system provides WebSocket support for real-time synchronization across connected devices.

**WebSocket Endpoint:** `ws://localhost:3000/ws/sync`

**Connection:**

- Requires JWT token as query parameter: `?token=<jwt>&deviceId=<device-id>`
- Automatically subscribes to user's sync channel
- Receives real-time change notifications

**Message Format:**

```json
{
  "type": "change",
  "data": {
    "id": "entity-id",
    "type": "bookmark",
    "action": "update",
    "data": {
      /* entity data */
    },
    "timestamp": "2025-11-24T12:00:00Z"
  }
}
```

### 3. Offline Sync on Reconnection (Requirement 24.3)

When a device comes online after being offline, it can synchronize all changes that occurred during the offline period.

**Endpoint:** `POST /v1/sync/offline`

**Request Body:**

```json
{
  "offlineChanges": [
    {
      "id": "entity-id",
      "type": "bookmark",
      "action": "update",
      "data": {
        /* entity data */
      },
      "timestamp": "2025-11-24T11:00:00Z",
      "userId": "user-id"
    }
  ],
  "lastSyncTimestamp": "2025-11-24T10:00:00Z",
  "deviceId": "device-123"
}
```

**Response:**

```json
{
  "success": true,
  "serverChanges": [
    /* changes from server */
  ],
  "conflicts": [
    /* any conflicts detected */
  ],
  "timestamp": "2025-11-24T12:30:00Z"
}
```

### 4. Conflict Resolution (Requirement 24.4)

The system uses a last-write-wins strategy with timestamp comparison to resolve conflicts.

**Conflict Detection:**

- When applying changes, the system compares timestamps
- If server version is newer, client change is rejected
- If client version is newer, server version is updated

**Conflict Response:**

```json
{
  "entityId": "bookmark-id",
  "entityType": "bookmark",
  "localTimestamp": "2025-11-24T11:00:00Z",
  "remoteTimestamp": "2025-11-24T11:30:00Z",
  "resolution": "remote"
}
```

## Architecture

### Components

1. **SyncService** (`src/services/sync.service.ts`)
   - Handles delta synchronization logic
   - Manages conflict resolution
   - Coordinates with Redis pub/sub for real-time updates

2. **SyncWebSocketHandler** (`src/websocket/sync.handler.ts`)
   - Manages WebSocket connections
   - Authenticates clients via JWT
   - Broadcasts changes to connected devices
   - Implements heartbeat for connection health

3. **Sync Routes** (`src/routes/sync.routes.ts`)
   - REST API endpoints for sync operations
   - Handles delta sync, apply changes, and offline sync

### Data Flow

```
Client Device A                    Server                      Client Device B
     |                                |                              |
     |-- POST /v1/sync/apply -------->|                              |
     |   (create bookmark)            |                              |
     |                                |-- WebSocket push ----------->|
     |                                |   (new bookmark)             |
     |<-- Response (success) ---------|                              |
     |                                |                              |
     |                                |<-- GET /v1/sync/delta -------|
     |                                |   (lastSyncTimestamp)        |
     |                                |-- Response (changes) ------->|
```

### Redis Pub/Sub

The system uses Redis pub/sub for broadcasting changes to connected devices:

- **Channel Pattern:** `sync:{userId}`
- **Message Format:** JSON-serialized SyncEntity
- **Subscriber:** Each WebSocket connection subscribes to user's channel
- **Publisher:** SyncService publishes changes after applying them

## Property-Based Tests

The implementation includes comprehensive property-based tests that verify:

### Property 72: Offline Synchronization

- **Test:** For any device that comes online after being offline, the system synchronizes all changes from the offline period
- **Validates:** Requirement 24.3
- **Runs:** 100 iterations with random bookmark data

### Property 73: Conflict Resolution

- **Test:** For any conflicting changes, the system resolves conflicts using last-write-wins with timestamp comparison
- **Validates:** Requirement 24.4
- **Runs:** 100 iterations with random conflict scenarios

### Additional Tests

- Delta sync only returns changes after last sync timestamp
- Newer client changes win over older server changes
- All entity types (bookmarks, collections, tags, highlights, reminders) are synchronized

## Supported Entity Types

The sync system supports the following entity types:

1. **Bookmarks** - Full bookmark data including tags
2. **Collections** - Collection hierarchy and metadata
3. **Tags** - Tag definitions and associations
4. **Highlights** - Text highlights and annotations
5. **Reminders** - Reminder schedules and notifications

## Usage Examples

### Client-Side Delta Sync

```typescript
// Get changes since last sync
const response = await fetch(
  '/v1/sync/delta?lastSyncTimestamp=2025-11-24T10:00:00Z&deviceId=device-123',
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
);

const { changes, timestamp } = await response.json();

// Apply changes locally
for (const change of changes) {
  applyChangeLocally(change);
}

// Store new sync timestamp
localStorage.setItem('lastSyncTimestamp', timestamp);
```

### Client-Side WebSocket Connection

```typescript
const ws = new WebSocket(
  `ws://localhost:3000/ws/sync?token=${accessToken}&deviceId=device-123`
);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'change') {
    // Apply change to local state
    applyChangeLocally(message.data);
  }
};

ws.onopen = () => {
  console.log('Connected to sync server');
};
```

### Client-Side Offline Sync

```typescript
// When coming back online
const offlineChanges = getOfflineChanges(); // Get changes made while offline
const lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp');

const response = await fetch('/v1/sync/offline', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    offlineChanges,
    lastSyncTimestamp,
    deviceId: 'device-123',
  }),
});

const { serverChanges, conflicts, timestamp } = await response.json();

// Apply server changes
for (const change of serverChanges) {
  applyChangeLocally(change);
}

// Handle conflicts
for (const conflict of conflicts) {
  if (conflict.resolution === 'remote') {
    // Server version won, update local state
    updateLocalState(conflict.entityId, conflict.entityType);
  }
}

// Update sync timestamp
localStorage.setItem('lastSyncTimestamp', timestamp);
```

## Performance Considerations

1. **Delta Sync:** Only changes since last sync are transmitted, minimizing bandwidth
2. **WebSocket:** Real-time updates avoid polling overhead
3. **Redis Pub/Sub:** Efficient broadcasting to multiple connected devices
4. **Conflict Resolution:** Simple timestamp comparison for fast conflict detection

## Security

1. **Authentication:** All endpoints require JWT authentication
2. **Authorization:** Users can only sync their own data
3. **WebSocket Security:** JWT token required for WebSocket connection
4. **Device Isolation:** Changes from a device are not broadcast back to that device

## Future Enhancements

1. **Pagination:** Support for large sync responses with pagination
2. **Selective Sync:** Allow clients to subscribe to specific entity types
3. **Compression:** Compress sync payloads for bandwidth optimization
4. **Conflict Strategies:** Support for custom conflict resolution strategies
5. **Sync Status:** Track sync status per device for monitoring

## Testing

Run the property-based tests:

```bash
cd packages/backend
npm run test:run -- src/services/sync.service.property.test.ts
```

All tests pass with 100 iterations per property, validating:

- Offline synchronization completeness
- Conflict resolution correctness
- Delta sync accuracy
- Timestamp-based filtering
