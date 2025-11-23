import { Router, Request, Response } from 'express';
import { FileService } from '../services/file.service.js';
import multer from 'multer';

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

/**
 * Create file management routes
 */
export function createFileRoutes(fileService: FileService): Router {
  const router = Router();

  /**
   * POST /files/upload
   * Upload a file
   */
  router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
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

      // Check Pro tier
      if (req.user.plan !== 'pro') {
        res.status(403).json({
          error: {
            code: 'PRO_FEATURE_REQUIRED',
            message: 'File uploads are a Pro feature. Please upgrade your plan.',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: {
            code: 'NO_FILE',
            message: 'No file provided',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Get optional bookmark ID from body
      const bookmarkId = req.body.bookmarkId;

      // Upload file
      const file = await fileService.uploadFile(
        req.user.userId,
        req.user.plan,
        req.file.originalname,
        req.file.mimetype,
        req.file.buffer,
        bookmarkId
      );

      res.status(201).json({
        file,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'File uploads are a Pro feature'
            ? 403
            : error.message.includes('exceeds limit')
              ? 413
              : error.message === 'Invalid bookmark'
                ? 400
                : 500;

        res.status(statusCode).json({
          error: {
            code:
              statusCode === 403
                ? 'PRO_FEATURE_REQUIRED'
                : statusCode === 413
                  ? 'FILE_TOO_LARGE'
                  : statusCode === 400
                    ? 'INVALID_BOOKMARK'
                    : 'UPLOAD_FAILED',
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
   * GET /files/:id
   * Get file details or download file
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
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

      const download = req.query.download === 'true';

      if (download) {
        // Stream file for download
        const { stream, file } = await fileService.getFileStream(req.params.id, req.user.userId);

        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.setHeader('Content-Length', file.sizeBytes.toString());

        stream.pipe(res);
      } else {
        // Return file metadata
        const file = await fileService.getFile(req.params.id, req.user.userId);

        res.status(200).json({
          file,
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'File not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 500;

        res.status(statusCode).json({
          error: {
            code:
              statusCode === 404
                ? 'FILE_NOT_FOUND'
                : statusCode === 403
                  ? 'ACCESS_DENIED'
                  : 'INTERNAL_ERROR',
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
   * DELETE /files/:id
   * Delete a file
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
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

      await fileService.deleteFile(req.params.id, req.user.userId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          error.message === 'File not found'
            ? 404
            : error.message === 'Access denied'
              ? 403
              : 500;

        res.status(statusCode).json({
          error: {
            code:
              statusCode === 404
                ? 'FILE_NOT_FOUND'
                : statusCode === 403
                  ? 'ACCESS_DENIED'
                  : 'DELETE_FAILED',
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
   * GET /files
   * List user files
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
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

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const files = await fileService.listUserFiles(req.user.userId, page, limit);

      res.status(200).json({
        files,
        page,
        limit,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
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
