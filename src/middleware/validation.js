/**
 * Input Validation Middleware
 * Validates request data using express-validator
 */

import { body, param, query, validationResult } from 'express-validator';

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

/**
 * Tender validation rules
 */
export const validateTender = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  
  body('category')
    .trim()
    .notEmpty().withMessage('Category is required'),
  
  body('deadline')
    .notEmpty().withMessage('Deadline is required')
    .isISO8601().withMessage('Deadline must be a valid date')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Deadline must be in the future');
      }
      return true;
    }),
  
  body('companyName')
    .trim()
    .notEmpty().withMessage('Company name is required'),
  
  body('contactEmail')
    .trim()
    .notEmpty().withMessage('Contact email is required')
    .isEmail().withMessage('Contact email must be valid'),
  
  body('budgetMin')
    .optional()
    .isNumeric().withMessage('Minimum budget must be a number')
    .custom((value, { req }) => {
      if (req.body.budgetMax && parseFloat(value) > parseFloat(req.body.budgetMax)) {
        throw new Error('Minimum budget cannot be greater than maximum budget');
      }
      return true;
    }),
  
  body('budgetMax')
    .optional()
    .isNumeric().withMessage('Maximum budget must be a number'),
  
  body('contactPhone')
    .optional()
    .matches(/^[0-9+\-\s()]+$/).withMessage('Contact phone must be valid'),
  
  handleValidationErrors
];

/**
 * Application validation rules
 */
export const validateApplication = [
  body('companyName')
    .trim()
    .notEmpty().withMessage('Company name is required'),
  
  body('contactPerson')
    .trim()
    .notEmpty().withMessage('Contact person is required'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Email must be valid'),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone is required')
    .matches(/^[0-9+\-\s()]+$/).withMessage('Phone must be valid'),
  
  body('bidAmount')
    .notEmpty().withMessage('Bid amount is required')
    .isNumeric().withMessage('Bid amount must be a number')
    .custom((value) => {
      if (parseFloat(value) <= 0) {
        throw new Error('Bid amount must be greater than 0');
      }
      return true;
    }),
  
  body('message')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Message must not exceed 1000 characters'),
  
  handleValidationErrors
];

/**
 * User registration validation rules
 */
export const validateRegistration = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Email must be valid')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
  
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['admin', 'issuer', 'bidder']).withMessage('Role must be admin, issuer, or bidder'),
  
  body('company')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Company name must not exceed 200 characters'),
  
  handleValidationErrors
];

/**
 * Login validation rules
 */
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Email must be valid'),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  handleValidationErrors
];

/**
 * OTP validation rules
 */
export const validateOTP = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Email must be valid'),
  
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
  
  handleValidationErrors
];

/**
 * Password reset validation rules
 */
export const validatePasswordReset = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Email must be valid'),
  
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
  
  handleValidationErrors
];

/**
 * MongoDB ObjectId validation
 */
export const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .matches(/^[0-9a-fA-F]{24}$/).withMessage(`Invalid ${paramName} format`),
  
  handleValidationErrors
];

/**
 * Pagination validation
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

export default {
  validateTender,
  validateApplication,
  validateRegistration,
  validateLogin,
  validateOTP,
  validatePasswordReset,
  validateObjectId,
  validatePagination,
  handleValidationErrors
};
