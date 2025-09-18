const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getUsers, createUser } = require('../controllers/userController');
const auth = require('../middleware/auth');

router.get('/', auth, getUsers);
router.post(
  '/',
  auth,
  [
    body('username', 'Username is required').not().isEmpty(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    body('role', 'Role is required').not().isEmpty(),
    body('name', 'Name is required').not().isEmpty(),
  ],
  createUser
);

module.exports = router;
