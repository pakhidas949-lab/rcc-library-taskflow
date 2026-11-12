import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { isProduction } from '../config/env.js';

/**
 * 404 handler - runs when no route matched the request.
 */
export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Central error-handling middleware.
 *
 * Converts every error into a consistent JSON envelope:
 *   { "success": false, "error": { "message": "...", "details": [...] } }
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  // Malformed JSON body -> 400 instead of 500
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    statusCode = 400;
    message = 'Malformed JSON body';
  }

  // Payload too large -> 413
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }

  // Zod validation errors -> 400 with a field-level breakdown
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    details = err.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
      code: issue.code,
    }));
  }

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[${req.id || '-'}] ${req.method} ${req.originalUrl} ->`, err.stack || err);
  }

  const body = {
    success: false,
    error: {
      message: statusCode >= 500 && isProduction ? 'Internal Server Error' : message,
      ...(details ? { details } : {}),
    },
    requestId: req.id,
  };

  res.status(statusCode).json(body);
};

export default errorHandler;
