const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/evaluationsController');

const router = Router();

router.use(authenticate);

router.get('/', ctrl.list);

router.post(
  '/',
  authorize('admin', 'university_supervisor', 'industry_supervisor'),
  [
    body('placement_id').notEmpty().withMessage('Placement ID is required.'),
    body('student_id').notEmpty().withMessage('Student ID is required.'),
    body('comments').trim().notEmpty().withMessage('Comments are required.'),
    body('punctuality').isInt({ min: 1, max: 5 }).withMessage('Punctuality must be 1-5.'),
    body('technical').isInt({ min: 1, max: 5 }).withMessage('Technical must be 1-5.'),
    body('softskills').isInt({ min: 1, max: 5 }).withMessage('Soft skills must be 1-5.'),
    body('attendance').isInt({ min: 1, max: 5 }).withMessage('Initiative must be 1-5.'),
    validate,
  ],
  ctrl.create
);

module.exports = router;
