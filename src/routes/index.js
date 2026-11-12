import { Router } from 'express';
import { createTaskRouter } from './taskRoutes.js';
import docsRouter from './docsRoutes.js';
import { getStats } from '../controllers/taskController.js';
import { apiRateLimiter } from '../middleware/rateLimiter.js';

/**
 * Builds the API router.
 *
 * @param {object} [options]
 * @param {import('express').RequestHandler} [options.rateLimiter]   General /api limiter.
 * @param {import('express').RequestHandler} [options.writeLimiter]  Stricter write limiter.
 *        Pass `null` to disable either limiter (used by the test suite
 *        so that hundreds of requests do not trip the limit).
 */
export const createRouter = ({
  rateLimiter = apiRateLimiter,
  writeLimiter = undefined,
} = {}) => {
  const router = Router();
  const taskRouter = createTaskRouter({ writeLimiter });

  const mount = (path) =>
    rateLimiter
      ? router.use(path, rateLimiter, taskRouter)
      : router.use(path, taskRouter);

  /**
   * API v1
   * Mounting under /api/v1 keeps the door open for a future /api/v2
   * without breaking existing clients.
   */
  mount('/api/v1/tasks');

  /**
   * Unversioned aliases (/api/tasks) - kept because the TaskFlow Lite
   * client and the Postman collection both use the flat paths.
   */
  mount('/api/tasks');

  /**
   * Aggregate counters for the dashboard KPI strip.
   */
  router.get('/api/stats', getStats);

  /**
   * Health check - used by uptime monitors and the load-test harness.
   */
  router.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      status: 'ok',
      service: 'taskflow-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Interactive API reference (Swagger UI) and the raw OpenAPI spec.
   */
  router.use('/api', docsRouter);

  return router;
};

export default createRouter();
