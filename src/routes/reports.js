const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { startProduction, stopProduction, getParetoReport, getDailyReport } = require('../controllers/reportController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');
const upload = require('../middleware/upload');

const startValidation = [
  body('po_id', 'Mã lệnh sản xuất là bắt buộc').isInt(),
  body('operation_id', 'Operation ID là bắt buộc').isInt(),
  body('shift_id', 'Shift ID là bắt buộc').isInt(),
  body('line', 'Line/Machine identifier là bắt buộc').not().isEmpty(),
];

const stopValidation = [
  body('prod_report_id', 'Mã báo cáo sản xuất là bắt buộc').isInt(),
  body('qty_ok', 'Số lượng OK là bắt buộc').isInt({ min: 0 }),
  body('qty_ng', 'Số lượng không ổn là bắt buộc').isInt({ min: 0 }),
  body('runtime_min', 'Runtime là bắt buộc').isInt({ min: 0 }),
  body('downtime_min', 'Downtime là bắt buộc').isInt({ min: 0 }),
];

const paretoValidation = [
    query('start_date', 'Định dạng ngày bắt đầu không hợp lệ').optional().isISO8601(),
    query('end_date', 'Định dạng ngày kết thúc không hợp lệ').optional().isISO8601(),
    query('po_id', 'PO ID phải là một số nguyên').optional().isInt(),
    query('product_id', 'Product ID phải là một số nguyên').optional().isInt(),
    query('operation_id', 'Operation ID phải là một số nguyên').optional().isInt(),
    query('limit', 'Limit phải là một số nguyên').optional().isInt({ gt: 0 }),
];

const dailyReportValidation = [
    query('start_date', 'start_date là bắt buộc').isISO8601(),
    query('end_date', 'end_date là bắt buộc').isISO8601(),
];
router.post('/start', auth, authorize(['Admin', 'Operator']), startValidation, startProduction);
router.post('/stop', auth, authorize(['Admin', 'Operator']), upload.array('defect_images', 5), stopValidation, stopProduction);
router.get('/pareto', auth, authorize(['Admin', 'Planner', 'QC']), paretoValidation, getParetoReport);
router.get('/daily', auth, authorize(['Admin', 'Planner', 'QC']), dailyReportValidation, getDailyReport);


module.exports = router;
