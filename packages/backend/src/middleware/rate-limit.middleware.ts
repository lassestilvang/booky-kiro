import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix?: string; // Redis key prefix
}

/**
 * Rate limiting middleware using Redis
 */
export function createRateLimitMiddleware(
  redis: RedisClientType,
  config: RateLimitConfig
) {
  const { windowMs, maxRequests, keyPrefix = 'ratelimit' } = config;

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Generate rate limit key based on user ID or IP
      const identifier = req.user?.userId || req.ip || 'anonymous';
      const key = `${keyPrefix}:${identifier}`;

      // Get current request count
      const current = await redis.get(key);
      const requestCount = current ? parseInt(current, 10) : 0;

      // Check if limit exceeded
      if (requestCount >= maxRequests) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : Math.ceil(windowMs / 1000);

        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            retryAfter,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Increment request count
      const multi = redis.multi();
      multi.incr(key);
      if (requestCount === 0) {
        // Set expiry only on first request
        multi.pExpire(key, windowMs);
      }
      await multi.exec();

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader(
        'X-RateLimit-Remaining',
        (maxRequests - requestCount - 1).toString()
      );
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(Date.now() + windowMs).toISOString()
      );

      next();
    } catch (error) {
      // If Redis fails, allow the request but log the error
      console.error('Rate limit middleware error:', error);
      next();
    }
  };
}

/**
 * Create rate limiter for authenticated users
 * Higher limits for authenticated users
 */
export function createUserRateLimiter(redis: RedisClientType) {
  return createRateLimitMiddleware(redis, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    keyPrefix: 'ratelimit:user',
  });
}

/**
 * Create rate limiter for IP addresses
 * Lower limits for unauthenticated requests
 */
export function createIPRateLimiter(redis: RedisClientType) {
  return createRateLimitMiddleware(redis, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
    keyPrefix: 'ratelimit:ip',
  });
}

/**
 * Create strict rate limiter for sensitive endpoints (login, register)
 */
export function createStrictRateLimiter(redis: RedisClientType) {
  return createRateLimitMiddleware(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
    keyPrefix: 'ratelimit:strict',
  });
}
