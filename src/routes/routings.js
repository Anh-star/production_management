const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createRouting,
  getActiveRoutingForProduct,
} = require('../controllers/routingController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const routingValidation = [
  body('product_id', 'Product ID là bắt buộc').isInt(),
  body('version', 'Version là bắt buộc').not().isEmpty(),
  body('steps', 'Các bước định tuyến phải là một mảng có ít nhất một bước').isArray({ min: 1 }),
  body('steps.*.step_no', 'Số bước là bắt buộc và phải là một số nguyên').isInt(),
  body('steps.*.operation_id', 'Operation ID là bắt buộc và phải là một số nguyên').isInt(),
  body('steps.*.std_time_sec', 'Standard time là bắt buộc và phải là một số nguyên').isInt(),
];
router.post('/', auth, authorize(['Admin', 'Planner']), routingValidation, createRouting);
router.get('/product/:productId', auth, getActiveRoutingForProduct);

module.exports = router;
