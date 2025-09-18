const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getOperations,
  getOperationById,
  createOperation,
  updateOperation,
  deleteOperation,
} = require('../controllers/operationController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const operationValidation = [
  body('code', 'Operation code is required').not().isEmpty(),
  body('name', 'Operation name is required').not().isEmpty(),
  body('takt_target_sec', 'Takt target must be an integer').optional().isInt(),
  body('is_active', 'is_active must be a boolean').optional().isBoolean(),
];
router.get('/', auth, authorize('Admin'), getOperations);
router.get('/:id', auth, authorize('Admin'), getOperationById);
router.post('/', auth, authorize('Admin'), operationValidation, createOperation);
router.put('/:id', auth, authorize('Admin'), operationValidation, updateOperation);
router.delete('/:id', auth, authorize('Admin'), deleteOperation);

module.exports = router;
