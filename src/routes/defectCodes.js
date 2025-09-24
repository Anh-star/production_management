const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getDefectCodes,
  getDefectCodeById,
  createDefectCode,
  updateDefectCode,
  deleteDefectCode,
} = require('../controllers/defectCodeController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');
const defectCodeValidation = [
  body('code', 'Mã lỗi là bắt buộc').not().isEmpty(),
  body('name', 'Tên lỗi là bắt buộc').not().isEmpty(),
  body('group', 'Nhóm lỗi là bắt buộc').not().isEmpty(),
  body('is_active', 'is_active phải là một giá trị boolean').optional().isBoolean(),
];

router.get('/:id', auth, authorize('Admin'), getDefectCodeById);
router.post('/', auth, authorize('Admin'), defectCodeValidation, createDefectCode);
router.put('/:id', auth, authorize('Admin'), defectCodeValidation, updateDefectCode);
router.delete('/:id', auth, authorize('Admin'), deleteDefectCode);

module.exports = router;
