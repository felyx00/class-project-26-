const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const router = Router();

router.post(
  '/signup',
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('full_name').trim().notEmpty().withMessage('Full name is required.'),
    body('role').isIn(['student', 'university_supervisor', 'industry_supervisor', 'admin']).withMessage('Invalid role.'),
    validate,
  ],
  ctrl.signUp
);

router.post(
  '/signin',
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
    validate,
  ],
  ctrl.signIn
);

router.post('/signout', authenticate, ctrl.signOut);

router.get('/me', authenticate, ctrl.getMe);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required.'), validate],
  ctrl.forgotPassword
);

router.post(
  '/reset-password',
  [
    body('access_token').notEmpty().withMessage('Access token is required.'),
    body('new_password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    validate,
  ],
  ctrl.resetPassword
);

module.exports = router;
