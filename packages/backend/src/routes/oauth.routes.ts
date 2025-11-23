import { Router, Request, Response } from 'express';
import { OAuthService } from '../services/oauth.service.js';
import { z } from 'zod';

// Validation schemas
const authorizeSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().url(),
  response_type: z.literal('code'),
  code_challenge: z.string(),
  code_challenge_method: z.enum(['S256', 'plain']),
  scope: z.string().optional(),
  state: z.string().optional(),
});

const tokenSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string(),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  code_verifier: z.string(),
});

/**
 * Create OAuth2 routes with PKCE support
 */
export function createOAuthRoutes(oauthService: OAuthService): Router {
  const router = Router();

  /**
   * GET /oauth/authorize
   * OAuth2 authorization endpoint
   */
  router.get('/authorize', async (req: Request, res: Response) => {
    try {
      // Validate query parameters
      const params = authorizeSchema.parse(req.query);

      // In a real implementation, this would:
      // 1. Check if user is authenticated
      // 2. Show consent screen
      // 3. Generate authorization code after user consent

      // For now, we'll assume user is authenticated and consents
      // In production, this should redirect to a login/consent page

      res.status(200).json({
        message: 'Authorization endpoint',
        params,
        note: 'In production, this would show a consent screen',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid authorization request',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  /**
   * POST /oauth/authorize
   * Process authorization consent
   */
  router.post('/authorize', async (req: Request, res: Response) => {
    try {
      const params = authorizeSchema.parse(req.body);

      // Verify user is authenticated (should be done by auth middleware)
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User must be authenticated',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Parse scopes
      const scopes = params.scope ? params.scope.split(' ') : [];

      // Generate authorization code
      const code = await oauthService.generateAuthorizationCode(
        params.client_id,
        req.user.userId,
        params.redirect_uri,
        params.code_challenge,
        params.code_challenge_method,
        scopes
      );

      // Redirect back to client with authorization code
      const redirectUrl = new URL(params.redirect_uri);
      redirectUrl.searchParams.set('code', code);
      if (params.state) {
        redirectUrl.searchParams.set('state', params.state);
      }

      res.status(200).json({
        redirect_uri: redirectUrl.toString(),
        code,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid authorization request',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else if (error instanceof Error) {
        res.status(400).json({
          error: {
            code: 'AUTHORIZATION_FAILED',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  /**
   * POST /oauth/token
   * Token exchange endpoint
   */
  router.post('/token', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const params = tokenSchema.parse(req.body);

      // Exchange authorization code for tokens
      const result = await oauthService.exchangeCodeForToken(
        params.code,
        params.client_id,
        params.redirect_uri,
        params.code_verifier
      );

      res.status(200).json({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        token_type: 'Bearer',
        expires_in: 900, // 15 minutes
        scope: result.scopes.join(' '),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid token request',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else if (error instanceof Error) {
        res.status(400).json({
          error: {
            code: 'INVALID_GRANT',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
    }
  });

  return router;
}
