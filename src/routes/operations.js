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
  body('code', 'Mã Operation là bắt buộc').not().isEmpty(),
  body('name', 'Tên Operation là bắt buộc').not().isEmpty(),
  body('takt_target_sec', 'Mục tiêu phải là một số nguyên').optional().isInt(),
  body('is_active', 'is_active phải là một giá trị boolean').optional().isBoolean(),
];
router.get('/', auth, authorize('Admin'), getOperations);
router.get('/:id', auth, authorize('Admin'), getOperationById);
router.post('/', auth, authorize('Admin'), operationValidation, createOperation);
router.put('/:id', auth, authorize('Admin'), operationValidation, updateOperation);
router.delete('/:id', auth, authorize('Admin'), deleteOperation);

module.exports = router;
