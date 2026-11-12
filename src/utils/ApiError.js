/**
 * ApiError - operational (expected) error carrying an HTTP status code.
 * Anything thrown that is *not* an ApiError is treated as a bug and
 * reported to the client as a generic 500 Internal Server Error.
 */
export class ApiError extends Error {
  constructor(statusCode, message = 'Internal Server Error', details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details) {
    return new ApiError(400, message, details);
  }

  static notFound(message = 'Task not found') {
    return new ApiError(404, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static internal(message = 'Internal Server Error') {
    return new ApiError(500, message);
  }
}

export default ApiError;
