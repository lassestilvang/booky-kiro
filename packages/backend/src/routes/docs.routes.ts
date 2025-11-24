import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create API documentation routes
 */
export function createDocsRoutes(): Router {
  const router = Router();

  /**
   * GET /docs/openapi.yaml
   * Serve OpenAPI specification in YAML format
   */
  router.get('/openapi.yaml', (_req: Request, res: Response) => {
    try {
      const openapiPath = join(__dirname, '../../openapi.yaml');
      const openapiContent = readFileSync(openapiPath, 'utf-8');

      res.setHeader('Content-Type', 'application/x-yaml');
      res.send(openapiContent);
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load OpenAPI specification',
          timestamp: new Date().toISOString(),
          requestId: _req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * GET /docs/openapi.json
   * Serve OpenAPI specification in JSON format
   */
  router.get('/openapi.json', (_req: Request, res: Response) => {
    try {
      const openapiPath = join(__dirname, '../../openapi.yaml');
      const openapiContent = readFileSync(openapiPath, 'utf-8');
      const openapiJson = yaml.parse(openapiContent);

      res.json(openapiJson);
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load OpenAPI specification',
          timestamp: new Date().toISOString(),
          requestId: _req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * GET /docs
   * Serve Swagger UI for interactive API documentation
   */
  router.get('/', (_req: Request, res: Response) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bookmark Manager API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  return router;
}
