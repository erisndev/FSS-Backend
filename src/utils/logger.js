/**
 * Logger Utility
 * Provides safe logging that sanitizes sensitive data
 */

// Sensitive fields that should be redacted from logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'otp',
  'resetPasswordOTP',
  'emailOTP',
  'resetPasswordToken',
  'emailVerificationToken',
  'verificationCode',
  'authorization',
  'cookie',
  'JWT_SECRET',
  'SUPABASE_SERVICE_KEY',
  'EMAIL_PASS'
];

/**
 * Sanitize object for logging by redacting sensitive fields
 * @param {any} obj - Object to sanitize
 * @returns {any} Sanitized object
 */
export const sanitizeForLog = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item));
  }

  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Log levels
 */
export const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Logger class with different log levels
 */
class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  /**
   * Format log message
   */
  _format(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logData = data ? sanitizeForLog(data) : '';
    return {
      timestamp,
      level,
      context: this.context,
      message,
      ...(data && { data: logData })
    };
  }

  /**
   * Log error message
   */
  error(message, data = null) {
    console.error(JSON.stringify(this._format(LogLevel.ERROR, message, data)));
  }

  /**
   * Log warning message
   */
  warn(message, data = null) {
    console.warn(JSON.stringify(this._format(LogLevel.WARN, message, data)));
  }

  /**
   * Log info message
   */
  info(message, data = null) {
    console.log(JSON.stringify(this._format(LogLevel.INFO, message, data)));
  }

  /**
   * Log debug message (only in development)
   */
  debug(message, data = null) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(JSON.stringify(this._format(LogLevel.DEBUG, message, data)));
    }
  }
}

/**
 * Create logger instance for a specific context
 * @param {string} context - Context name (e.g., 'AuthController', 'TenderService')
 * @returns {Logger} Logger instance
 */
export const createLogger = (context) => {
  return new Logger(context);
};

// Default logger
export const logger = new Logger('App');

export default logger;
