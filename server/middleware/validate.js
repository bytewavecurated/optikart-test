import { body, validationResult } from 'express-validator';

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

export const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\d{10}$/).withMessage('Phone number must be 10 digits'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  handleValidationErrors
];

export const sellerRegisterValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\d{10}$/).withMessage('Phone number must be 10 digits'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('gstNumber')
    .trim()
    .notEmpty().withMessage('GST number is required')
    .matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}[A-Z\d]{1}$/).withMessage('Invalid GST number format. Expected format: 22AAAAA0000A1Z5'),
  body('aadharNumber')
    .trim()
    .notEmpty().withMessage('Aadhar number is required')
    .matches(/^\d{12}$/).withMessage('Aadhar number must be 12 digits'),
  body('panNumber')
    .trim()
    .notEmpty().withMessage('PAN number is required')
    .matches(/^[A-Z]{5}\d{4}[A-Z]{1}$/).withMessage('Invalid PAN format. Expected format: AAAAA9999A'),
  body('bankAccount.accountNumber')
    .trim()
    .notEmpty().withMessage('Bank account number is required'),
  body('bankAccount.ifscCode')
    .trim()
    .notEmpty().withMessage('IFSC code is required')
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Invalid IFSC code format'),
  body('bankAccount.bankName')
    .trim()
    .notEmpty().withMessage('Bank name is required'),
  body('bankAccount.branchName')
    .trim()
    .notEmpty().withMessage('Branch name is required'),
  body('storeName')
    .trim()
    .notEmpty().withMessage('Store name is required'),
  handleValidationErrors
];

export const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

export const productValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Product title is required')
    .isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category')
    .trim()
    .notEmpty().withMessage('Category is required')
    .isIn(['sunglasses', 'eyeglasses', 'contactlenses', 'readingglasses', 'sportseyewear', 'kids']).withMessage('Invalid category'),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('brand')
    .trim()
    .notEmpty().withMessage('Brand is required'),
  body('stock')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  handleValidationErrors
];

export const orderValidation = [
  body('shippingAddress.name')
    .trim()
    .notEmpty().withMessage('Recipient name is required'),
  body('shippingAddress.street')
    .trim()
    .notEmpty().withMessage('Street address is required'),
  body('shippingAddress.city')
    .trim()
    .notEmpty().withMessage('City is required'),
  body('shippingAddress.state')
    .trim()
    .notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode')
    .trim()
    .notEmpty().withMessage('Pincode is required')
    .matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('shippingAddress.phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\d{10}$/).withMessage('Phone number must be 10 digits'),
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product')
    .notEmpty().withMessage('Product ID is required'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  handleValidationErrors
];

export const couponValidation = [
  body('code')
    .trim()
    .notEmpty().withMessage('Coupon code is required')
    .isLength({ min: 3, max: 20 }).withMessage('Code must be between 3 and 20 characters')
    .toUpperCase(),
  body('discountType')
    .trim()
    .notEmpty().withMessage('Discount type is required')
    .isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discountValue')
    .notEmpty().withMessage('Discount value is required')
    .isFloat({ min: 0 }).withMessage('Discount value must be a positive number'),
  body('validFrom')
    .notEmpty().withMessage('Valid from date is required')
    .isISO8601().withMessage('Invalid date format'),
  body('validUntil')
    .notEmpty().withMessage('Valid until date is required')
    .isISO8601().withMessage('Invalid date format'),
  handleValidationErrors
];
