const {
  getDefectCodes,
  getDefectCodeById,
  createDefectCode,
  updateDefectCode,
  deleteDefectCode,
} = require('../controllers/defectCodeController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const defectCodeValidation = [
  body('code', 'Defect code is required').not().isEmpty(),
  body('name', 'Defect name is required').not().isEmpty(),
  body('group', 'Defect group is required').not().isEmpty(),
  body('severity', 'Defect severity is required').not().isEmpty(),
  body('is_active', 'is_active must be a boolean').optional().isBoolean(),
];

router.get('/', auth, authorize(['Admin', 'QC', 'Planner']), getDefectCodes);
router.get('/:id', auth, authorize(['Admin', 'QC']), getDefectCodeById);
router.post('/', auth, authorize(['Admin', 'QC']), defectCodeValidation, createDefectCode);
router.put('/:id', auth, authorize(['Admin', 'QC']), defectCodeValidation, updateDefectCode);
router.delete('/:id', auth, authorize(['Admin', 'QC']), deleteDefectCode);

module.exports = router;