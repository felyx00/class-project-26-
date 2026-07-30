const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/placementsController');

const router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

router.post(
  '/',
  authorize('admin'),
  [
    body('student_id').notEmpty().withMessage('Student ID is required.'),
    body('organisation_name').trim().notEmpty().withMessage('Organisation name is required.'),
    validate,
  ],
  ctrl.create
);

router.put('/:id', authorize('admin'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
