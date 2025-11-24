import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { JWTPayload } from '../services/auth.service.js';

// Extend Express Request to include user data
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware to validate JWT access tokens
 */
export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authorization token is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify token
      const payload = authService.verifyAccessToken(token);

      // Attach user data to request
      req.user = payload;

      next();
    } catch (error) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired access token',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  };
}

/**
 * Middleware to check if user has Pro plan
 */
export function requireProPlan(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
    return;
  }

  if (req.user.plan !== 'pro') {
    res.status(403).json({
      error: {
        code: 'PRO_FEATURE_REQUIRED',
        message: 'This feature requires a Pro subscription',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
    return;
  }

  next();
}

/**
 * Optional authentication middleware - attaches user if token is present but doesn't require it
 */
export function createOptionalAuthMiddleware(authService: AuthService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = authService.verifyAccessToken(token);
        req.user = payload;
      }
    } catch (error) {
      // Ignore errors for optional auth
    }
    next();
  };
}
