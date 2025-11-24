# Implementation Plan

This implementation plan breaks down the bookmark manager platform into discrete, actionable coding tasks. Each task builds incrementally on previous work, with property-based tests integrated throughout to catch errors early.

## Phase 1: Foundation and Core Infrastructure

- [x] 1. Set up project structure and development environment
  - Create monorepo structure with backend, frontend, extension, and shared packages
  - Configure TypeScript, ESLint, and Prettier
  - Set up Docker Compose for local development (PostgreSQL, Redis, Elasticsearch/MeiliSearch, MinIO)
  - Create initial package.json files with dependencies
  - Set up Vitest and fast-check for testing
  - _Requirements: All_

- [-] 2. Implement database schema and migrations
- [x] 2.1 Create PostgreSQL schema with all tables
  - Write migration files for users, collections, bookmarks, tags, bookmark_tags tables
  - Write migration files for highlights, files, backups, collection_permissions, reminders tables
  - Write migration files for oauth_clients and oauth_tokens tables
  - Create all indexes for performance optimization
  - _Requirements: 1.1, 2.1, 3.1, 10.1, 11.1, 12.1, 13.1, 15.1, 16.1, 25.1_

- [x] 2.2 Write property test for database schema
  - **Property 1: Bookmark Creation Completeness**
  - **Property 6: Collection Creation Completeness**
  - **Validates: Requirements 1.1, 2.1**

- [x] 3. Implement core data models and repositories
- [x] 3.1 Create TypeScript interfaces for all domain models
  - Define User, Collection, Bookmark, Tag, Highlight, File, Backup, Permission, Reminder interfaces
  - Create request/response DTOs for API operations
  - _Requirements: 1.1, 2.1, 3.1, 10.1, 11.1, 12.1, 13.1, 15.1, 16.1_

- [x] 3.2 Implement repository pattern for data access
  - Create base repository with CRUD operations
  - Implement UserRepository with authentication queries
  - Implement CollectionRepository with hierarchy support
  - Implement BookmarkRepository with filtering and pagination
  - Implement TagRepository with normalization
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1_

- [x] 3.3 Write property tests for repository operations
  - **Property 2: Bookmark Retrieval Completeness**
  - **Property 3: Bookmark Update Consistency**
  - **Property 4: Bookmark Deletion Cascade**
  - **Property 7: Bookmark Assignment**
  - **Property 8: Bookmark Move Atomicity**
  - **Validates: Requirements 1.2, 1.3, 1.4, 2.2, 2.3**

## Phase 2: Authentication and Authorization

- [-] 4. Implement authentication system
- [x] 4.1 Create user registration and password hashing
  - Implement bcrypt password hashing with cost factor 12
  - Create user registration endpoint with validation
  - _Requirements: 16.1_

- [x] 4.2 Write property test for user registration
  - **Property 50: User Registration Completeness**
  - **Validates: Requirements 16.1**

- [x] 4.3 Implement JWT authentication
  - Create JWT token generation with RS256 signing
  - Implement access token and refresh token issuance
  - Create token validation middleware
  - _Requirements: 16.2, 16.4_

- [x] 4.4 Write property tests for JWT operations
  - **Property 51: JWT Token Issuance**
  - **Property 52: Token Refresh**
  - **Validates: Requirements 16.2, 16.4**

- [x] 4.5 Implement OAuth2 with PKCE for public clients
  - Create OAuth2 authorization endpoint
  - Implement PKCE code challenge/verifier validation
  - Create token exchange endpoint
  - _Requirements: 16.3_

- [x] 4.6 Create authorization middleware
  - Implement role-based access control
  - Create plan tier enforcement (free vs Pro)
  - Add request rate limiting per user and IP
  - _Requirements: 16.5, 21.5, 27.1, 27.2_

- [x] 4.7 Write property tests for authorization
  - **Property 53: Authorization Enforcement**
  - **Property 70: Rate Limiting Enforcement**
  - **Property 78: Pro Feature Access Control**
  - **Property 79: API-Level Feature Gating**
  - **Validates: Requirements 16.5, 21.5, 27.1, 27.2**

## Phase 3: Core API Endpoints

- [x] 5. Implement user management endpoints
- [x] 5.1 Create user profile endpoints
  - GET /v1/user - retrieve user profile
  - PUT /v1/user - update user profile
  - DELETE /v1/user - delete user account
  - GET /v1/user/stats - user statistics
  - _Requirements: 16.1, 22.3_

- [x] 6. Implement collection management endpoints
- [x] 6.1 Create collection CRUD endpoints
  - GET /v1/collections - list collections
  - POST /v1/collections - create collection
  - GET /v1/collections/:id - get collection details
  - PUT /v1/collections/:id - update collection
  - DELETE /v1/collections/:id - delete collection
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6.2 Write property test for collection deletion
  - **Property 9: Collection Deletion Behavior**
  - **Validates: Requirements 2.4**

- [x] 7. Implement bookmark management endpoints
- [x] 7.1 Create bookmark CRUD endpoints
  - GET /v1/bookmarks - list bookmarks with filtering
  - POST /v1/bookmarks - create bookmark
  - GET /v1/bookmarks/:id - get bookmark details
  - PUT /v1/bookmarks/:id - update bookmark
  - DELETE /v1/bookmarks/:id - delete bookmark
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 7.2 Write property test for duplicate detection
  - **Property 5: Duplicate Detection**
  - **Validates: Requirements 1.5**

- [x] 7.3 Implement bookmark filtering and pagination
  - Add query parameters for tags, type, domain, date range, collection
  - Implement pagination with cursor-based approach
  - _Requirements: 3.2, 3.3_

- [x] 7.4 Write property tests for filtering
  - **Property 11: Tag Filtering Accuracy**
  - **Property 12: Multi-Criteria Filtering**
  - **Validates: Requirements 3.2, 3.3**

- [x] 8. Implement tag management endpoints
- [x] 8.1 Create tag CRUD endpoints
  - GET /v1/tags - list tags
  - POST /v1/tags - create tag
  - PUT /v1/tags/:id - update tag
  - DELETE /v1/tags/:id - delete tag
  - POST /v1/tags/merge - merge tags
  - _Requirements: 3.1, 3.5_

- [x] 8.2 Write property tests for tag operations
  - **Property 10: Tag Normalization**
  - **Property 13: Tag Merge Consolidation**
  - **Validates: Requirements 3.1, 3.5**

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Search Engine Integration

- [x] 10. Set up search engine infrastructure
- [x] 10.1 Configure Elasticsearch or MeiliSearch
  - Create index mappings for bookmarks
  - Configure analyzers for full-text search
  - Set up connection pooling and error handling
  - _Requirements: 8.1, 17.1_

- [x] 10.2 Implement search service layer
  - Create SearchService with index/update/delete operations
  - Implement query builder for complex searches
  - Add support for filters (tags, type, domain, date range, collection)
  - Implement fuzzy matching and phrase matching
  - _Requirements: 8.3, 8.4, 17.2, 17.4_

- [x] 10.3 Write property tests for search functionality
  - **Property 22: Full-Text Search Coverage**
  - **Property 24: Search Filter Combination**
  - **Property 25: Search Matching Modes**
  - **Property 54: Search Relevance Ranking**
  - **Property 57: Fuzzy Search Matching**
  - **Validates: Requirements 8.1, 8.3, 8.4, 17.1, 17.4**

- [x] 11. Implement search API endpoint
- [x] 11.1 Create search endpoint
  - GET /v1/search - search bookmarks with filters
  - Implement Pro tier check for full-text search
  - Add snippet highlighting in results
  - _Requirements: 17.1, 17.3, 17.5_

- [x] 11.2 Write property tests for search API
  - **Property 55: Search Filter Combination**
  - **Property 56: Pro Full-Text Search Access**
  - **Property 58: Search Snippet Highlighting**
  - **Validates: Requirements 17.2, 17.3, 17.5**

## Phase 5: Background Job Queue and Workers

- [x] 12. Set up job queue infrastructure
- [x] 12.1 Configure BullMQ with Redis
  - Create job queue for snapshot processing
  - Create job queue for indexing
  - Create job queue for maintenance tasks
  - Configure retry logic with exponential backoff
  - _Requirements: 18.1, 18.3_

- [x] 12.2 Write property tests for job queue
  - **Property 59: Job Enqueueing**
  - **Property 61: Job Retry with Backoff**
  - **Property 62: Job Priority Processing**
  - **Validates: Requirements 18.1, 18.3, 18.4**

- [x] 13. Implement snapshot worker
- [x] 13.1 Create snapshot processing worker
  - Implement page fetching with Playwright/Puppeteer
  - Extract main content and strip boilerplate
  - Generate screenshot thumbnails
  - Store snapshots in S3/MinIO
  - Update bookmark records with snapshot paths
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 18.2_

- [x] 13.2 Write property tests for snapshot worker
  - **Property 15: Content Extraction Quality**
  - **Property 27: Snapshot Creation**
  - **Property 29: Thumbnail Generation**
  - **Property 30: Snapshot Storage Format**
  - **Property 60: Snapshot Workflow Completion**
  - **Property 63: Snapshot Completion Status Update**
  - **Validates: Requirements 5.4, 9.1, 9.3, 9.4, 18.2, 18.5**

- [x] 14. Implement index worker
- [x] 14.1 Create content indexing worker
  - Retrieve snapshots from S3/MinIO
  - Extract text from HTML and PDFs
  - Clean and normalize text
  - Index documents in search engine
  - Update bookmark indexed status
  - _Requirements: 8.2, 8.5, 15.2, 18.2_

- [x] 14.2 Write property tests for index worker
  - **Property 23: Content Indexing Cleanliness**
  - **Property 26: PDF Text Extraction**
  - **Property 48: PDF Upload Text Extraction**
  - **Validates: Requirements 8.2, 8.5, 15.2**

- [x] 15. Implement maintenance worker
- [x] 15.1 Create duplicate detection job
  - Normalize URLs (remove tracking parameters)x$x$
  - Compute content hashes
  - Flag duplicate bookmarks
  - _Requirements: 19.1, 19.2, 19.3_

- [x] 15.2 Write property tests for duplicate detection
  - **Property 64: URL Normalization**
  - **Property 65: Duplicate Flagging**
  - **Property 66: Content Hash Duplicate Detection**
  - **Validates: Requirements 19.1, 19.2, 19.3**

- [x] 15.3 Create broken link scanner job
  - Request saved URLs with timeout
  - Mark bookmarks as broken on 4xx/5xx/timeout
  - Schedule retries for timeouts
  - _Requirements: 20.1, 20.2, 20.3_

- [x] 15.4 Write property tests for broken link detection
  - **Property 67: Broken Link Detection**
  - **Property 68: Broken Link Filtering**
  - **Validates: Requirements 20.1, 20.2, 20.3, 20.5**

- [x] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Pro Features - Highlights and Annotations

- [x] 17. Implement highlights system
- [x] 17.1 Create highlight CRUD endpoints
  - GET /v1/highlights - list highlights
  - POST /v1/highlights - create highlight
  - PUT /v1/highlights/:id - update highlight
  - DELETE /v1/highlights/:id - delete highlight
  - Enforce Pro tier access
  - _Requirements: 10.1, 10.3_

- [x] 17.2 Write property tests for highlights
  - **Property 31: Highlight Storage Completeness**
  - **Property 32: Highlight Color Update**
  - **Property 16: Highlight Creation with Context**
  - **Validates: Requirements 10.1, 10.3, 6.4**

- [x] 17.3 Integrate highlights with search
  - Index highlight text and annotations
  - Include highlights in search results
  - _Requirements: 10.4_

- [x] 17.4 Write property test for highlight search
  - **Property 33: Highlight Search Integration**
  - **Validates: Requirements 10.4**

## Phase 7: Pro Features - File Uploads

- [x] 18. Implement file upload system
- [x] 18.1 Create file upload endpoints
  - POST /v1/files/upload - upload file
  - GET /v1/files/:id - retrieve file
  - DELETE /v1/files/:id - delete file
  - Enforce Pro tier access and size limits
  - _Requirements: 15.1, 15.3_

- [x] 18.2 Write property tests for file uploads
  - **Property 47: File Upload Storage**
  - **Property 49: File Serving**
  - **Validates: Requirements 15.1, 15.3**

- [x] 18.3 Implement PDF text extraction
  - Extract text from uploaded PDFs
  - Index PDF content for full-text search
  - _Requirements: 15.2_

## Phase 8: Pro Features - Backups

- [x] 19. Implement backup system
- [x] 19.1 Create backup generation service
  - Generate complete user data export (JSON)
  - Include all bookmarks, collections, tags, highlights, metadata
  - Include snapshot and file references
  - Store backup archives in S3/MinIO
  - _Requirements: 11.1, 11.3_

- [x] 19.2 Write property tests for backups
  - **Property 34: Backup Completeness**
  - **Property 36: Backup Format Round-Trip**
  - **Validates: Requirements 11.1, 11.3, 11.5**

- [x] 19.2 Create backup endpoints
  - GET /v1/backups - list backups
  - POST /v1/backups/generate - generate on-demand backup
  - GET /v1/backups/:id/download - download backup
  - Enforce Pro tier access
  - _Requirements: 11.2_

- [x] 19.3 Implement automated backup scheduling
  - Schedule daily backups for Pro users
  - Implement retention policy (keep last 30 backups)
  - _Requirements: 11.1, 11.4_

- [x] 19.4 Write property test for backup retention
  - **Property 35: Backup Retention Policy**
  - **Validates: Requirements 11.4**

## Phase 9: Pro Features - Sharing and Collaboration

- [x] 20. Implement collection sharing
- [x] 20.1 Create sharing endpoints
  - POST /v1/collections/:id/share - share collection with user
  - DELETE /v1/collections/:id/share/:userId - revoke access
  - Implement permission roles (owner, editor, viewer)
  - _Requirements: 12.1_

- [x] 20.2 Write property tests for sharing
  - **Property 37: Permission Creation**
  - **Property 39: Collaborative Editing Visibility**
  - **Validates: Requirements 12.1, 12.3**

- [x] 20.3 Implement public collection sharing
  - Generate unique share slugs
  - Create public collection view endpoint
  - Enable unauthenticated read-only access
  - _Requirements: 12.2, 12.4_

- [x] 20.4 Write property test for public sharing
  - **Property 38: Public Share Slug Uniqueness**
  - **Validates: Requirements 12.2**

## Phase 10: Pro Features - Reminders

- [x] 21. Implement reminder system
- [x] 21.1 Create reminder CRUD operations
  - Create reminder storage and retrieval
  - Implement reminder scheduling
  - Support notification channels (email, push, in-app)
  - _Requirements: 13.1_

- [x] 21.2 Write property tests for reminders
  - **Property 40: Reminder Storage**
  - **Property 41: Reminder Dismissal**
  - **Property 42: Recurring Reminder Generation**
  - **Validates: Requirements 13.1, 13.3, 13.4**

- [x] 21.3 Implement reminder notification worker
  - Poll for due reminders
  - Trigger notifications based on user preferences
  - Mark reminders as completed
  - _Requirements: 13.2_

## Phase 11: Pro Features - Batch Operations

- [x] 22. Implement bulk operations
- [x] 22.1 Create bulk action endpoint
  - POST /v1/bookmarks/bulk - bulk operations
  - Support bulk tag add/remove
  - Support bulk move to collection
  - Support bulk delete
  - Implement async processing for large batches (>100 items)
  - _Requirements: 14.1, 14.2, 14.3, 14.5_

- [x] 22.2 Write property tests for bulk operations
  - **Property 43: Bulk Tag Application**
  - **Property 44: Bulk Move Atomicity**
  - **Property 45: Bulk Delete**
  - **Validates: Requirements 14.1, 14.2, 14.3**

- [x] 22.3 Implement custom ordering
  - Add drag-and-drop ordering support
  - Persist custom order in database
  - Return bookmarks in custom order
  - _Requirements: 14.4_

- [x] 22.4 Write property test for custom ordering
  - **Property 46: Custom Ordering Persistence**
  - **Validates: Requirements 14.4**

- [x] 23. Checkpoint - Ensure all tests pass
  - All tests passing (110 passed, 1 skipped due to BullMQ serialization issue)

## Phase 12: Import and Export

- [x] 24. Implement import functionality
- [x] 24.1 Create HTML bookmark import
  - POST /v1/import/html - import bookmarks HTML
  - Parse HTML bookmark files
  - Preserve folder structure as collections
  - Handle duplicate URLs
  - _Requirements: 7.1_

- [x] 24.2 Write property test for HTML import
  - **Property 18: HTML Import Round-Trip**
  - **Validates: Requirements 7.1, 7.5**

- [x] 24.3 Create JSON import
  - POST /v1/import/json - import JSON data
  - Support full data import with metadata
  - _Requirements: 7.1_

- [x] 25. Implement export functionality
- [x] 25.1 Create export endpoints
  - GET /v1/export/:collectionId - export collection
  - Support multiple formats (HTML, CSV, TXT, JSON)
  - Include all metadata in JSON exports
  - Generate browser-compatible HTML exports
  - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [x] 25.2 Write property tests for export
  - **Property 19: Export Completeness**
  - **Property 20: Filtered Export Accuracy**
  - **Property 21: JSON Export Completeness**
  - **Validates: Requirements 7.2, 7.3, 7.4**

## Phase 13: Plan Tier Management

- [x] 26. Implement plan tier enforcement
- [x] 26.1 Create plan upgrade/downgrade logic
  - Implement plan change endpoint
  - Enable Pro features on upgrade
  - Trigger initial backup on upgrade
  - Disable Pro features on downgrade
  - Apply retention policies on downgrade
  - _Requirements: 27.3, 27.4_

- [x] 26.2 Write property tests for plan management
  - **Property 80: Plan Upgrade Activation**
  - **Property 81: Plan Downgrade Deactivation**
  - **Property 82: Free Tier Capabilities**
  - **Validates: Requirements 27.3, 27.4, 27.5**

## Phase 14: Security and Input Validation

- [x] 27. Implement security measures
- [x] 27.1 Add input validation and sanitization
  - Validate all API inputs with JSON Schema
  - Sanitize user inputs to prevent XSS
  - Implement SQL injection prevention (parameterized queries)
  - _Requirements: 21.2_

- [x] 27.2 Write property test for input validation
  - **Property 69: Input Validation**
  - **Validates: Requirements 21.2**

- [x] 27.3 Implement GDPR compliance features
  - Create complete data export endpoint
  - Implement account deletion with data cleanup
  - _Requirements: 22.2, 22.3_

- [x] 27.4 Write property test for GDPR export
  - **Property 71: GDPR Data Export**
  - **Validates: Requirements 22.2**

## Phase 15: Synchronization

- [x] 28. Implement cross-device sync
- [x] 28.1 Create sync endpoints
  - Implement delta synchronization
  - Add WebSocket support for real-time updates
  - Handle offline sync on reconnection
  - _Requirements: 24.1, 24.3_

- [x] 28.2 Write property tests for sync
  - **Property 72: Offline Synchronization**
  - **Property 73: Conflict Resolution**
  - **Validates: Requirements 24.3, 24.4**

## Phase 16: Public API and OAuth

- [x] 29. Implement developer API
- [x] 29.1 Create OAuth client registration
  - POST /v1/oauth/clients - register OAuth client
  - Implement client credential management
  - _Requirements: 25.1_

- [x] 29.2 Write property tests for OAuth
  - **Property 74: OAuth Client Registration**
  - **Property 75: OAuth Token Scoping**
  - **Property 76: Developer API Rate Limiting**
  - **Property 77: Rate Limit Response**
  - **Validates: Requirements 25.1, 25.2, 25.3, 25.5**

- [x] 29.3 Generate OpenAPI specification
  - Create OpenAPI 3.0 spec from endpoints
  - Include example requests and responses
  - _Requirements: 25.4_

## Phase 17: Frontend Web Application

- [x] 30. Set up React frontend
- [x] 30.1 Create React app with TypeScript and Vite
  - Set up project structure
  - Configure Tailwind CSS
  - Set up Zustand for state management
  - Configure React Query for API calls
  - Set up React Router
  - _Requirements: 26.1_

- [x] 30.2 Implement authentication UI
  - Create login/register forms
  - Implement JWT token storage
  - Create protected route wrapper
  - _Requirements: 16.1, 16.2_

- [-] 31. Implement bookmark views
- [x] 31.1 Create Grid view component
  - Display bookmarks as cards with thumbnails
  - Show cover images, titles, excerpts
  - _Requirements: 4.1_

- [x] 31.2 Create Headlines view component
  - Display bookmarks as title list
  - Show minimal metadata
  - _Requirements: 4.2_

- [x] 31.3 Create Masonry view component
  - Implement Pinterest-like fluid layout
  - Handle varying card heights
  - _Requirements: 4.3_

- [x] 31.4 Create List view component
  - Display bookmarks as rows
  - Show complete metadata
  - _Requirements: 4.4_

- [x] 31.5 Implement view mode persistence
  - Save view preference to backend
  - Load and apply saved preference
  - _Requirements: 4.5_

- [x] 31.6 Write property test for view preference
  - **Property 14: View Preference Persistence**
  - **Validates: Requirements 4.5**

- [x] 32. Implement collection management UI
- [x] 32.1 Create collection sidebar
  - Display collection hierarchy
  - Support drag-and-drop organization
  - Show collection icons
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 32.2 Create collection CRUD dialogs
  - Collection creation modal
  - Collection edit modal
  - Collection delete confirmation
  - _Requirements: 2.1, 2.4_

- [x] 33. Implement bookmark management UI
- [x] 33.1 Create bookmark creation form
  - URL input with metadata extraction
  - Collection selection
  - Tag input with autocomplete
  - _Requirements: 1.1_

- [x] 33.2 Create bookmark detail view
  - Display all bookmark metadata
  - Show tags and highlights
  - Provide edit and delete actions
  - _Requirements: 1.2_

- [x] 33.3 Implement bookmark filtering UI
  - Tag filter chips
  - Type, domain, date range filters
  - Search input
  - _Requirements: 3.2, 3.3_

- [x] 34. Implement search UI
- [x] 34.1 Create search interface
  - Search input with autocomplete
  - Filter controls
  - Results display with snippets
  - _Requirements: 17.1, 17.5_

- [x] 34.2 Add Pro full-text search toggle
  - Show Pro badge for full-text search
  - Enforce Pro tier access
  - _Requirements: 17.3_

- [x] 35. Implement instant preview
- [x] 35.1 Create preview modal
  - Display readable article view
  - Embed video player for videos
  - Show archived snapshot when original unavailable
  - _Requirements: 5.1, 5.2_

- [x] 36. Implement Pro features UI
- [x] 36.1 Create highlights UI
  - Text selection highlighting tool
  - Color picker for highlights
  - Annotation editor with Markdown support
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 36.2 Create file upload UI
  - Drag-and-drop file upload
  - Upload progress indicator
  - File size limit display
  - _Requirements: 15.1_

- [x] 36.3 Create backup management UI
  - List backups with dates and sizes
  - Generate backup button
  - Download backup button
  - _Requirements: 11.2_

- [x] 36.4 Create sharing UI
  - Share collection dialog
  - User permission management
  - Public link generation
  - _Requirements: 12.1, 12.2_

- [x] 37. Implement import/export UI
- [x] 37.1 Create import dialog
  - File upload for HTML/JSON import
  - Import progress indicator
  - _Requirements: 7.1_

- [x] 37.2 Create export dialog
  - Format selection (HTML, CSV, TXT, JSON)
  - Collection/search results export
  - Download button
  - _Requirements: 7.2, 7.3_

- [x] 38. Implement accessibility and themes
- [x] 38.1 Add keyboard navigation
  - Implement keyboard shortcuts
  - Focus management
  - _Requirements: 26.2_

- [x] 38.2 Implement light/dark themes
  - Theme toggle
  - Accessible color contrast
  - _Requirements: 26.3_

- [x] 38.3 Add ARIA attributes
  - Screen reader support
  - Semantic HTML
  - _Requirements: 26.4_

- [ ] 39. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 18: Browser Extension

- [x] 40. Set up browser extension project
- [x] 40.1 Create extension structure
  - Set up Manifest V3 configuration
  - Create background service worker
  - Create content scripts
  - Create popup and side panel UI
  - Configure build for multiple browsers
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 40.2 Implement extension authentication
  - OAuth2 PKCE flow for extension
  - Secure token storage
  - Token refresh handling
  - _Requirements: 16.3_

- [x] 41. Implement bookmark saving
- [x] 41.1 Create page save functionality
  - Extract page metadata (OpenGraph, schema.org)
  - Send bookmark to API
  - Show success notification
  - _Requirements: 6.1_

- [x] 41.2 Create context menu actions
  - Save image context menu
  - Save video context menu
  - Save link context menu
  - _Requirements: 6.2_

- [x] 41.3 Implement save all tabs
  - Bulk save all open tabs
  - Add bulk tag with date
  - _Requirements: 6.5_

- [x] 41.4 Write property test for bulk tab save
  - **Property 17: Bulk Tab Save**
  - **Validates: Requirements 6.5**

- [x] 42. Implement highlight capture
- [x] 42.1 Create text selection handler
  - Capture selected text
  - Extract position context
  - Send highlight to API
  - _Requirements: 6.4_

- [x] 42.2 Create side panel UI
  - Display recent bookmarks
  - Quick save interface
  - Browse collections
  - _Requirements: 6.3_

## Phase 19: Testing and Quality Assurance

- [x] 43. Complete remaining property-based tests
  - Review all 82 correctness properties
  - Ensure each property has a corresponding test
  - Run all property tests with 100+ iterations
  - _Requirements: All_

- [ ] 44. Write integration tests
  - Test complete bookmark creation → snapshot → indexing flow
  - Test authentication → authorization flow
  - Test search with filters end-to-end
  - Test import → export round-trip
  - _Requirements: All_

- [ ] 45. Write E2E tests with Playwright
  - Test user registration and login
  - Test bookmark creation via web UI
  - Test bookmark creation via extension
  - Test search and filtering
  - Test collection management
  - Test export and import
  - _Requirements: All_

- [ ] 46. Perform load testing
  - Test concurrent user load
  - Test search query latency with 100k bookmarks
  - Test snapshot processing throughput
  - Verify API response times < 200ms (95th percentile)
  - _Requirements: 23.1, 23.3_

## Phase 20: Deployment and Infrastructure

- [ ] 47. Create Docker images
- [ ] 47.1 Write Dockerfiles
  - Create Dockerfile for API server
  - Create Dockerfile for snapshot worker
  - Create Dockerfile for index worker
  - Create Dockerfile for maintenance worker
  - Create Dockerfile for frontend
  - _Requirements: All_

- [ ] 47.2 Create Docker Compose for local development
  - Configure PostgreSQL service
  - Configure Redis service
  - Configure Elasticsearch/MeiliSearch service
  - Configure MinIO service
  - Configure all application services
  - _Requirements: All_

- [ ] 48. Create Kubernetes manifests
- [ ] 48.1 Write K8s deployment configs
  - Create deployments for API (with HPA)
  - Create deployments for workers
  - Create StatefulSet for Elasticsearch
  - Create PersistentVolumeClaims
  - _Requirements: All_

- [ ] 48.2 Write K8s service configs
  - Create services for API
  - Create services for databases
  - Create ingress configuration
  - _Requirements: All_

- [ ] 49. Create Terraform infrastructure code
- [ ] 49.1 Write Terraform modules
  - VPC and networking module
  - RDS PostgreSQL module
  - ElastiCache Redis module
  - Elasticsearch/OpenSearch module
  - S3 buckets module
  - ECS/EKS cluster module
  - Load balancer module
  - _Requirements: All_

- [ ] 49.2 Configure monitoring and alerting
  - Set up CloudWatch/Prometheus metrics
  - Configure log aggregation
  - Create alerting rules
  - Set up dashboards
  - _Requirements: All_

- [ ] 50. Create CI/CD pipeline
- [ ] 50.1 Write GitHub Actions workflows
  - Lint and type check workflow
  - Unit test workflow
  - Property-based test workflow
  - Integration test workflow
  - Build Docker images workflow
  - E2E test workflow
  - Deploy workflow
  - _Requirements: All_

## Phase 21: Documentation and Demo

- [ ] 51. Create documentation
- [ ] 51.1 Write README
  - Project overview
  - Architecture diagram
  - Setup instructions
  - Development guide
  - _Requirements: All_

- [ ] 51.2 Write API documentation
  - OpenAPI specification
  - Authentication guide
  - Rate limiting documentation
  - Example requests with Postman collection
  - _Requirements: 25.4_

- [ ] 51.3 Write deployment guide
  - Infrastructure setup
  - Configuration guide
  - Monitoring setup
  - Backup and recovery procedures
  - _Requirements: All_

- [ ] 52. Create demo dataset
- [ ] 52.1 Generate seed data
  - Create 50 sample bookmarks
  - Create multiple collections
  - Add tags to bookmarks
  - Create highlights and annotations
  - Create shared collections
  - _Requirements: All_

- [ ] 52.2 Create demo scripts
  - Seed database script
  - Demo user creation script
  - Sample API requests
  - _Requirements: All_

- [ ] 53. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 82 correctness properties are tested
  - Confirm all requirements are implemented
  - Review code quality and documentation
