const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { getDashboardSummary } = require('../controllers/dashboardController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const dashboardValidation = [
  query('start_date', 'Ngày bắt đầu phải là một ngày hợp lệ').optional().isISO8601().toDate(),
  query('end_date', 'Ngày kết thúc phải là một ngày hợp lệ.').optional().isISO8601().toDate(),
  query('shift_id', 'Shift ID phải là một số nguyên').optional().isInt(),
  query('line', 'Line phải là một string').optional().isString(),
  query('po_id', 'PO ID phải là một số nguyên').optional().isInt(),
  query('product_id', 'Product ID phải là một số nguyên').optional().isInt(),
];

router.get('/', auth, authorize(['Admin', 'Planner', 'QC']), dashboardValidation, getDashboardSummary);

module.exports = router;
