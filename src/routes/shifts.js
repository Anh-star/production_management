const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
} = require('../controllers/shiftController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const shiftValidation = [
  body('code', 'Shift code is required').optional().not().isEmpty(),
  body('name', 'Shift name is required').optional().not().isEmpty(),
  body('start_time', 'Start time is required in HH:MM format').optional(),
  body('end_time', 'End time is required in HH:MM format').optional(),
];

router.get('/', auth, authorize(['Admin', 'Planner']), getShifts);
router.get('/:id', auth, authorize(['Admin', 'Planner']), getShiftById);
router.post('/', auth, authorize(['Admin', 'Planner']), shiftValidation, createShift);
router.put('/:id', auth, authorize(['Admin', 'Planner']), shiftValidation, updateShift);
router.delete('/:id', auth, authorize(['Admin', 'Planner']), deleteShift);

module.exports = router;
