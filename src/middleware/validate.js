import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Validation middleware factory.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} source
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  try {
    const parsed = schema.parse(req[source]);
    // req.query is a getter in Express 5 - assign defensively
    if (source === 'query') {
      Object.defineProperty(req, 'validatedQuery', { value: parsed, configurable: true });
    } else {
      req[source] = parsed;
    }
    return next();
  } catch (error) {
    if (error instanceof ZodError) return next(error);
    return next(ApiError.badRequest('Invalid request payload'));
  }
};

export default validate;
