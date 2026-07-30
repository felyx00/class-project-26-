const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/entriesController');

const router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('activities').trim().notEmpty().withMessage('Activities are required.'),
    body('entry_date').notEmpty().withMessage('Entry date is required.'),
    validate,
  ],
  ctrl.create
);

router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
