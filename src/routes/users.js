const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// @route   GET api/users
// @desc    Get all users
// @access  Private (Admin)
router.get('/', auth, roles(['Admin']), userController.getUsers);

// @route   POST api/users
// @desc    Create a user
// @access  Public
router.post(
  '/',
  [
    body('username', 'Username là bắt buộc').not().isEmpty(),
    body('password', 'Password phải ít nhất 6 kí tự').isLength({ min: 6 }),
    body('role', 'Role is required').isIn(['Admin', 'Planner', 'QC', 'Operator']),
  ],
  userController.createUser
);

// @route   PUT api/users/:id
// @desc    Update a user
// @access  Private (Admin)
router.put(
    '/:id',
    auth,
    roles(['Admin']),
    [
        body('role', 'Role là bắt buộc').isIn(['Admin', 'Planner', 'QC', 'Operator']),
        body('is_active', 'is_active phải là một giá trị boolean').isBoolean()
    ],
    userController.updateUser
);

// @route   DELETE api/users/:id
// @desc    Delete a user 
// @access  Private (Admin)
router.delete('/:id', auth, roles(['Admin']), userController.deleteUser);


module.exports = router;