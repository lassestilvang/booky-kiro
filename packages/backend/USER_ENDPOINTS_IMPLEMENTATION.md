# User Management Endpoints Implementation

## Overview

This document describes the implementation of user management endpoints for the Bookmark Manager Platform, completing task 5.1 from the implementation plan.

## Implemented Components

### 1. UserService (`src/services/user.service.ts`)

Business logic layer for user profile management:

- **getUserProfile(userId)**: Retrieves user profile by ID
- **updateUserProfile(userId, data)**: Updates user name and/or email with validation
- **deleteUserAccount(userId)**: Deletes user account and all associated data (cascade)
- **getUserStats(userId)**: Returns user statistics (bookmarks, collections, tags, highlights, storage)

### 2. User Routes (`src/routes/user.routes.ts`)

RESTful API endpoints:

- **GET /v1/user**: Retrieve authenticated user's profile
- **PUT /v1/user**: Update user profile (name, email)
- **DELETE /v1/user**: Delete user account
- **GET /v1/user/stats**: Get user statistics

All endpoints require authentication via JWT token in Authorization header.

### 3. Main Application (`src/index.ts`)

Updated to:
- Initialize UserService with UserRepository
- Mount user routes at `/v1/user` with authentication middleware
- Configure Express server with proper middleware stack
- Generate RSA key pairs for JWT signing
- Set up Redis connection for rate limiting

## API Endpoints

### GET /v1/user

Retrieve the authenticated user's profile.

**Request:**
```
GET /v1/user
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "plan": "free",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### PUT /v1/user

Update the authenticated user's profile.

**Request:**
```
PUT /v1/user
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "New Name",
  "email": "newemail@example.com"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "newemail@example.com",
    "name": "New Name",
    "plan": "free",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- 400: Validation error
- 401: Unauthorized (missing or invalid token)
- 404: User not found
- 409: Email already in use

### DELETE /v1/user

Delete the authenticated user's account.

**Request:**
```
DELETE /v1/user
Authorization: Bearer <access_token>
```

**Response (204 No Content)**

**Error Responses:**
- 401: Unauthorized
- 404: User not found

### GET /v1/user/stats

Get statistics for the authenticated user.

**Request:**
```
GET /v1/user/stats
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "stats": {
    "totalBookmarks": 10,
    "totalCollections": 5,
    "totalTags": 15,
    "totalHighlights": 3,
    "storageUsedBytes": 1024000
  }
}
```

## Testing

### Unit Tests

**UserService Tests** (`src/services/user.service.test.ts`):
- ✅ Get user profile by ID
- ✅ Return null when user not found
- ✅ Update user name
- ✅ Update user email if not already taken
- ✅ Throw error if email is already taken
- ✅ Throw error if user not found during update
- ✅ Delete user account
- ✅ Throw error if user not found during deletion
- ✅ Throw error if deletion fails
- ✅ Return user statistics
- ✅ Throw error if user not found when getting stats

**User Routes Tests** (`src/routes/user.routes.test.ts`):
- ✅ Return user profile when authenticated
- ✅ Return 401 when not authenticated
- ✅ Return user statistics when authenticated
- ✅ Update user profile when authenticated
- ✅ Delete user account when authenticated

All tests pass successfully (16/16).

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 16.1**: User registration and account management
- **Requirement 22.3**: Account deletion with data cleanup (GDPR compliance)

## Security Features

1. **Authentication Required**: All endpoints require valid JWT access token
2. **Authorization**: Users can only access/modify their own profile
3. **Input Validation**: Zod schemas validate all request data
4. **Email Uniqueness**: Prevents duplicate email addresses
5. **Cascade Deletion**: User deletion removes all associated data via database constraints

## Error Handling

All endpoints return consistent error responses with:
- Error code
- Error message
- Timestamp
- Request ID (for tracing)

## Next Steps

The following endpoints are ready to be implemented next:
- Collection management endpoints (Task 6)
- Bookmark management endpoints (Task 7)
- Tag management endpoints (Task 8)
