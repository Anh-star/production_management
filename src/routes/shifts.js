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
  body('code', 'Shift code is required').not().isEmpty(),
  body('name', 'Shift name is required').not().isEmpty(),
  body('start_time', 'Start time is required in HH:MM format').matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('end_time', 'End time is required in HH:MM format').matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
];
router.get('/', auth, authorize('Admin'), getShifts);
router.get('/:id', auth, authorize('Admin'), getShiftById);
router.post('/', auth, authorize('Admin'), shiftValidation, createShift);
router.put('/:id', auth, authorize('Admin'), shiftValidation, updateShift);
router.delete('/:id', auth, authorize('Admin'), deleteShift);

module.exports = router;
