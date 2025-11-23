import { describe, test, beforeAll, afterAll, beforeEach } from 'vitest';
import { expect } from 'vitest';
import * as fc from 'fast-check';
import { AuthService } from './auth.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import pool from '../db/config.js';
import { runMigrations } from '../db/migrate.js';

describe('AuthService Property-Based Tests', () => {
  let authService: AuthService;
  let userRepository: UserRepository;

  beforeAll(async () => {
    // Run migrations to ensure schema is up to date
    await runMigrations();

    userRepository = new UserRepository(pool);
    
    // Generate test RSA keys
    const crypto = await import('crypto');
    const { privateKey: accessPrivate, publicKey: accessPublic } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const { privateKey: refreshPrivate, publicKey: refreshPublic } = crypto.generateKeyPairSync('rsa', {
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
  });

  afterAll(async () => {
    // Close pool connection
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    await pool.query('DELETE FROM users');
  });

  // Feature: bookmark-manager-platform, Property 50: User Registration Completeness
  test('Property 50: User Registration Completeness - for any valid registration data, creating a user account should store email, password hash, name, creation timestamp, and plan tier', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid user registration data
        fc.record({
          email: fc
            .emailAddress()
            .filter((email) => email.length <= 255),
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

          // Verify all fields are stored correctly
          expect(user.id).toBeDefined();
          expect(user.email).toBe(userData.email);
          expect(user.name).toBe(userData.name);
          expect(user.plan).toBe(userData.plan);
          expect(user.createdAt).toBeInstanceOf(Date);
          expect(user.updatedAt).toBeInstanceOf(Date);

          // Verify password is hashed (not stored in plain text)
          const userWithPassword =
            await userRepository.findByEmailWithPassword(userData.email);
          expect(userWithPassword).toBeDefined();
          expect(userWithPassword!.passwordHash).toBeDefined();
          expect(userWithPassword!.passwordHash).not.toBe(userData.password);
          expect(userWithPassword!.passwordHash.length).toBeGreaterThan(0);

          // Verify password hash starts with bcrypt prefix
          expect(userWithPassword!.passwordHash).toMatch(/^\$2[aby]\$/);

          // Clean up for next iteration
          await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        }
      ),
      { numRuns: 20 } // Reduced from 100 due to slow bcrypt hashing
    );
  }, 60000); // 60 second timeout for bcrypt operations

  test('Property 50 (Edge Case): User registration should reject duplicate emails', async () => {
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
          // Register user first time
          const user1 = await authService.register(userData);

          // Attempt to register with same email should fail
          await expect(authService.register(userData)).rejects.toThrow(
            'User with this email already exists'
          );

          // Clean up
          await pool.query('DELETE FROM users WHERE id = $1', [user1.id]);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 50 (Edge Case): User registration should reject invalid emails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.string().filter((s) => !s.includes('@') || !s.includes('.')),
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
          // Registration with invalid email should fail
          await expect(authService.register(userData)).rejects.toThrow(
            'Invalid email format'
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 50 (Edge Case): User registration should reject weak passwords', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress().filter((email) => email.length <= 255),
          // Generate weak passwords (missing uppercase, lowercase, or numbers)
          password: fc.oneof(
            fc.string({ minLength: 8 }).filter((s) => !/[A-Z]/.test(s)), // No uppercase
            fc.string({ minLength: 8 }).filter((s) => !/[a-z]/.test(s)), // No lowercase
            fc.string({ minLength: 8 }).filter((s) => !/[0-9]/.test(s)), // No numbers
            fc.string({ minLength: 1, maxLength: 7 }) // Too short
          ),
          name: fc.string({ minLength: 1, maxLength: 255 }),
          plan: fc.constantFrom('free' as const, 'pro' as const),
        }),
        async (userData) => {
          // Registration with weak password should fail
          await expect(authService.register(userData)).rejects.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: bookmark-manager-platform, Property 51: JWT Token Issuance
  test('Property 51: JWT Token Issuance - for any user with valid credentials, logging in should issue JWT access and refresh tokens', async () => {
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
          // Register user
          const user = await authService.register({
            ...userData,
            plan: 'free',
          });

          // Login and get tokens
          const tokens = await authService.login({
            email: userData.email,
            password: userData.password,
          });

          // Verify tokens are issued
          expect(tokens.accessToken).toBeDefined();
          expect(tokens.refreshToken).toBeDefined();
          expect(typeof tokens.accessToken).toBe('string');
          expect(typeof tokens.refreshToken).toBe('string');
          expect(tokens.accessToken.length).toBeGreaterThan(0);
          expect(tokens.refreshToken.length).toBeGreaterThan(0);

          // Verify access token can be decoded
          const accessPayload = authService.verifyAccessToken(
            tokens.accessToken
          );
          expect(accessPayload.userId).toBe(user.id);
          expect(accessPayload.email).toBe(user.email);
          expect(accessPayload.plan).toBe(user.plan);
          expect(accessPayload.type).toBe('access');

          // Clean up
          await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        }
      ),
      { numRuns: 20 } // Reduced from 100 due to slow bcrypt hashing
    );
  }, 60000); // 60 second timeout for bcrypt operations

  // Feature: bookmark-manager-platform, Property 52: Token Refresh
  test('Property 52: Token Refresh - for any expired access token with a valid refresh token, the system should issue new access tokens', async () => {
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
          // Register user with unique email
          const uniqueEmail = `${userData.email.split('@')[0]}-${Date.now()}-${Math.random().toString(36).substring(7)}@${userData.email.split('@')[1]}`;
          const user = await authService.register({
            ...userData,
            email: uniqueEmail,
            plan: 'free',
          });

          // Login and get tokens
          const tokens = await authService.login({
            email: uniqueEmail,
            password: userData.password,
          });

          // Wait 1 second to ensure different iat timestamp
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Use refresh token to get new access token
          const newAccessToken = await authService.refreshAccessToken(
            tokens.refreshToken
          );

          // Verify new access token is valid
          expect(newAccessToken).toBeDefined();
          expect(typeof newAccessToken).toBe('string');
          expect(newAccessToken.length).toBeGreaterThan(0);

          // Verify new access token can be decoded
          const newPayload = authService.verifyAccessToken(newAccessToken);
          expect(newPayload.userId).toBe(user.id);
          expect(newPayload.email).toBe(user.email);
          expect(newPayload.plan).toBe(user.plan);
          expect(newPayload.type).toBe('access');

          // Verify new token is different from original
          expect(newAccessToken).not.toBe(tokens.accessToken);

          // Clean up
          await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        }
      ),
      { numRuns: 20 } // Reduced from 100 due to slow bcrypt hashing
    );
  }, 60000); // 60 second timeout for bcrypt operations

  test('Property 52 (Edge Case): Token refresh should reject invalid refresh tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        async (invalidToken) => {
          // Attempt to refresh with invalid token should fail
          await expect(
            authService.refreshAccessToken(invalidToken)
          ).rejects.toThrow('Invalid or expired refresh token');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 51 (Edge Case): Login should reject invalid credentials', async () => {
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
          wrongPassword: fc
            .string({ minLength: 8, maxLength: 50 })
            .filter(
              (pwd) =>
                /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
        }),
        async (userData) => {
          // Ensure wrong password is different
          if (userData.password === userData.wrongPassword) {
            return; // Skip this iteration
          }

          // Register user
          const user = await authService.register({
            email: userData.email,
            password: userData.password,
            name: userData.name,
            plan: 'free',
          });

          // Attempt login with wrong password should fail
          await expect(
            authService.login({
              email: userData.email,
              password: userData.wrongPassword,
            })
          ).rejects.toThrow('Invalid credentials');

          // Clean up
          await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        }
      ),
      { numRuns: 50 }
    );
  });
});
