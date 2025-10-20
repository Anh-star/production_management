const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { getDashboardSummary } = require('../controllers/dashboardController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const dashboardValidation = [
  query('start_date', 'Start date must be a valid date').optional().isISO8601().toDate(),
  query('end_date', 'End date must be a valid date').optional().isISO8601().toDate(),
  query('shift_id', 'Shift ID must be an integer').optional().isInt(),
  query('line', 'Line must be a string').optional().isString(),
  query('po_id', 'PO ID must be an integer').optional().isInt(),
  query('product_id', 'Product ID must be an integer').optional().isInt(),
];
router.get('/', auth, authorize(['Admin', 'Planner', 'QC', 'Operator']), dashboardValidation, getDashboardSummary);

module.exports = router;
