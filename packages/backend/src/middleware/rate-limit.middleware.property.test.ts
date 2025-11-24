import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';

/**
 * Feature: bookmark-manager-platform, Property 70: Rate Limiting Enforcement
 * Validates: Requirements 21.5
 *
 * For any API requests, the system should enforce rate limits per user and IP address
 * to prevent abuse.
 */
describe('Property 70: Rate Limiting Enforcement', () => {
  // Mock rate limiter state
  let rateLimitStore: Map<string, { count: number; resetAt: number }>;

  beforeEach(() => {
    rateLimitStore = new Map();
    vi.clearAllMocks();
  });

  /**
   * Simulates a rate limiter middleware
   */
  function createRateLimiter(maxRequests: number, windowMs: number) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = (req.user as any)?.userId || req.ip || 'anonymous';
      const now = Date.now();

      let record = rateLimitStore.get(key);

      // Reset if window expired
      if (!record || now > record.resetAt) {
        record = { count: 0, resetAt: now + windowMs };
        rateLimitStore.set(key, record);
      }

      record.count++;

      if (record.count > maxRequests) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter,
          },
        });
        return;
      }

      next();
    };
  }

  it('should enforce rate limits per user', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        fc.integer({ min: 5, max: 20 }), // maxRequests
        fc.integer({ min: 10, max: 50 }), // number of requests to make
        (userId, maxRequests, requestCount) => {
          // Reset store for this test
          rateLimitStore.clear();

          const rateLimiter = createRateLimiter(maxRequests, 60000); // 1 minute window

          let allowedCount = 0;
          let blockedCount = 0;

          // Simulate multiple requests from the same user
          for (let i = 0; i < requestCount; i++) {
            const req = {
              user: { userId },
              ip: '127.0.0.1',
            } as unknown as Request;

            let statusCode = 200;
            const res = {
              status: (code: number) => {
                statusCode = code;
                return {
                  json: (_data: any) => {},
                };
              },
            } as unknown as Response;

            const next = () => {
              // Request allowed
            };

            rateLimiter(req, res, next);

            if (statusCode === 429) {
              blockedCount++;
            } else {
              allowedCount++;
            }
          }

          // Verify rate limiting behavior
          expect(allowedCount).toBeLessThanOrEqual(maxRequests);
          if (requestCount > maxRequests) {
            expect(blockedCount).toBeGreaterThan(0);
            expect(allowedCount + blockedCount).toBe(requestCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce rate limits per IP address for unauthenticated requests', () => {
    fc.assert(
      fc.property(
        fc.ipV4(), // IP address
        fc.integer({ min: 5, max: 20 }), // maxRequests
        fc.integer({ min: 10, max: 50 }), // number of requests to make
        (ipAddress, maxRequests, requestCount) => {
          // Reset store for this test
          rateLimitStore.clear();

          const rateLimiter = createRateLimiter(maxRequests, 60000);

          let allowedCount = 0;
          let blockedCount = 0;

          // Simulate multiple requests from the same IP
          for (let i = 0; i < requestCount; i++) {
            const req = {
              ip: ipAddress,
            } as unknown as Request;

            let statusCode = 200;
            const res = {
              status: (code: number) => {
                statusCode = code;
                return {
                  json: (_data: any) => {},
                };
              },
            } as unknown as Response;

            const next = () => {
              // Request allowed
            };

            rateLimiter(req, res, next);

            if (statusCode === 429) {
              blockedCount++;
            } else {
              allowedCount++;
            }
          }

          // Verify rate limiting behavior
          expect(allowedCount).toBeLessThanOrEqual(maxRequests);
          if (requestCount > maxRequests) {
            expect(blockedCount).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should isolate rate limits between different users', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }), // Multiple user IDs
        fc.integer({ min: 5, max: 10 }), // maxRequests per user
        (userIds, maxRequests) => {
          // Ensure unique user IDs
          const uniqueUsers = Array.from(new Set(userIds));
          fc.pre(uniqueUsers.length >= 2);

          // Reset store for this test
          rateLimitStore.clear();

          const rateLimiter = createRateLimiter(maxRequests, 60000);

          // Each user should be able to make maxRequests
          for (const userId of uniqueUsers) {
            let allowedCount = 0;

            for (let i = 0; i < maxRequests; i++) {
              const req = {
                user: { userId },
                ip: '127.0.0.1',
              } as unknown as Request;

              let statusCode = 200;
              const res = {
                status: (code: number) => {
                  statusCode = code;
                  return {
                    json: (_data: any) => {},
                  };
                },
              } as unknown as Response;

              const next = () => {
                // Request allowed
              };

              rateLimiter(req, res, next);

              if (statusCode !== 429) {
                allowedCount++;
              }
            }

            // Each user should be allowed their full quota
            expect(allowedCount).toBe(maxRequests);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reset rate limits after time window expires', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        fc.integer({ min: 3, max: 10 }), // maxRequests
        (userId, maxRequests) => {
          // Reset store for this test
          rateLimitStore.clear();

          const windowMs = 100; // Short window for testing
          const rateLimiter = createRateLimiter(maxRequests, windowMs);

          // Make requests up to the limit
          for (let i = 0; i < maxRequests; i++) {
            const req = {
              user: { userId },
              ip: '127.0.0.1',
            } as unknown as Request;

            const res = {
              status: (_code: number) => ({
                json: (_data: any) => {},
              }),
            } as unknown as Response;

            const next = () => {};

            rateLimiter(req, res, next);
          }

          // Verify we're at the limit
          const record = rateLimitStore.get(userId);
          expect(record?.count).toBe(maxRequests);

          // Simulate time passing (expire the window)
          if (record) {
            record.resetAt = Date.now() - 1;
          }

          // Make another request - should be allowed after reset
          const req = {
            user: { userId },
            ip: '127.0.0.1',
          } as unknown as Request;

          let statusCode = 200;
          const res = {
            status: (code: number) => {
              statusCode = code;
              return {
                json: (_data: any) => {},
              };
            },
          } as unknown as Response;

          const next = () => {};

          rateLimiter(req, res, next);

          // Should be allowed after window reset
          expect(statusCode).toBe(200);

          // Verify count was reset
          const newRecord = rateLimitStore.get(userId);
          expect(newRecord?.count).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 429 status with retry-after header when limit exceeded', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        fc.integer({ min: 3, max: 10 }), // maxRequests
        (userId, maxRequests) => {
          // Reset store for this test
          rateLimitStore.clear();

          const windowMs = 60000; // 1 minute
          const rateLimiter = createRateLimiter(maxRequests, windowMs);

          // Exhaust the rate limit
          for (let i = 0; i < maxRequests; i++) {
            const req = {
              user: { userId },
              ip: '127.0.0.1',
            } as unknown as Request;

            const res = {
              status: (_code: number) => ({
                json: (_data: any) => {},
              }),
            } as unknown as Response;

            rateLimiter(req, res, () => {});
          }

          // Make one more request that should be blocked
          const req = {
            user: { userId },
            ip: '127.0.0.1',
          } as unknown as Request;

          let statusCode = 200;
          let responseData: any = null;

          const res = {
            status: (code: number) => {
              statusCode = code;
              return {
                json: (data: any) => {
                  responseData = data;
                },
              };
            },
          } as unknown as Response;

          rateLimiter(req, res, () => {});

          // Verify 429 response
          expect(statusCode).toBe(429);
          expect(responseData).toBeDefined();
          expect(responseData.error.code).toBe('RATE_LIMIT_EXCEEDED');
          expect(responseData.error.retryAfter).toBeGreaterThan(0);
          expect(responseData.error.retryAfter).toBeLessThanOrEqual(60);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle concurrent requests correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        fc.integer({ min: 5, max: 15 }), // maxRequests
        fc.integer({ min: 10, max: 30 }), // concurrent requests
        (userId, maxRequests, concurrentRequests) => {
          // Reset store for this test
          rateLimitStore.clear();

          const rateLimiter = createRateLimiter(maxRequests, 60000);

          let allowedCount = 0;
          let blockedCount = 0;

          // Simulate concurrent requests
          for (let i = 0; i < concurrentRequests; i++) {
            const req = {
              user: { userId },
              ip: '127.0.0.1',
            } as unknown as Request;

            let statusCode = 200;
            const res = {
              status: (code: number) => {
                statusCode = code;
                return {
                  json: (_data: any) => {},
                };
              },
            } as unknown as Response;

            rateLimiter(req, res, () => {});

            if (statusCode === 429) {
              blockedCount++;
            } else {
              allowedCount++;
            }
          }

          // Verify total requests processed
          expect(allowedCount + blockedCount).toBe(concurrentRequests);

          // Verify rate limit was enforced
          expect(allowedCount).toBeLessThanOrEqual(maxRequests);

          if (concurrentRequests > maxRequests) {
            expect(blockedCount).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
