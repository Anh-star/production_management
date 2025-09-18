const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { startProduction, stopProduction, getParetoReport } = require('../controllers/reportController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const startValidation = [
  body('po_id', 'Production Order ID is required').isInt(),
  body('operation_id', 'Operation ID is required').isInt(),
  body('shift_id', 'Shift ID is required').isInt(),
  body('line', 'Line/Machine identifier is required').not().isEmpty(),
];

const stopValidation = [
  body('prod_report_id', 'Production Report ID is required').isInt(),
  body('qty_ok', 'OK quantity is required').isInt({ min: 0 }),
  body('qty_ng', 'NG quantity is required').isInt({ min: 0 }),
  body('runtime_min', 'Runtime is required').isInt({ min: 0 }),
  body('downtime_min', 'Downtime is required').isInt({ min: 0 }),
  body('defects', 'Defects must be an array').optional().isArray(),
  body('defects.*.defect_code_id', 'Defect Code ID is required for each defect').if(body('defects').exists()).isInt(),
  body('defects.*.qty', 'Quantity is required for each defect').if(body('defects').exists()).isInt({ gt: 0 }),
];

const paretoValidation = [
    query('start_date', 'Invalid start date format').optional().isISO8601(),
    query('end_date', 'Invalid end date format').optional().isISO8601(),
    query('po_id', 'PO ID must be an integer').optional().isInt(),
    query('product_id', 'Product ID must be an integer').optional().isInt(),
    query('operation_id', 'Operation ID must be an integer').optional().isInt(),
    query('limit', 'Limit must be an integer').optional().isInt({ gt: 0 }),
];
router.post('/start', auth, authorize(['Admin', 'Operator']), startValidation, startProduction);
router.post('/stop', auth, authorize(['Admin', 'Operator']), stopValidation, stopProduction);
router.get('/pareto', auth, authorize(['Admin', 'Planner', 'QC']), paretoValidation, getParetoReport);


module.exports = router;
