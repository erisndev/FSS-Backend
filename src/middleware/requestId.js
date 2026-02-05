/**
 * Request ID Middleware
 * Adds unique ID to each request for tracing and debugging
 */

import crypto from 'crypto';

/**
 * Generate unique request ID
 * @returns {string} Unique request ID
 */
const generateRequestId = () => {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

/**
 * Request ID middleware
 * Adds unique ID to request and response headers
 */
export const requestIdMiddleware = (req, res, next) => {
  // Generate or use existing request ID from header
  const requestId = req.headers['x-request-id'] || generateRequestId();
  
  // Attach to request object
  req.id = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request start
  console.log(`[${requestId}] ${req.method} ${req.path}`);
  
  // Track request duration
  const startTime = Date.now();
  
  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

export default requestIdMiddleware;
