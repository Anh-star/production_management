const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

router.get('/', auth, roles(['Admin']), userController.getUsers);
router.get('/:id', auth, userController.getUserById);
router.post(
  '/',
  [
    body('username', 'Username is required').not().isEmpty(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    body('role', 'Role is required').isIn(['Admin', 'Planner', 'QC', 'Operator']),
    body('name', 'Name is required').not().isEmpty(),
    body('team_id', 'Team ID must be an integer').optional().isInt(),
    body('is_active', 'is_active must be a boolean').optional().isBoolean(),
  ],
  userController.createUser
);

router.put(
    '/:id',
    auth,
    roles(['Admin']),
    [
        body('role', 'Role is required').optional().isIn(['Admin', 'Planner', 'QC', 'Operator']),
        body('is_active', 'is_active must be a boolean').isBoolean()
    ],
    userController.updateUser
);

router.put(
    '/:id/password',
    auth,
    roles(['Admin']),
    [
        body('password', 'Password must be at least 6 characters').isLength({ min: 6 })
    ],
    userController.updatePassword
);

router.delete('/:id', auth, roles(['Admin']), userController.deleteUser);

module.exports = router;