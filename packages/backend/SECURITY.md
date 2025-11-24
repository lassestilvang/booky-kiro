# Security Implementation

This document describes the security measures implemented in the Bookmark Manager Platform backend.

## Input Validation and Sanitization

### Validation Strategy

All API inputs are validated using **Zod** schemas before processing. This ensures:

- Type safety at runtime
- Consistent validation rules across endpoints
- Automatic error messages for invalid inputs
- Prevention of malformed data reaching business logic

### Validation Middleware

The `validation.middleware.ts` provides reusable validation functions:

```typescript
import {
  validateBody,
  validateQuery,
  validateParams,
} from './middleware/validation.middleware.js';

// Validate request body
router.post('/bookmarks', validateBody(createBookmarkSchema), handler);

// Validate query parameters
router.get('/bookmarks', validateQuery(searchQuerySchema), handler);

// Validate route parameters
router.get('/bookmarks/:id', validateParams(idParamSchema), handler);
```

### XSS Prevention

All user inputs are sanitized to prevent Cross-Site Scripting (XSS) attacks:

1. **HTML Sanitization**: Using `isomorphic-dompurify` to clean HTML content
   - Only allows safe HTML tags (b, i, em, strong, a, p, br, ul, ol, li, code, pre)
   - Strips dangerous attributes and JavaScript
   - Prevents data attributes

2. **Text Sanitization**: Encoding special characters
   - Converts `<`, `>`, `"`, `'`, `/` to HTML entities
   - Prevents script injection in plain text fields

3. **Automatic Sanitization**: Middleware automatically sanitizes:
   - Request body (`sanitizeBody`)
   - Query parameters (`sanitizeQuery`)

### Common Validation Schemas

Pre-defined schemas for common patterns:

```typescript
import { commonSchemas } from './middleware/validation.middleware.js';

// UUID validation
const schema = z.object({
  id: commonSchemas.uuid,
});

// Email validation
const schema = z.object({
  email: commonSchemas.email,
});

// URL validation
const schema = z.object({
  url: commonSchemas.url,
});

// Pagination
const schema = commonSchemas.pagination;
```

## SQL Injection Prevention

### Parameterized Queries

All database queries use **parameterized queries** with PostgreSQL's `pg` library:

```typescript
// ✅ SAFE - Parameterized query
await pool.query('SELECT * FROM bookmarks WHERE id = $1', [bookmarkId]);

// ❌ UNSAFE - String concatenation (NEVER DO THIS)
await pool.query(`SELECT * FROM bookmarks WHERE id = '${bookmarkId}'`);
```

### Repository Pattern

The `BaseRepository` class ensures all queries use parameterized placeholders:

- `$1`, `$2`, `$3` for parameter binding
- Automatic escaping of values
- No string concatenation in queries

### Query Building

Dynamic queries are built safely:

```typescript
// Safe dynamic WHERE clause
const conditions = Object.keys(filters).map((key, index) => {
  params.push(filters[key]);
  return `${toSnakeCase(key)} = $${index + 1}`;
});
query += ` WHERE ${conditions.join(' AND ')}`;
```

## Authentication and Authorization

### JWT Token Security

- **Algorithm**: RS256 (RSA with SHA-256)
- **Token Types**: Access tokens (short-lived) and refresh tokens (long-lived)
- **Signature Verification**: All tokens verified before processing
- **Expiration**: Tokens have expiration timestamps

### Password Security

- **Hashing**: bcrypt with cost factor 12
- **No Plain Text**: Passwords never stored in plain text
- **Salt**: Automatic per-password salt generation

### OAuth2 Security

- **PKCE**: Proof Key for Code Exchange for public clients
- **State Parameter**: CSRF protection for OAuth flows
- **Redirect URI Validation**: Strict validation of redirect URIs

## Rate Limiting

Rate limiting prevents abuse and DoS attacks:

- **Per User**: Limits based on authenticated user ID
- **Per IP**: Limits for unauthenticated requests
- **Configurable**: Different limits for different endpoints
- **Response**: HTTP 429 with `Retry-After` header

## GDPR Compliance

### Data Export

Complete user data export via `/v1/gdpr/export`:

- All bookmarks with metadata and tags
- All collections and hierarchies
- All tags, highlights, files, backups, reminders
- Collection permissions
- User statistics

Export format:

```json
{
  "version": "1.0",
  "exportedAt": "2025-11-24T10:00:00.000Z",
  "user": { ... },
  "bookmarks": [ ... ],
  "collections": [ ... ],
  "tags": [ ... ],
  "highlights": [ ... ],
  "files": [ ... ],
  "backups": [ ... ],
  "reminders": [ ... ],
  "collectionPermissions": [ ... ],
  "statistics": { ... }
}
```

### Account Deletion

Complete account deletion via `/v1/gdpr/account`:

1. Deletes OAuth tokens
2. Deletes collection permissions
3. Deletes reminders
4. Deletes backups
5. Deletes files
6. Deletes highlights
7. Deletes bookmark-tag associations
8. Deletes bookmarks
9. Deletes tags
10. Deletes collections
11. Deletes user account

All deletions are performed in a transaction to ensure atomicity.

## Data Encryption

### In Transit

- **TLS 1.3**: All external communication encrypted
- **HTTPS Only**: No plain HTTP in production
- **Certificate Validation**: Strict certificate checking

### At Rest

- **Database**: PostgreSQL encryption at rest
- **Object Storage**: S3/MinIO encryption at rest
- **Backups**: Encrypted backup archives

## Security Headers

Recommended security headers for production:

```typescript
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  next();
});
```

## Error Handling

### Error Response Format

Consistent error format prevents information leakage:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "details": { ... },
    "timestamp": "2025-11-24T10:00:00.000Z",
    "requestId": "unique-request-id"
  }
}
```

### Error Sanitization

- No stack traces in production
- No internal paths or system information
- Generic messages for unexpected errors
- Detailed logging server-side only

## Logging and Monitoring

### Security Event Logging

Log security-relevant events:

- Failed authentication attempts
- Invalid token usage
- Rate limit violations
- Suspicious input patterns
- Authorization failures

### Log Format

Structured JSON logging:

```json
{
  "timestamp": "2025-11-24T10:00:00.000Z",
  "level": "WARN",
  "event": "FAILED_AUTH",
  "userId": "user-id",
  "ip": "1.2.3.4",
  "requestId": "unique-id",
  "details": { ... }
}
```

## Dependency Security

### Regular Updates

- Regular dependency updates
- Security vulnerability scanning
- Automated dependency updates (Dependabot)

### Audit

```bash
# Check for vulnerabilities
pnpm audit

# Fix vulnerabilities
pnpm audit --fix
```

## Best Practices

### Input Validation Checklist

- ✅ Validate all user inputs
- ✅ Use Zod schemas for type safety
- ✅ Sanitize HTML content
- ✅ Encode special characters
- ✅ Validate file uploads (type, size)
- ✅ Validate URLs and emails
- ✅ Limit string lengths

### Database Security Checklist

- ✅ Use parameterized queries
- ✅ Never concatenate user input
- ✅ Use transactions for multi-step operations
- ✅ Implement proper error handling
- ✅ Use connection pooling
- ✅ Limit query results

### Authentication Checklist

- ✅ Hash passwords with bcrypt
- ✅ Use JWT with RS256
- ✅ Implement token expiration
- ✅ Validate tokens on every request
- ✅ Use HTTPS only
- ✅ Implement rate limiting

### API Security Checklist

- ✅ Validate all inputs
- ✅ Sanitize all outputs
- ✅ Use CORS properly
- ✅ Implement rate limiting
- ✅ Use security headers
- ✅ Log security events
- ✅ Handle errors safely

## Security Testing

### Property-Based Testing

Security properties are tested using fast-check:

- **Property 69**: Input validation prevents injection attacks
- **Property 70**: Rate limiting enforcement
- **Property 71**: GDPR data export completeness

### Manual Testing

Regular security testing:

- SQL injection attempts
- XSS payload testing
- Authentication bypass attempts
- Authorization boundary testing
- Rate limit testing

## Incident Response

### Security Incident Procedure

1. **Detect**: Monitor logs for suspicious activity
2. **Contain**: Disable affected accounts/endpoints
3. **Investigate**: Analyze logs and system state
4. **Remediate**: Fix vulnerability and deploy patch
5. **Notify**: Inform affected users if required
6. **Review**: Post-mortem and process improvement

### Contact

For security issues, contact: security@bookmark-manager.example.com

## Compliance

### Standards

- OWASP Top 10 mitigation
- GDPR compliance (data export, right to be forgotten)
- SOC 2 Type II (planned)

### Audits

- Regular security audits
- Penetration testing
- Code reviews
- Dependency scanning
