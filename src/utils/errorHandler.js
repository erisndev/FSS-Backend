/**
 * Centralized Error Handler Utility
 * Provides consistent error handling across all controllers
 */

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle controller errors consistently
 * @param {Response} res - Express response object
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred (for logging)
 */
export const handleControllerError = (res, error, context = 'Unknown') => {
  // Log error with context
  console.error(`[${context}] Error:`, {
    message: error.message,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
  });
  
  // Determine status code
  const statusCode = error.statusCode || 500;
  
  // Build response
  const response = {
    success: false,
    message: error.message || 'Internal server error',
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    response.stack = error.stack;
  }
  
  // Add validation errors if present
  if (error.errors) {
    response.errors = error.errors;
  }
  
  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Common error responses
 */
export const ErrorResponses = {
  notFound: (resource = 'Resource') => new ApiError(404, `${resource} not found`),
  unauthorized: (message = 'Unauthorized') => new ApiError(401, message),
  forbidden: (message = 'Forbidden') => new ApiError(403, message),
  badRequest: (message = 'Bad request', errors = null) => new ApiError(400, message, errors),
  conflict: (message = 'Conflict') => new ApiError(409, message),
  internalError: (message = 'Internal server error') => new ApiError(500, message),
};

export default {
  ApiError,
  handleControllerError,
  asyncHandler,
  ErrorResponses
};
