import { Router, Request, Response } from 'express';
import { SearchService, SearchQuery } from '../services/search.service.js';

/**
 * Create search routes
 */
export function createSearchRoutes(searchService: SearchService): Router {
  const router = Router();

  /**
   * GET /v1/search
   * Search bookmarks with filters
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      // Get authenticated user from middleware
      const userId = (req as any).user?.userId;
      const userPlan = (req as any).user?.plan || 'free';

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }

      // Parse query parameters
      const query: SearchQuery = {
        q: req.query.q as string,
        tags: req.query.tags
          ? ((Array.isArray(req.query.tags)
              ? req.query.tags
              : [req.query.tags]) as string[])
          : undefined,
        type: req.query.type
          ? ((Array.isArray(req.query.type)
              ? req.query.type
              : [req.query.type]) as string[])
          : undefined,
        domain: req.query.domain
          ? ((Array.isArray(req.query.domain)
              ? req.query.domain
              : [req.query.domain]) as string[])
          : undefined,
        collection: req.query.collection as string,
        dateFrom: req.query.dateFrom
          ? new Date(req.query.dateFrom as string)
          : undefined,
        dateTo: req.query.dateTo
          ? new Date(req.query.dateTo as string)
          : undefined,
        fulltext: req.query.fulltext === 'true',
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        sort: req.query.sort as any,
      };

      // Check Pro feature access
      if (query.fulltext && userPlan !== 'pro') {
        return res.status(403).json({
          error: {
            code: 'PRO_FEATURE_REQUIRED',
            message:
              'Full-text search is a Pro feature. Please upgrade your plan.',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }

      // Perform search
      const results = await searchService.search(
        query,
        userId,
        userPlan === 'pro'
      );

      res.status(200).json(results);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        error: {
          code: 'SEARCH_FAILED',
          message: 'Failed to perform search',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * GET /v1/search/suggestions
   * Get search suggestions (autocomplete)
   */
  router.get('/suggestions', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }

      const query = req.query.q as string;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 5;

      if (!query) {
        return res.status(400).json({
          error: {
            code: 'INVALID_QUERY',
            message: 'Query parameter "q" is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }

      const suggestions = await searchService.getSuggestions(
        query,
        userId,
        limit
      );

      res.status(200).json({ suggestions });
    } catch (error) {
      console.error('Suggestions error:', error);
      res.status(500).json({
        error: {
          code: 'SUGGESTIONS_FAILED',
          message: 'Failed to get suggestions',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * GET /v1/search/tags
   * Get popular tags for the user
   */
  router.get('/tags', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }

      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;

      const tags = await searchService.getPopularTags(userId, limit);

      res.status(200).json({ tags });
    } catch (error) {
      console.error('Popular tags error:', error);
      res.status(500).json({
        error: {
          code: 'TAGS_FAILED',
          message: 'Failed to get popular tags',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  return router;
}
