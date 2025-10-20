const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/login', authController.login);
router.post(
  '/register',
  [
    body('username', 'Username is required').not().isEmpty(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    body('name', 'Name is required').not().isEmpty(),
    body('role', 'Role is required').isIn(['Admin', 'Planner', 'QC', 'Operator']),
  ],
  authController.register
);

router.post(
    '/change-password',
    auth,
    [
        body('currentPassword', 'Current password is required').not().isEmpty(),
        body('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 }),
    ],
    authController.changePassword
);

module.exports = router;
