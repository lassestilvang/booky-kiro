# Architecture Documentation

## Overview

The Bookmark Manager Platform is designed as a modern, scalable web application following microservices-inspired architecture principles. The system separates concerns into distinct layers: client applications, API gateway, application services, background processing, and data storage.

## Design Principles

1. **Separation of Concerns** - Clear boundaries between presentation, business logic, and data access
2. **Scalability** - Stateless API servers, horizontal scaling, and async processing
3. **Reliability** - Retry logic, circuit breakers, and graceful degradation
4. **Security** - Defense in depth with multiple security layers
5. **Testability** - Property-based testing for correctness guarantees
6. **Maintainability** - Clean code, comprehensive documentation, and type safety

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Web App      │  │ Extension    │  │ Third-party  │          │
│  │ React + TS   │  │ Manifest V3  │  │ Apps (OAuth) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Rate Limiting │ Authentication │ Request Validation      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ REST API     │  │ Auth Service │  │ WebSocket    │          │
│  │ Express.js   │  │ OAuth2 + JWT │  │ Sync Handler │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Processing Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Snapshot     │  │ Index        │  │ Maintenance  │          │
│  │ Worker       │  │ Worker       │  │ Worker       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                    ┌──────────────┐                              │
│                    │ Job Queue    │                              │
│                    │ BullMQ/Redis │                              │
│                    └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ PostgreSQL   │  │ MeiliSearch  │  │ Redis        │          │
│  │ Primary DB   │  │ Full-text    │  │ Cache +      │          │
│  │              │  │ Search       │  │ Sessions     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                    ┌──────────────┐                              │
│                    │ MinIO/S3     │                              │
│                    │ Object       │                              │
│                    │ Storage      │                              │
│                    └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Client Layer

#### Web Application

- **Technology**: React 18 + TypeScript + Vite
- **State Management**: Zustand (client state) + React Query (server state)
- **Styling**: Tailwind CSS with custom design system
- **Features**:
  - Responsive design for mobile, tablet, desktop
  - Multiple view modes (Grid, Headlines, Masonry, List)
  - Real-time sync via WebSocket
  - Offline-first with service worker (future)

#### Browser Extension

- **Technology**: Manifest V3 + WebExtensions API
- **Components**:
  - Background service worker for API communication
  - Content scripts for page metadata extraction
  - Popup UI for quick actions
  - Side panel for browsing bookmarks
- **Features**:
  - One-click bookmark saving
  - Context menu integration
  - Bulk tab saving
  - Highlight capture

#### Third-party Applications

- **Authentication**: OAuth 2.0 with PKCE
- **API Access**: RESTful API with rate limiting
- **Documentation**: OpenAPI 3.0 specification

### 2. API Gateway Layer

#### Rate Limiting

- **Implementation**: Token bucket algorithm with Redis
- **Limits**:
  - Free tier: 100 requests/minute per user
  - Pro tier: 500 requests/minute per user
  - Developer API: Custom limits per application
- **Response**: HTTP 429 with `Retry-After` header

#### Authentication

- **JWT**: RS256 signing with 15-minute access tokens
- **OAuth 2.0**: Authorization code flow with PKCE
- **Refresh Tokens**: 7-day lifetime with rotation
- **Session Management**: Redis-backed sessions

#### Request Validation

- **Schema Validation**: Zod schemas for all endpoints
- **Sanitization**: XSS prevention and input cleaning
- **Error Handling**: Structured error responses with request IDs

### 3. Application Layer

#### REST API Server

- **Framework**: Express.js with TypeScript
- **Architecture**: Layered architecture (Routes → Services → Repositories)
- **Middleware Stack**:
  1. Request logging
  2. CORS handling
  3. Authentication
  4. Rate limiting
  5. Request validation
  6. Error handling
- **API Versioning**: URL-based versioning (/v1/)

#### Services Layer

- **Bookmark Service**: CRUD operations, duplicate detection
- **Collection Service**: Hierarchy management, sharing
- **Search Service**: Query building, result ranking
- **File Service**: Upload handling, storage management
- **Backup Service**: Archive generation, retention policies
- **Auth Service**: User registration, token management
- **OAuth Service**: Client registration, authorization flow
- **Sync Service**: Delta synchronization, conflict resolution

#### Repository Layer

- **Pattern**: Repository pattern for data access abstraction
- **Connection Pooling**: pg-pool with 20 max connections
- **Query Optimization**: Prepared statements, indexes
- **Transaction Management**: ACID guarantees for multi-step operations

### 4. Processing Layer

#### Job Queue (BullMQ)

- **Backend**: Redis for job storage
- **Features**:
  - Priority queues
  - Retry with exponential backoff
  - Job scheduling
  - Progress tracking
  - Dead letter queue
- **Queues**:
  - `snapshot-queue`: Page archival jobs
  - `index-queue`: Content indexing jobs
  - `maintenance-queue`: Cleanup and scanning jobs
  - `backup-queue`: Backup generation jobs
  - `reminder-queue`: Notification jobs

#### Snapshot Worker

- **Purpose**: Archive web pages for offline access
- **Process**:
  1. Fetch page HTML with Playwright/Puppeteer
  2. Extract main content (remove ads, navigation)
  3. Download and embed assets
  4. Generate screenshot thumbnail
  5. Store in MinIO/S3
  6. Update bookmark record
  7. Enqueue indexing job
- **Concurrency**: 5 concurrent jobs
- **Timeout**: 30 seconds per page

#### Index Worker

- **Purpose**: Extract and index content for full-text search
- **Process**:
  1. Retrieve snapshot from storage
  2. Extract text (HTML, PDF, EPUB)
  3. Clean and normalize text
  4. Index in MeiliSearch
  5. Update indexed status
- **Concurrency**: 10 concurrent jobs
- **Batch Size**: 100 documents per batch

#### Maintenance Worker

- **Purpose**: Background maintenance tasks
- **Jobs**:
  - **Duplicate Detection**: URL normalization, content hashing
  - **Broken Link Scanner**: HTTP HEAD requests, status checking
  - **Backup Cleanup**: Retention policy enforcement
  - **Index Optimization**: Search index maintenance
- **Schedule**: Runs daily at 2 AM UTC

### 5. Data Layer

#### PostgreSQL

- **Version**: 15+
- **Schema**: 12 tables with proper indexes and foreign keys
- **Features**:
  - ACID transactions
  - Row-level security (future)
  - Full-text search (pg_trgm for basic search)
  - JSON columns for flexible data
- **Backup**: Daily automated backups with point-in-time recovery
- **Replication**: Primary-replica setup for read scaling

#### MeiliSearch

- **Purpose**: Full-text search engine
- **Index Schema**:
  - Searchable attributes: title, content, excerpt, tags
  - Filterable attributes: type, domain, collection_id, created_at
  - Sortable attributes: created_at, updated_at
- **Features**:
  - Typo tolerance
  - Synonym support
  - Faceted search
  - Highlighting
- **Performance**: < 200ms for 100k documents

#### Redis

- **Use Cases**:
  - Session storage
  - Job queue (BullMQ)
  - Rate limiting counters
  - Cache for frequently accessed data
- **Persistence**: RDB + AOF for durability
- **Eviction**: LRU policy for cache entries

#### MinIO/S3

- **Purpose**: Object storage for snapshots, uploads, backups
- **Structure**:
  ```
  /snapshots/{userId}/{bookmarkId}/
  /uploads/{userId}/{fileId}
  /backups/{userId}/{timestamp}.zip
  /thumbnails/{bookmarkId}.jpg
  ```
- **Features**:
  - Versioning for backups
  - Lifecycle policies for retention
  - Pre-signed URLs for secure access
  - CDN integration for static assets

## Data Flow

### Bookmark Creation Flow

```
1. User submits bookmark via web app/extension
   ↓
2. API validates request and authenticates user
   ↓
3. Bookmark service creates database record
   ↓
4. Job enqueued for snapshot processing (Pro users)
   ↓
5. Response returned to client (201 Created)
   ↓
6. Snapshot worker fetches and archives page
   ↓
7. Index worker extracts and indexes content
   ↓
8. WebSocket notification sent to client
```

### Search Flow

```
1. User submits search query
   ↓
2. API validates and checks plan tier
   ↓
3. Search service builds query
   ↓
4. MeiliSearch executes search
   ↓
5. Results ranked and filtered
   ↓
6. Snippets highlighted
   ↓
7. Response returned with results
```

### Sync Flow

```
1. Client connects via WebSocket
   ↓
2. Server authenticates connection
   ↓
3. Client sends last sync timestamp
   ↓
4. Server queries delta changes
   ↓
5. Changes streamed to client
   ↓
6. Client applies changes locally
   ↓
7. Bidirectional sync for conflicts
```

## Scalability Considerations

### Horizontal Scaling

- **API Servers**: Stateless, can scale to N instances
- **Workers**: Independent processes, scale based on queue depth
- **Database**: Read replicas for query distribution
- **Search**: MeiliSearch cluster for high availability

### Vertical Scaling

- **Database**: Increase CPU/RAM for complex queries
- **Redis**: Increase memory for larger cache
- **Workers**: Increase resources for faster processing

### Caching Strategy

- **L1 Cache**: In-memory cache in API servers (5 minutes TTL)
- **L2 Cache**: Redis cache (1 hour TTL)
- **CDN**: Static assets and public content
- **Database**: Query result caching

### Performance Optimizations

- **Database Indexes**: Covering indexes for common queries
- **Connection Pooling**: Reuse database connections
- **Batch Processing**: Bulk operations for efficiency
- **Lazy Loading**: Load data on demand
- **Pagination**: Cursor-based pagination for large result sets

## Security Architecture

### Defense in Depth

1. **Network Layer**
   - TLS 1.3 for all connections
   - VPC isolation for internal services
   - Network policies for pod-to-pod communication

2. **Application Layer**
   - Input validation with Zod schemas
   - Output encoding to prevent XSS
   - CSRF tokens for state-changing operations
   - Rate limiting per user and IP

3. **Data Layer**
   - Parameterized queries to prevent SQL injection
   - Encryption at rest for sensitive data
   - Encryption in transit for all connections
   - Regular security audits

4. **Authentication & Authorization**
   - JWT with RS256 signing
   - OAuth 2.0 with PKCE for public clients
   - Role-based access control (RBAC)
   - Plan tier enforcement at API level

### Threat Model

| Threat           | Mitigation                                    |
| ---------------- | --------------------------------------------- |
| SQL Injection    | Parameterized queries, ORM                    |
| XSS              | Input sanitization, CSP headers               |
| CSRF             | CSRF tokens, SameSite cookies                 |
| DDoS             | Rate limiting, CDN, auto-scaling              |
| Data Breach      | Encryption, access controls, auditing         |
| Account Takeover | Strong passwords, 2FA (future), rate limiting |
| API Abuse        | Rate limiting, OAuth scopes, monitoring       |

## Monitoring & Observability

### Metrics

- **Application Metrics**: Request rate, error rate, latency
- **Business Metrics**: Bookmarks created, searches performed, active users
- **Infrastructure Metrics**: CPU, memory, disk, network
- **Database Metrics**: Query performance, connection pool, replication lag

### Logging

- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Log Aggregation**: Centralized logging with search
- **Retention**: 30 days for application logs, 90 days for audit logs

### Tracing

- **Distributed Tracing**: Request tracing across services
- **Correlation IDs**: Track requests end-to-end
- **Performance Profiling**: Identify bottlenecks

### Alerting

- **Error Rate**: Alert if > 1% of requests fail
- **Latency**: Alert if p95 > 500ms
- **Queue Depth**: Alert if jobs backing up
- **Database**: Alert on connection pool exhaustion
- **Disk Space**: Alert at 80% capacity

## Disaster Recovery

### Backup Strategy

- **Database**: Daily full backups, hourly incremental
- **Object Storage**: Versioning enabled, cross-region replication
- **Configuration**: Version controlled in Git

### Recovery Procedures

- **RTO**: 4 hours (Recovery Time Objective)
- **RPO**: 1 hour (Recovery Point Objective)
- **Runbooks**: Documented procedures for common failures
- **Testing**: Quarterly disaster recovery drills

## Future Enhancements

1. **Mobile Apps**: Native iOS and Android applications
2. **Offline Mode**: Service worker for offline access
3. **AI Features**: Smart tagging, content summarization
4. **Social Features**: Follow users, discover collections
5. **Advanced Search**: Semantic search, filters
6. **Integrations**: Zapier, IFTTT, Slack, Discord
7. **Analytics**: Usage analytics, insights dashboard
8. **Multi-tenancy**: Organization accounts with team features

## References

- [Requirements Document](../.kiro/specs/bookmark-manager-platform/requirements.md)
- [Design Document](../.kiro/specs/bookmark-manager-platform/design.md)
- [API Documentation](API.md)
- [Deployment Guide](DEPLOYMENT.md)
