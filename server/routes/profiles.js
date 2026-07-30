const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/profilesController');

const router = Router();

router.use(authenticate);

router.get('/students', authorize('admin', 'university_supervisor', 'industry_supervisor'), ctrl.listStudents);
router.get('/supervisors', authorize('admin'), ctrl.listSupervisors);
router.get('/:id', ctrl.get);
router.put('/:id', ctrl.update);

module.exports = router;
