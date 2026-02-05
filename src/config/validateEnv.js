/**
 * Environment Variable Validation
 * Ensures all required environment variables are set before starting the application
 */

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS'
];

const OPTIONAL_ENV_VARS = [
  'NODE_ENV',
  'PORT',
  'FRONTEND_URL',
  'TOKEN_EXPIRY',
  'REFRESH_TOKEN_EXPIRY',
  'JWT_REFRESH_SECRET'
];

/**
 * Validates that all required environment variables are set
 * @throws {Error} If any required environment variable is missing
 */
export const validateEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease set these variables in your .env file');
    process.exit(1);
  }
  
  console.log('✓ All required environment variables are set');
  
  // Warn about optional variables
  const missingOptional = OPTIONAL_ENV_VARS.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn('⚠ Optional environment variables not set (using defaults):');
    missingOptional.forEach(key => console.warn(`   - ${key}`));
  }
};

/**
 * Gets an environment variable with a default value
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value if not set
 * @returns {string} Environment variable value or default
 */
export const getEnv = (key, defaultValue = '') => {
  return process.env[key] || defaultValue;
};

export default validateEnv;
