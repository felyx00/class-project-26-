const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/feedbackController');

const router = Router();

router.use(authenticate);

router.get('/entry/:entryId', ctrl.listByEntry);

router.post(
  '/',
  authorize('admin', 'university_supervisor', 'industry_supervisor'),
  [
    body('entry_id').notEmpty().withMessage('Entry ID is required.'),
    body('comments').trim().notEmpty().withMessage('Comments are required.'),
    validate,
  ],
  ctrl.create
);

module.exports = router;
