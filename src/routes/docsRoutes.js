import { Router } from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.resolve(__dirname, '..', '..', 'docs', 'openapi.yaml');

const router = Router();

/**
 * Raw OpenAPI specification.
 */
router.get('/openapi.yaml', (req, res) => {
  try {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    res.set('Content-Type', 'application/yaml; charset=utf-8').send(spec);
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'OpenAPI spec unavailable' } });
  }
});

/**
 * Swagger UI - a self-contained interactive reference for the API.
 * The CDN assets are whitelisted by the CSP below.
 */
router.get('/docs', (req, res) => {
  res.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https://fastly.jsdelivr.net",
      "font-src 'self' data: https://unpkg.com",
    ].join('; '),
  );

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TaskFlow API - Reference</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: '/api/openapi.yaml',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          plugins: [SwaggerUIBundle.plugins.DownloadUrl],
          layout: 'StandaloneLayout'
        });
      };
    </script>
  </body>
</html>`);
});

export default router;
