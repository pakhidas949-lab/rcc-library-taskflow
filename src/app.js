import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env, isProduction } from './config/env.js';
import { createRouter } from './routes/index.js';
import authRouter from './routes/authRoutes.js';
import { securityHeaders } from './middleware/security.js';
import { requestLogger, morganLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createApiRateLimiter, createWriteRateLimiter } from './middleware/rateLimiter.js';
import {
  attachSession,
  requireAuthPage,
  redirectIfAuthenticated,
} from './middleware/auth.js';
import { taskStore } from './store/taskStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Static dashboard assets (the merged HTML frontend). */
export const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

/** The protected dashboard lives in its own sub-folder. */
const DASHBOARD_DIR = path.join(PUBLIC_DIR, 'dashboard');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'js');

/**
 * Documentation folder - holds the OpenAPI spec and the demo recording
 * (docs/demo.mp4) that the README embeds.
 */
const DOCS_DIR = path.resolve(__dirname, '..', 'docs');

/**
 * Content-Security-Policy for the HTML dashboard pages.
 *
 * The API keeps the strict policy (no inline script, no third-party origins),
 * but the dashboards are static HTML pages that rely on Tailwind's CDN
 * runtime, Google Fonts and Material Symbols - and they contain inline
 * <script> blocks. This policy is applied to page responses only.
 */
const PAGE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https://lh3.googleusercontent.com https://lh3.google.com https://accounts.google.com https://fastly.jsdelivr.net",
  "connect-src 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Builds and configures the Express application.
 * Kept separate from server.js so the test suite can mount the app
 * without binding a TCP port.
 *
 * @param {object} [options]
 * @param {boolean} [options.rateLimit]        Enable/disable the rate limiters.
 * @param {number}  [options.rateLimitMax]     Max requests per window for GET.
 * @param {number}  [options.writeRateLimitMax] Max write requests per window.
 * @param {boolean} [options.logging]          Enable/disable console request logging.
 */
export const createApp = ({
  rateLimit = true,
  rateLimitMax,
  writeRateLimitMax,
  logging = true,
} = {}) => {
  const app = express();

  // Behind a reverse proxy (nginx, Heroku, Render...) - needed for the
  // rate limiter to see the real client IP.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ---- Security layer -------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://unpkg.com'],
          styleSrc: ["'self'", 'https://unpkg.com'],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(securityHeaders);

  // ---- CORS -----------------------------------------------------------
  // `origin: '*'` makes the cors package emit a literal
  // `Access-Control-Allow-Origin: *` header; an explicit list makes it
  // echo back only the matching origin.
  const allowAnyOrigin = env.CORS_ORIGIN === '*';
  const originList = allowAnyOrigin
    ? '*'
    : env.CORS_ORIGIN.split(',').map((o) => o.trim());

  app.use(
    cors({
      origin: originList,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
      credentials: false,
      maxAge: 86400,
    }),
  );

  // ---- Logging --------------------------------------------------------
  // The request-id assignment always runs (it is part of the API contract);
  // only the console output is silenced when logging is disabled.
  app.use(requestLogger({ silent: !logging }));
  if (logging) app.use(morganLogger);

  /**
   * Pages need a relaxed CSP (Tailwind CDN + Google Fonts + inline scripts);
   * the API keeps the strict one applied by helmet. This must be registered
   * before the page routes so the header is present on their responses.
   */
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      res.setHeader('Content-Security-Policy', PAGE_CSP);
    }
    next();
  });

  // ---- Session --------------------------------------------------------
  // Resolves req.session / req.user from the session cookie. Never rejects -
  // an absent or expired cookie simply means "signed out".
  app.use(attachSession);

  // ---- Body parsing ---------------------------------------------------
  app.use(express.json({ limit: env.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.BODY_LIMIT }));

  // ---- Routes ---------------------------------------------------------
  const apiLimiter = rateLimit
    ? createApiRateLimiter(rateLimitMax ? { max: rateLimitMax } : {})
    : null;
  const writeLimiter = rateLimit
    ? writeRateLimitMax
      ? createWriteRateLimiter({ max: writeRateLimitMax })
      : undefined // fall back to the module default
    : null; // disabled

  app.use(
    createRouter({
      rateLimiter: apiLimiter,
      writeLimiter,
    }),
  );

  // ---- Authentication API --------------------------------------------
  app.use('/api/auth', authRouter);

  /**
   * Documentation assets - the OpenAPI spec and the demo recording
   * (docs/demo.mp4) that the README embeds.
   */
  app.use(
    '/docs',
    express.static(DOCS_DIR, {
      index: false,
      maxAge: isProduction ? '1h' : 0,
      etag: true,
      acceptRanges: true,
    }),
  );

  /**
   * Public pages.
   */
  app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'landing.html'));
  });

  app.get('/login', redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
  });

  /**
   * Shared client scripts (API client, live-data layer, auth helpers).
   */
  app.use(
    '/js',
    express.static(ASSETS_DIR, {
      maxAge: isProduction ? '1h' : 0,
      etag: true,
    }),
  );

  /**
   * The dashboard is behind the login. Unauthenticated visitors are sent to
   * /login?next=<original path> so they land where they intended to.
   */
  app.get('/dashboard', requireAuthPage, (req, res) => {
    res.sendFile(path.join(DASHBOARD_DIR, 'index.html'));
  });

  app.use(
    '/dashboard',
    requireAuthPage,
    express.static(DASHBOARD_DIR, {
      index: false,
      extensions: ['html'],
      redirect: false,
      maxAge: isProduction ? '1h' : 0,
      etag: true,
    }),
  );

  /**
   * Deliberate error trigger - used by the test suites to verify that the
   * error-handling middleware returns a well-formed 500 response.
   * Disabled in production.
   */
  if (!isProduction) {
    app.get('/api/_debug/error', () => {
      throw new Error('Intentional error triggered by the debug endpoint');
    });
  }

  // ---- Error handling (must be last) ----------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

const app = createApp();

export default app;

/**
 * Optional demo data so a fresh `npm start` is not an empty screen.
 */
if (env.SEED_DATA && taskStore.tasks.length === 0) {
  taskStore.seed();
  // eslint-disable-next-line no-console
  console.log('[TaskFlow] Seeded sample tasks into the in-memory store');
}
