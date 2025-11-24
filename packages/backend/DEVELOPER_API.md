# Developer API Documentation

This document describes how to integrate with the Bookmark Manager Platform API as a third-party developer.

## Overview

The Bookmark Manager Platform provides a comprehensive RESTful API for building integrations, mobile apps, and third-party services. The API supports OAuth 2.0 with PKCE for secure authorization.

## Authentication

### OAuth 2.0 with PKCE

The API uses OAuth 2.0 Authorization Code flow with PKCE (Proof Key for Code Exchange) for public clients like mobile apps and single-page applications.

#### Step 1: Register Your Application

Register your application to obtain OAuth credentials:

```bash
POST /v1/oauth/clients
Content-Type: application/json

{
  "name": "My Bookmark App",
  "redirect_uris": ["https://myapp.example.com/callback"],
  "is_public": true
}
```

Response:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "client_id": "a1b2c3d4e5f6g7h8",
  "name": "My Bookmark App",
  "redirect_uris": ["https://myapp.example.com/callback"],
  "is_public": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Note:** For confidential clients (server-side apps), set `is_public: false` to receive a `client_secret`.

#### Step 2: Generate PKCE Code Verifier and Challenge

```javascript
// Generate random code verifier (43-128 characters)
const codeVerifier = generateRandomString(128);

// Generate code challenge (SHA256 hash, base64url encoded)
const encoder = new TextEncoder();
const data = encoder.encode(codeVerifier);
const hash = await crypto.subtle.digest('SHA-256', data);
const codeChallenge = base64UrlEncode(hash);
```

#### Step 3: Redirect User to Authorization Endpoint

```
GET /v1/oauth/authorize?
  client_id=a1b2c3d4e5f6g7h8&
  redirect_uri=https://myapp.example.com/callback&
  response_type=code&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256&
  scope=read write&
  state=random_state_string
```

The user will be redirected to login/consent screen. After authorization, they'll be redirected back to your `redirect_uri` with an authorization code:

```
https://myapp.example.com/callback?code=abc123def456&state=random_state_string
```

#### Step 4: Exchange Authorization Code for Access Token

```bash
POST /v1/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "abc123def456",
  "client_id": "a1b2c3d4e5f6g7h8",
  "redirect_uri": "https://myapp.example.com/callback",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

Response:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "def456ghi789jkl012mno345pqr678stu901",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "read write"
}
```

#### Step 5: Make API Requests

Include the access token in the Authorization header:

```bash
GET /v1/bookmarks
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Scopes

The API supports the following OAuth scopes:

- `read` - Read access to bookmarks, collections, and tags
- `write` - Create and update bookmarks, collections, and tags
- `delete` - Delete bookmarks, collections, and tags
- `admin` - Full administrative access (requires explicit user consent)

## Rate Limiting

API requests are rate-limited based on application tier:

- **Free Tier**: 100 requests per minute per user
- **Pro Tier**: 500 requests per minute per user
- **Developer API**: Custom rate limits based on application tier

When rate limits are exceeded, the API returns HTTP 429 with a `Retry-After` header indicating when to retry.

Example error response:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

## OpenAPI Specification

The complete API specification is available in OpenAPI 3.0 format:

- **YAML**: `GET /v1/docs/openapi.yaml`
- **JSON**: `GET /v1/docs/openapi.json`
- **Interactive Documentation**: `GET /v1/docs` (Swagger UI)

You can use these specifications to:

- Generate client libraries in your preferred language
- Import into API testing tools (Postman, Insomnia)
- Validate requests and responses
- Generate mock servers for testing

## Example: Creating a Bookmark

```bash
POST /v1/bookmarks
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "url": "https://example.com/article",
  "title": "Interesting Article",
  "excerpt": "This is a great article about...",
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "tags": ["javascript", "web-development"]
}
```

Response:

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "processing",
  "bookmark": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "owner_id": "770e8400-e29b-41d4-a716-446655440002",
    "collection_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Interesting Article",
    "url": "https://example.com/article",
    "excerpt": "This is a great article about...",
    "type": "article",
    "domain": "example.com",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

## Example: Searching Bookmarks

```bash
GET /v1/search?q=javascript&tags=web-development&fulltext=true
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```json
{
  "results": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Interesting Article",
      "url": "https://example.com/article",
      "excerpt": "This is a great article about...",
      "highlights": [
        "...great article about <mark>javascript</mark> and...",
        "...modern <mark>web development</mark> practices..."
      ],
      "score": 0.95
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "took": 45
}
```

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

Common error codes:

- `INVALID_REQUEST` - Invalid request parameters (400)
- `UNAUTHORIZED` - Missing or invalid authentication (401)
- `FORBIDDEN` - Insufficient permissions (403)
- `NOT_FOUND` - Resource not found (404)
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded (429)
- `INTERNAL_ERROR` - Server error (500)

## Best Practices

1. **Store tokens securely** - Never expose access tokens in client-side code or logs
2. **Implement token refresh** - Refresh tokens before they expire to maintain seamless user experience
3. **Handle rate limits gracefully** - Implement exponential backoff when rate limits are hit
4. **Validate webhook signatures** - If using webhooks, always verify signatures
5. **Use HTTPS** - Always use HTTPS for API requests in production
6. **Implement proper error handling** - Handle all error responses appropriately
7. **Cache responses** - Cache GET responses when appropriate to reduce API calls
8. **Use pagination** - Always paginate large result sets

## Support

For API support and questions:

- Email: support@bookmarkmanager.example.com
- Documentation: https://docs.bookmarkmanager.example.com
- Status Page: https://status.bookmarkmanager.example.com

## SDKs and Libraries

Official SDKs are available for:

- JavaScript/TypeScript (npm: `@bookmark-manager/sdk`)
- Python (pip: `bookmark-manager-sdk`)
- Ruby (gem: `bookmark_manager`)
- Go (go get: `github.com/bookmark-manager/go-sdk`)

Community SDKs:

- PHP: https://github.com/community/bookmark-manager-php
- Java: https://github.com/community/bookmark-manager-java
- .NET: https://github.com/community/bookmark-manager-dotnet
