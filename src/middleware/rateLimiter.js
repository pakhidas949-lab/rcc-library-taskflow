import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiter applied to the /api/ namespace.
 * Protects against brute-force abuse and accidental traffic spikes.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs]
 * @param {number} [options.max]
 */
export const createApiRateLimiter = ({
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  max = env.RATE_LIMIT_MAX,
} = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true, // RateLimit-* headers (RFC draft)
    legacyHeaders: false,
    message: {
      success: false,
      error: { message: 'Too many requests, please try again later' },
    },
  });

/**
 * Stricter limiter for write operations (POST/PUT/PATCH/DELETE).
 *
 * @param {object} [options]
 * @param {number} [options.windowMs]
 * @param {number} [options.max]
 */
export const createWriteRateLimiter = ({
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  max = env.WRITE_RATE_LIMIT_MAX,
} = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { message: 'Too many write requests, please try again later' },
    },
  });

export const apiRateLimiter = createApiRateLimiter();
export const writeRateLimiter = createWriteRateLimiter();

export default apiRateLimiter;
