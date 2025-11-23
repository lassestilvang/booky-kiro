import { describe, test, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import * as fc from 'fast-check';
import { AuthService } from '../services/auth.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { createAuthMiddleware, requireProPlan } from './auth.middleware.js';
import pool from '../db/config.js';
import { runMigrations } from '../db/migrate.js';
import { Request, Response } from 'express';

describe('Authorization Middleware Property-Based Tests', () => {
  let authService: AuthService;
  let userRepository: UserRepository;
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;

  beforeAll(async () => {
    // Run migrations
    await runMigrations();

    userRepository = new UserRepository(pool);

    // Generate test RSA keys
    const crypto = await import('crypto');
    const { privateKey: accessPrivate, publicKey: accessPublic } =
      crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
    const { privateKey: refreshPrivate, publicKey: refreshPublic } =
      crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

    authService = new AuthService(
      userRepository,
      accessPrivate,
      accessPublic,
      refreshPrivate,
      refreshPublic
    );

    authMiddleware = createAuthMiddleware(authService);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up users
    await pool.query('DELETE FROM users');
  });

  // Feature: bookmark-manager-platform, Property 53: Authorization Enforcement
  test('Property 53: Authorization Enforcement - for any protected resource request, the system should validate JWT signatures and enforce authorization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress().filter((email) => email.length <= 255),
          password: fc
            .string({ minLength: 8, maxLength: 50 })
            .filter(
              (pwd) =>
                /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
          name: fc.string({ minLength: 1, maxLength: 255 }),
          plan: fc.constantFrom('free' as const, 'pro' as const),
        }),
        async (userData) => {
          // Register user
          const user = await authService.register(userData);

          // Login to get token
          const tokens = await authService.login({
            email: userData.email,
            password: userData.password,
          });

          // Create mock request with valid token
          const req = {
            headers: {
              authorization: `Bearer ${tokens.accessToken}`,
              'x-request-id': 'test-request',
            },
            user: undefined,
          } as unknown as Request;

          const res = {
            status: (code: number) => ({
              json: (data: any) => {
                throw new Error(`Unexpected response: ${code}`);
              },
            }),
          } as unknown as Response;

          let nextCalled = false;
          const next = () => {
            nextCalled = true;
          };

          // Execute middleware
          authMiddleware(req, res, next);

          // Verify authorization succeeded
          expect(nextCalled).toBe(true);
          expect(req.user).toBeDefined();
          expect(req.user!.userId).toBe(user.id);
          expect(req.user!.email).toBe(user.email);
          expect(req.user!.plan).toBe(user.plan);

          // Clean up
          await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        }
      ),
      { numRuns: 20 } // Reduced from 100 due to slow bcrypt hashing
    );
  }, 60000); // 60 second timeout for bcrypt operations

  test('Property 53 (Edge Case): Authorization should reject requests without tokens', async () => {
    // Create mock request without token
    const req = {
      headers: {
        'x-request-id': 'test-request',
      },
    } as unknown as Request;

    let responseStatus = 0;
    let responseData: any = null;

    const res = {
      status: (code: number) => ({
        json: (data: any) => {
          responseStatus = code;
          responseData = data;
        },
      }),
    } as unknown as Response;

    const next = () => {
      throw new Error('Next should not be called');
    };

    // Execute middleware
    authMiddleware(req, res, next);

    // Verify rejection
    expect(responseStatus).toBe(401);
    expect(responseData.error.code).toBe('MISSING_TOKEN');
  });

  test('Property 53 (Edge Case): Authorization should reject invalid tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        async (invalidToken) => {
          // Create mock request with invalid token
          const req = {
            headers: {
              authorization: `Bearer ${invalidToken}`,
              'x-request-id': 'test-request',
            },
          } as unknown as Request;

          let responseStatus = 0;
          let responseData: any = null;

          const res = {
            status: (code: number) => ({
              json: (data: any) => {
                responseStatus = code;
                responseData = data;
              },
            }),
          } as unknown as Response;

          const next = () => {
            throw new Error('Next should not be called');
          };

          // Execute middleware
          authMiddleware(req, res, next);

          // Verify rejection
          expect(responseStatus).toBe(401);
          expect(responseData.error.code).toBe('INVALID_TOKEN');
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: bookmark-manager-platform, Property 78: Pro Feature Access Control
  test('Property 78: Pro Feature Access Control - free tier users should be denied access to Pro features', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress().filter((email) => email.length <= 255),
          password: fc
            .string({ minLength: 8, maxLength: 50 })
            .filter(
              (pwd) =>
                /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
          name: fc.string({ minLength: 1, maxLength: 255 }),
        }),
        async (userData) => {
          // Register free tier user
          const user = await authService.register({
            ...userData,
            plan: 'free',
          });

          // Create mock request with free user
          const req = {
            user: {
              userId: user.id,
              email: user.email,
              plan: 'free' as const,
              type: 'access' as const,
            },
            headers: {
              'x-request-id': 'test-request',
            },
          } as unknown as Request;

          let responseStatus = 0;
          let responseData: any = null;

          const res = {
            status: (code: number) => ({
              json: (data: any) => {
                responseStatus = code;
                responseData = data;
              },
            }),
          } as unknown as Response;

          const next = () => {
            throw new Error('Next should not be called for free users');
          };

          // Execute Pro plan middleware
          requireProPlan(req, res, next);

          // Verify rejection
          expect(responseStatus).toBe(403);
          expect(responseData.error.code).toBe('PRO_FEATURE_REQUIRED');

          // Clean up
          await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 78: Pro users should have access to Pro features', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress().filter((email) => email.length <= 255),
          password: fc
            .string({ minLength: 8, maxLength: 50 })
            .filter(
              (pwd) =>
                /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
          name: fc.string({ minLength: 1, maxLength: 255 }),
        }),
        async (userData) => {
          // Register Pro tier user
          const user = await authService.register({
            ...userData,
            plan: 'pro',
          });

          // Create mock request with Pro user
          const req = {
            user: {
              userId: user.id,
              email: user.email,
              plan: 'pro' as const,
              type: 'access' as const,
            },
            headers: {
              'x-request-id': 'test-request',
            },
          } as unknown as Request;

          const res = {} as unknown as Response;

          let nextCalled = false;
          const next = () => {
            nextCalled = true;
          };

          // Execute Pro plan middleware
          requireProPlan(req, res, next);

          // Verify access granted
          expect(nextCalled).toBe(true);

          // Clean up
          await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        }
      ),
      { numRuns: 50 }
    );
  });
});
