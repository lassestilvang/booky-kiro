# API Documentation

## Overview

The Bookmark Manager Platform API is a RESTful API that provides comprehensive bookmark management capabilities. The API follows OpenAPI 3.0 specification and supports both JWT and OAuth 2.0 authentication.

**Base URL**: `https://api.bookmarkmanager.example.com/v1`  
**Development**: `http://localhost:3000/v1`

## Authentication

### JWT Bearer Tokens

For direct user authentication, use JWT bearer tokens obtained from the login endpoint.

**Example:**

```bash
curl -X GET https://api.bookmarkmanager.example.com/v1/bookmarks \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### OAuth 2.0 with PKCE

For third-party applications, use OAuth 2.0 authorization code flow with PKCE.

**Flow:**

1. Register your application to get `client_id`
2. Generate PKCE code verifier and challenge
3. Redirect user to authorization endpoint
4. Exchange authorization code for access token
5. Use access token for API requests

**Example:**

```bash
# Step 1: Register OAuth client
curl -X POST https://api.bookmarkmanager.example.com/v1/oauth/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Bookmark App",
    "redirect_uris": ["https://myapp.example.com/callback"],
    "is_public": true
  }'

# Step 2: Generate PKCE challenge (in your app)
code_verifier=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
code_challenge=$(echo -n $code_verifier | openssl sha256 -binary | base64 | tr -d "=+/" | cut -c1-43)

# Step 3: Redirect user to authorization
https://api.bookmarkmanager.example.com/v1/oauth/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://myapp.example.com/callback&
  response_type=code&
  code_challenge=$code_challenge&
  code_challenge_method=S256&
  scope=read write&
  state=random_state_string

# Step 4: Exchange code for token
curl -X POST https://api.bookmarkmanager.example.com/v1/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTHORIZATION_CODE",
    "client_id": "YOUR_CLIENT_ID",
    "redirect_uri": "https://myapp.example.com/callback",
    "code_verifier": "'$code_verifier'"
  }'
```

## Rate Limiting

API requests are rate-limited based on user plan:

| Plan          | Rate Limit               | Burst  |
| ------------- | ------------------------ | ------ |
| Free          | 100 requests/minute      | 120    |
| Pro           | 500 requests/minute      | 600    |
| Developer API | Custom (contact support) | Custom |

**Rate Limit Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

**Rate Limit Exceeded Response:**

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again in 60 seconds.",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

**Common Error Codes:**

| Code                   | HTTP Status | Description               |
| ---------------------- | ----------- | ------------------------- |
| `INVALID_REQUEST`      | 400         | Request validation failed |
| `UNAUTHORIZED`         | 401         | Authentication required   |
| `FORBIDDEN`            | 403         | Insufficient permissions  |
| `NOT_FOUND`            | 404         | Resource not found        |
| `CONFLICT`             | 409         | Resource already exists   |
| `RATE_LIMIT_EXCEEDED`  | 429         | Too many requests         |
| `INTERNAL_ERROR`       | 500         | Server error              |
| `PRO_FEATURE_REQUIRED` | 403         | Feature requires Pro plan |

## API Endpoints

### Authentication

#### Register User

```http
POST /v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "free",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "def456ghi789jkl012mno345pqr678stu901"
}
```

#### Login

```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "pro",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "def456ghi789jkl012mno345pqr678stu901"
}
```

#### Refresh Token

```http
POST /v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "def456ghi789jkl012mno345pqr678stu901"
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "new_refresh_token_here"
}
```

### Bookmarks

#### List Bookmarks

```http
GET /v1/bookmarks?collection_id={uuid}&tags=javascript,react&page=1&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**

- `collection_id` (optional): Filter by collection UUID
- `tags` (optional): Comma-separated list of tags
- `type` (optional): Filter by type (article, video, image, file, document)
- `domain` (optional): Filter by domain
- `date_from` (optional): Filter by creation date (YYYY-MM-DD)
- `date_to` (optional): Filter by creation date (YYYY-MM-DD)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)

**Response:**

```json
{
  "bookmarks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "owner_id": "user-uuid",
      "collection_id": "collection-uuid",
      "title": "Interesting Article",
      "url": "https://example.com/article",
      "excerpt": "This is a great article about...",
      "type": "article",
      "domain": "example.com",
      "cover_url": "https://example.com/image.jpg",
      "content_indexed": true,
      "is_duplicate": false,
      "is_broken": false,
      "tags": [
        {
          "id": "tag-uuid",
          "name": "javascript",
          "color": "#FF5733"
        }
      ],
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

#### Create Bookmark

```http
POST /v1/bookmarks
Authorization: Bearer {token}
Content-Type: application/json

{
  "url": "https://example.com/article",
  "title": "Interesting Article",
  "excerpt": "This is a great article about...",
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "tags": ["javascript", "web-development"],
  "note": "Read this later"
}
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "bookmark": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "owner_id": "user-uuid",
    "collection_id": "collection-uuid",
    "title": "Interesting Article",
    "url": "https://example.com/article",
    "excerpt": "This is a great article about...",
    "type": "article",
    "domain": "example.com",
    "content_indexed": false,
    "tags": [
      {
        "id": "tag-uuid",
        "name": "javascript",
        "color": "#FF5733"
      }
    ],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Get Bookmark

```http
GET /v1/bookmarks/{id}
Authorization: Bearer {token}
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "owner_id": "user-uuid",
  "collection_id": "collection-uuid",
  "title": "Interesting Article",
  "url": "https://example.com/article",
  "excerpt": "This is a great article about...",
  "content_snapshot_path": "snapshots/user-uuid/bookmark-uuid/page.html",
  "type": "article",
  "domain": "example.com",
  "cover_url": "https://example.com/image.jpg",
  "content_indexed": true,
  "tags": [
    {
      "id": "tag-uuid",
      "name": "javascript",
      "color": "#FF5733"
    }
  ],
  "highlights": [
    {
      "id": "highlight-uuid",
      "text_selected": "Important passage",
      "color": "#FFFF00",
      "annotation_md": "This is **important**",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

#### Update Bookmark

```http
PUT /v1/bookmarks/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Updated Title",
  "collection_id": "new-collection-uuid",
  "tags": ["javascript", "react", "typescript"]
}
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Updated Title",
  "collection_id": "new-collection-uuid",
  "tags": [
    { "id": "tag1", "name": "javascript" },
    { "id": "tag2", "name": "react" },
    { "id": "tag3", "name": "typescript" }
  ],
  "updated_at": "2024-01-15T11:00:00Z"
}
```

#### Delete Bookmark

```http
DELETE /v1/bookmarks/{id}
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "message": "Bookmark deleted successfully"
}
```

#### Bulk Operations (Pro)

```http
POST /v1/bookmarks/bulk
Authorization: Bearer {token}
Content-Type: application/json

{
  "bookmark_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "action": "add_tags",
  "params": {
    "tags": ["important", "read-later"]
  }
}
```

**Actions:**

- `add_tags`: Add tags to bookmarks
- `remove_tags`: Remove tags from bookmarks
- `move`: Move bookmarks to collection
- `delete`: Delete bookmarks

**Response:**

```json
{
  "success": true,
  "processed": 2,
  "failed": 0,
  "job_id": "job-uuid"
}
```

### Collections

#### List Collections

```http
GET /v1/collections
Authorization: Bearer {token}
```

**Response:**

```json
{
  "collections": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "owner_id": "user-uuid",
      "title": "Web Development",
      "icon": "code",
      "is_public": false,
      "parent_id": null,
      "sort_order": 0,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Create Collection

```http
POST /v1/collections
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Web Development",
  "icon": "code",
  "parent_id": null
}
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "owner_id": "user-uuid",
  "title": "Web Development",
  "icon": "code",
  "is_public": false,
  "parent_id": null,
  "sort_order": 0,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

#### Share Collection (Pro)

```http
POST /v1/collections/{id}/share
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_id": "target-user-uuid",
  "role": "editor"
}
```

**Roles:**

- `owner`: Full control
- `editor`: Can add/edit/delete bookmarks
- `viewer`: Read-only access

**Response:**

```json
{
  "id": "permission-uuid",
  "collection_id": "collection-uuid",
  "user_id": "target-user-uuid",
  "role": "editor",
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### Generate Public Share Link (Pro)

```http
POST /v1/collections/{id}/public
Authorization: Bearer {token}
```

**Response:**

```json
{
  "share_slug": "abc123def456",
  "public_url": "https://bookmarkmanager.example.com/public/abc123def456"
}
```

### Search

#### Search Bookmarks

```http
GET /v1/search?q=javascript&tags=react&fulltext=true&page=1&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**

- `q` (optional): Search query
- `tags` (optional): Comma-separated list of tags
- `type` (optional): Filter by type
- `domain` (optional): Filter by domain
- `collection` (optional): Filter by collection UUID
- `date_from` (optional): Filter by date (YYYY-MM-DD)
- `date_to` (optional): Filter by date (YYYY-MM-DD)
- `fulltext` (optional): Enable full-text search (Pro only, default: false)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)

**Response:**

```json
{
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "JavaScript Best Practices",
      "url": "https://example.com/js-best-practices",
      "excerpt": "Learn about JavaScript best practices...",
      "highlights": [
        "...use <em>JavaScript</em> best practices...",
        "...modern <em>JavaScript</em> features..."
      ],
      "score": 0.95
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "took": 15
}
```

### Tags

#### List Tags

```http
GET /v1/tags
Authorization: Bearer {token}
```

**Response:**

```json
{
  "tags": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "owner_id": "user-uuid",
      "name": "javascript",
      "normalized_name": "javascript",
      "color": "#FF5733",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Merge Tags

```http
POST /v1/tags/merge
Authorization: Bearer {token}
Content-Type: application/json

{
  "source_tag_ids": [
    "tag1-uuid",
    "tag2-uuid"
  ],
  "target_tag_id": "tag3-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "merged_count": 2,
  "target_tag": {
    "id": "tag3-uuid",
    "name": "javascript"
  }
}
```

### Highlights (Pro)

#### Create Highlight

```http
POST /v1/highlights
Authorization: Bearer {token}
Content-Type: application/json

{
  "bookmark_id": "550e8400-e29b-41d4-a716-446655440000",
  "text_selected": "Important passage from the article",
  "color": "#FFFF00",
  "annotation_md": "This is **very important**",
  "position_context": {
    "before": "text before selection",
    "after": "text after selection",
    "xpath": "/html/body/article/p[3]"
  }
}
```

**Response:**

```json
{
  "id": "highlight-uuid",
  "bookmark_id": "bookmark-uuid",
  "owner_id": "user-uuid",
  "text_selected": "Important passage from the article",
  "color": "#FFFF00",
  "annotation_md": "This is **very important**",
  "position_context": {
    "before": "text before selection",
    "after": "text after selection",
    "xpath": "/html/body/article/p[3]"
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Files (Pro)

#### Upload File

```http
POST /v1/files/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary data]
collection_id: 550e8400-e29b-41d4-a716-446655440000
```

**Response:**

```json
{
  "id": "file-uuid",
  "bookmark_id": "bookmark-uuid",
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 1048576,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Backups (Pro)

#### List Backups

```http
GET /v1/backups
Authorization: Bearer {token}
```

**Response:**

```json
{
  "backups": [
    {
      "id": "backup-uuid",
      "owner_id": "user-uuid",
      "file_path": "backups/user-uuid/backup-2024-01-15.zip",
      "size_bytes": 10485760,
      "auto_generated": true,
      "created_at": "2024-01-15T02:00:00Z"
    }
  ]
}
```

#### Generate Backup

```http
POST /v1/backups/generate
Authorization: Bearer {token}
```

**Response:**

```json
{
  "id": "backup-uuid",
  "status": "processing",
  "estimated_time": 60
}
```

#### Download Backup

```http
GET /v1/backups/{id}/download
Authorization: Bearer {token}
```

**Response:**

```
Content-Type: application/zip
Content-Disposition: attachment; filename="backup-2024-01-15.zip"

[binary data]
```

### Import/Export

#### Import HTML Bookmarks

```http
POST /v1/import/html
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [HTML file]
```

**Response:**

```json
{
  "job_id": "import-job-uuid",
  "status": "processing",
  "estimated_bookmarks": 150
}
```

#### Export Collection

```http
GET /v1/export/{collection_id}?format=json
Authorization: Bearer {token}
```

**Query Parameters:**

- `format`: Export format (html, json, csv, txt)

**Response:**

```
Content-Type: application/json
Content-Disposition: attachment; filename="bookmarks-export.json"

{
  "version": "1.0",
  "exported_at": "2024-01-15T10:30:00Z",
  "bookmarks": [...]
}
```

## Webhooks (Future)

Webhooks allow you to receive real-time notifications about events in your account.

**Supported Events:**

- `bookmark.created`
- `bookmark.updated`
- `bookmark.deleted`
- `collection.created`
- `collection.shared`
- `backup.completed`

## SDKs and Libraries

Official SDKs are available for:

- **JavaScript/TypeScript**: `npm install @bookmark-manager/sdk`
- **Python**: `pip install bookmark-manager-sdk`
- **Go**: `go get github.com/bookmark-manager/go-sdk`

**Example (JavaScript):**

```javascript
import { BookmarkManager } from '@bookmark-manager/sdk';

const client = new BookmarkManager({
  apiKey: 'your-api-key',
  baseURL: 'https://api.bookmarkmanager.example.com/v1',
});

// Create a bookmark
const bookmark = await client.bookmarks.create({
  url: 'https://example.com/article',
  title: 'Interesting Article',
  tags: ['javascript', 'web-development'],
});

// Search bookmarks
const results = await client.search({
  q: 'javascript',
  fulltext: true,
});
```

## Postman Collection

Import our Postman collection for easy API testing:

**Download:** [Bookmark Manager API.postman_collection.json](../postman/Bookmark-Manager-API.postman_collection.json)

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

- **YAML**: [packages/backend/openapi.yaml](../packages/backend/openapi.yaml)
- **Interactive Docs**: https://api.bookmarkmanager.example.com/docs

## Support

- **Documentation**: https://docs.bookmarkmanager.example.com
- **API Status**: https://status.bookmarkmanager.example.com
- **Support Email**: api-support@bookmarkmanager.example.com
- **GitHub Issues**: https://github.com/yourusername/bookmark-manager-platform/issues
