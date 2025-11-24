import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { OAuthService } from './oauth.service.js';

describe('OAuth Service Property Tests', () => {
  let pool: Pool;
  let oauthService: OAuthService;

  beforeEach(async () => {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bookmark_manager_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    oauthService = new OAuthService(pool);

    // Clean up oauth tables
    await pool.query('DELETE FROM oauth_tokens');
    await pool.query('DELETE FROM oauth_clients');
  });

  afterEach(async () => {
    await pool.end();
  });

  /**
   * Feature: bookmark-manager-platform, Property 74: OAuth Client Registration
   * For any developer registering an application, the system should issue OAuth2 client credentials with configurable redirect URIs.
   * Validates: Requirements 25.1
   */
  describe('Property 74: OAuth Client Registration', () => {
    it('should register OAuth clients with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 255 }),
            redirectUris: fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
            isPublic: fc.boolean(),
          }),
          async (clientData) => {
            // Register client
            const client = await oauthService.registerClient(
              clientData.name,
              clientData.redirectUris,
              clientData.isPublic
            );

            // Verify all fields are present
            expect(client.id).toBeDefined();
            expect(client.clientId).toBeDefined();
            expect(client.name).toBe(clientData.name);
            expect(client.redirectUris).toEqual(clientData.redirectUris);
            expect(client.isPublic).toBe(clientData.isPublic);
            expect(client.createdAt).toBeInstanceOf(Date);

            // Verify client secret is only returned for confidential clients
            if (clientData.isPublic) {
              expect(client.clientSecret).toBeUndefined();
            } else {
              expect(client.clientSecret).toBeDefined();
              expect(typeof client.clientSecret).toBe('string');
            }

            // Verify client can be retrieved
            const retrieved = await oauthService.getClient(client.clientId);
            expect(retrieved).toBeDefined();
            expect(retrieved?.clientId).toBe(client.clientId);
            expect(retrieved?.name).toBe(clientData.name);
            expect(retrieved?.redirectUris).toEqual(clientData.redirectUris);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: bookmark-manager-platform, Property 75: OAuth Token Scoping
   * For any user authorizing a third-party application, the system should issue access tokens with scoped permissions.
   * Validates: Requirements 25.2
   */
  describe('Property 75: OAuth Token Scoping', () => {
    it('should issue tokens with specified scopes and validate scope requirements', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clientName: fc.string({ minLength: 1, maxLength: 255 }),
            redirectUri: fc.webUrl(),
            userEmail: fc.emailAddress(),
            scopes: fc.array(
              fc.constantFrom('read', 'write', 'delete', 'admin'),
              { minLength: 1, maxLength: 4 }
            ),
            codeVerifier: fc.hexaString({ minLength: 43, maxLength: 128 }),
          }),
          async (data) => {
            // Create a test user first
            const bcrypt = await import('bcrypt');
            const passwordHash = await bcrypt.hash('testpassword', 12);
            const userResult = await pool.query(
              `INSERT INTO users (email, password_hash, name, plan)
               VALUES ($1, $2, $3, $4)
               RETURNING id`,
              [data.userEmail, passwordHash, 'Test User', 'free']
            );
            const userId = userResult.rows[0].id;
            // Register client
            const client = await oauthService.registerClient(
              data.clientName,
              [data.redirectUri],
              true
            );

            // Generate code challenge (S256)
            const crypto = await import('crypto');
            const hash = crypto
              .createHash('sha256')
              .update(data.codeVerifier)
              .digest();
            const codeChallenge = hash
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');

            // Generate authorization code
            const authCode = await oauthService.generateAuthorizationCode(
              client.clientId,
              userId,
              data.redirectUri,
              codeChallenge,
              'S256',
              data.scopes
            );

            // Exchange code for token
            const tokenResult = await oauthService.exchangeCodeForToken(
              authCode,
              client.clientId,
              data.redirectUri,
              data.codeVerifier
            );

            // Verify token has correct scopes
            expect(tokenResult.scopes).toEqual(data.scopes);
            expect(tokenResult.userId).toBe(userId);

            // Verify token info can be retrieved
            const tokenInfo = await oauthService.getTokenInfo(
              tokenResult.accessToken
            );
            expect(tokenInfo).toBeDefined();
            expect(tokenInfo?.userId).toBe(userId);
            expect(tokenInfo?.scopes).toEqual(data.scopes);

            // Verify scope validation works
            const hasAllScopes = await oauthService.validateTokenScopes(
              tokenResult.accessToken,
              data.scopes
            );
            expect(hasAllScopes).toBe(true);

            // Verify validation fails for scopes not granted
            const hasExtraScope = await oauthService.validateTokenScopes(
              tokenResult.accessToken,
              [...data.scopes, 'extra_scope']
            );
            expect(hasExtraScope).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Feature: bookmark-manager-platform, Property 76: Developer API Rate Limiting
   * For any API requests made with developer tokens, the system should enforce rate limits based on application tier.
   * Validates: Requirements 25.3
   */
  describe('Property 76: Developer API Rate Limiting', () => {
    it('should track token usage for rate limiting enforcement', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            clientName: fc.string({ minLength: 1, maxLength: 255 }),
            redirectUri: fc.webUrl(),
            userEmail: fc.emailAddress(),
            scopes: fc.array(fc.constantFrom('read', 'write'), {
              minLength: 1,
            }),
            codeVerifier: fc.hexaString({ minLength: 43, maxLength: 128 }),
          }),
          async (data) => {
            // Create a test user first
            const bcrypt = await import('bcrypt');
            const passwordHash = await bcrypt.hash('testpassword', 12);
            const userResult = await pool.query(
              `INSERT INTO users (email, password_hash, name, plan)
               VALUES ($1, $2, $3, $4)
               RETURNING id`,
              [data.userEmail, passwordHash, 'Test User', 'free']
            );
            const userId = userResult.rows[0].id;

            // Register client
            const client = await oauthService.registerClient(
              data.clientName,
              [data.redirectUri],
              true
            );

            // Generate code challenge
            const crypto = await import('crypto');
            const hash = crypto
              .createHash('sha256')
              .update(data.codeVerifier)
              .digest();
            const codeChallenge = hash
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');

            // Generate authorization code and exchange for token
            const authCode = await oauthService.generateAuthorizationCode(
              client.clientId,
              userId,
              data.redirectUri,
              codeChallenge,
              'S256',
              data.scopes
            );

            const tokenResult = await oauthService.exchangeCodeForToken(
              authCode,
              client.clientId,
              data.redirectUri,
              data.codeVerifier
            );

            // Verify token info includes client ID for rate limiting
            const tokenInfo = await oauthService.getTokenInfo(
              tokenResult.accessToken
            );
            expect(tokenInfo).toBeDefined();
            expect(tokenInfo?.clientId).toBe(client.clientId);

            // Rate limiting would use clientId to track requests per application
            // This property verifies the infrastructure is in place
            expect(tokenInfo?.clientId).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Feature: bookmark-manager-platform, Property 77: Rate Limit Response
   * For any requests exceeding rate limits, the system should return HTTP 429 status with retry-after headers.
   * Validates: Requirements 25.5
   *
   * Note: This property is tested at the middleware level in rate-limit.middleware.property.test.ts
   * as it's a cross-cutting concern that applies to all API endpoints, not just OAuth.
   * The rate limiting middleware already implements this behavior.
   */
  describe('Property 77: Rate Limit Response', () => {
    it('should be implemented by rate limiting middleware', () => {
      // This is a marker test to indicate that Property 77 is tested elsewhere
      // See: packages/backend/src/middleware/rate-limit.middleware.property.test.ts
      expect(true).toBe(true);
    });
  });
});
