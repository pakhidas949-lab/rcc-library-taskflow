import { randomUUID } from 'node:crypto';
import morgan from 'morgan';

/**
 * Request logging middleware.
 *
 * - assigns a unique request id (returned in the X-Request-Id header and
 *   included in every error payload so a client can quote it in a report)
 * - logs every request with method, url, status, response time and id
 *
 * @param {object} [options]
 * @param {boolean} [options.silent] Set to true to skip the console output
 *        while still assigning request ids (used by the test suite).
 */
export const requestLogger = ({ silent = false } = {}) => (req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (silent) return;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    // eslint-disable-next-line no-console
    console.log(
      `[${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
    );
  });

  next();
};

/**
 * morgan instance writing to stdout in a compact, colourised format.
 */
export const morganLogger = morgan('dev', {
  skip: (req) => req.url === '/api/health',
});

export default requestLogger;
